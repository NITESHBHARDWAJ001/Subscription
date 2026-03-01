const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const bcrypt = require('bcrypt');
const User = require('../models/User');
const Subscription = require('../models/Subscription');
const SubscriptionHistory = require('../models/SubscriptionHistory');
const Payment = require('../models/Payment');
const Plan = require('../models/Plan');
const PlanLimit = require('../models/PlanLimit');
const UsageService = require('../services/usageService');
const { createSubscriptionWithTrial } = require('../utils/subscriptionUtils');

// @desc    Invite user to organization
// @route   POST /api/organization/invite
// @access  Private (ORG_ADMIN)
exports.inviteUser = asyncHandler(async (req, res) => {
  const { email, name, role } = req.body;
  const { organizationId } = req.user;

  if (!email || !name) {
    throw new ApiError(400, 'Please provide email and name');
  }

  // Check if user already exists
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    throw new ApiError(400, 'User with this email already exists');
  }

  // Check user limit
  const subscription = await Subscription.findOne({
    organizationId,
    status: 'active'
  });

  if (!subscription) {
    throw new ApiError(402, 'No active subscription');
  }

  const userLimit = await PlanLimit.findOne({
    planId: subscription.planId,
    metricKey: 'USERS_COUNT'
  });

  const currentUsersCount = await User.countDocuments({ organizationId });

  if (userLimit && currentUsersCount >= userLimit.limit) {
    throw new ApiError(429, `User limit reached. Maximum ${userLimit.limit} users allowed.`);
  }

  // Generate temporary password
  const tempPassword = Math.random().toString(36).slice(-8);
  const hashedPassword = await bcrypt.hash(tempPassword, 10);

  // Create user
  const user = await User.create({
    organizationId,
    email,
    name,
    password: hashedPassword,
    role: role || 'USER',
    status: 'active'
  });

  // Increment usage
  await UsageService.incrementUsage(organizationId, 'USERS_COUNT');

  res.status(201).json({
    success: true,
    data: {
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        role: user.role
      },
      temporaryPassword: tempPassword // In production, send via email
    }
  });
});

// @desc    Get current subscription details
// @route   GET /api/organization/subscription
// @access  Private (ORG_ADMIN, USER)
exports.getSubscription = asyncHandler(async (req, res) => {
  const { organizationId } = req.user;

  const subscription = await Subscription.findOne({
    organizationId,
    status: { $in: ['trialing', 'active', 'past_due'] }
  }).populate('planId');

  if (!subscription) {
    throw new ApiError(404, 'No active subscription found');
  }

  // Get plan limits
  const limits = await PlanLimit.find({ planId: subscription.planId._id, featureId: null });

  // Get current usage
  const usage = await UsageService.getAllUsage(organizationId);

  // Combine limits with current usage
  const usageWithLimits = limits.map(limit => {
    const usageRecord = usage.find(u => u.metricKey === limit.metricKey);
    return {
      metricKey: limit.metricKey,
      metricName: limit.metricName,
      limit: limit.limit,
      current: usageRecord ? usageRecord.count : 0
    };
  });

  // Get subscription history
  const history = await SubscriptionHistory.find({
    subscriptionId: subscription._id
  })
    .sort('-timestamp')
    .limit(10)
    .populate('performedBy', 'name email');

  res.json({
    success: true,
    data: {
      subscription,
      usage: usageWithLimits,
      history
    }
  });
});

// @desc    Upgrade/downgrade subscription
// @route   PUT /api/organization/subscription/upgrade
// @access  Private (ORG_ADMIN)
exports.upgradeSubscription = asyncHandler(async (req, res) => {
  const { planId } = req.body;
  const { organizationId, userId } = req.user;

  if (!planId) {
    throw new ApiError(400, 'Please provide planId');
  }

  // Verify plan exists
  const plan = await Plan.findById(planId);
  if (!plan || !plan.isActive) {
    throw new ApiError(404, 'Plan not found or inactive');
  }

  // Get current subscription
  const currentSubscription = await Subscription.findOne({
    organizationId,
    status: { $in: ['trialing', 'active', 'past_due'] }
  }).populate('planId');

  if (!currentSubscription) {
    throw new ApiError(404, 'No active subscription found');
  }

  // Check if it's the same plan
  if (currentSubscription.planId._id.toString() === planId) {
    throw new ApiError(400, 'Already subscribed to this plan');
  }

  // Determine if upgrade or downgrade (based on price)
  const isUpgrade = plan.price > currentSubscription.planId.price;
  const action = isUpgrade ? 'upgraded' : 'downgraded';

  // Mark current subscription as cancelled
  currentSubscription.status = 'cancelled';
  currentSubscription.cancelledAt = new Date();
  currentSubscription.cancelledBy = userId;
  await currentSubscription.save();

  // Log the change in history
  await SubscriptionHistory.create({
    subscriptionId: currentSubscription._id,
    organizationId,
    action,
    performedBy: userId,
    metadata: {
      oldPlanId: currentSubscription.planId._id,
      oldPlanName: currentSubscription.planId.name,
      newPlanId: plan._id,
      newPlanName: plan.name
    }
  });

  // Create new subscription (starts immediately)
  const startDate = new Date();
  const endDate = new Date();
  endDate.setDate(endDate.getDate() + plan.durationDays);

  const newSubscription = await Subscription.create({
    organizationId,
    planId: plan._id,
    status: 'active',
    startDate,
    endDate,
    isTrialing: false, // Upgrades/downgrades are not trials
    autoRenew: true,
    lastPaymentDate: new Date(),
    nextPaymentDate: endDate
  });

  // Log the new subscription creation
  await SubscriptionHistory.create({
    subscriptionId: newSubscription._id,
    organizationId,
    action: 'created',
    performedBy: userId,
    metadata: {
      planId: plan._id,
      planName: plan.name,
      startDate,
      endDate,
      source: isUpgrade ? 'upgrade' : 'downgrade'
    }
  });

  res.json({
    success: true,
    message: `Subscription ${action} successfully`,
    data: await newSubscription.populate('planId')
  });
});

// @desc    Cancel subscription (at end of period)
// @route   PUT /api/organization/subscription/cancel
// @access  Private (ORG_ADMIN)
exports.cancelSubscription = asyncHandler(async (req, res) => {
  const { reason } = req.body;
  const { organizationId, userId } = req.user;

  const subscription = await Subscription.findOne({
    organizationId,
    status: { $in: ['trialing', 'active'] }
  }).populate('planId');

  if (!subscription) {
    throw new ApiError(404, 'No active subscription found');
  }

  if (subscription.willCancelAt) {
    throw new ApiError(400, 'Subscription is already scheduled for cancellation');
  }

  // Use utility function to cancel subscription
  const { cancelSubscription: cancelSub } = require('../utils/subscriptionUtils');
  await cancelSub(subscription._id, userId, reason);

  // Refetch subscription to get updated values
  const updatedSubscription = await Subscription.findById(subscription._id).populate('planId');

  res.json({
    success: true,
    message: 'Subscription will be cancelled at the end of the current period',
    data: {
      subscription: updatedSubscription,
      willCancelAt: updatedSubscription.willCancelAt
    }
  });
});

// @desc    Reactivate cancelled subscription
// @route   PUT /api/organization/subscription/reactivate
// @access  Private (ORG_ADMIN)
exports.reactivateSubscription = asyncHandler(async (req, res) => {
  const { organizationId, userId } = req.user;

  const subscription = await Subscription.findOne({
    organizationId,
    status: { $in: ['trialing', 'active'] },
    willCancelAt: { $ne: null }
  }).populate('planId');

  if (!subscription) {
    throw new ApiError(404, 'No subscription scheduled for cancellation found');
  }

  // Use utility function to reactivate subscription
  const { reactivateSubscription: reactivateSub } = require('../utils/subscriptionUtils');
  await reactivateSub(subscription._id, userId);

  // Refetch subscription to get updated values
  const updatedSubscription = await Subscription.findById(subscription._id).populate('planId');

  res.json({
    success: true,
    message: 'Subscription reactivated successfully',
    data: updatedSubscription
  });
});

// @desc    Get subscription history
// @route   GET /api/organization/subscription/history
// @access  Private (ORG_ADMIN, USER)
exports.getSubscriptionHistory = asyncHandler(async (req, res) => {
  const { organizationId } = req.user;
  const { limit = 20, skip = 0 } = req.query;

  const history = await SubscriptionHistory.find({ organizationId })
    .sort('-timestamp')
    .limit(parseInt(limit))
    .skip(parseInt(skip))
    .populate('performedBy', 'name email')
    .populate('subscriptionId', 'status');

  const total = await SubscriptionHistory.countDocuments({ organizationId });

  res.json({
    success: true,
    count: history.length,
    total,
    data: history
  });
});

// @desc    Get organization users
// @route   GET /api/organization/users
// @access  Private (ORG_ADMIN)
exports.getUsers = asyncHandler(async (req, res) => {
  const { organizationId } = req.user;

  const users = await User.find({ organizationId })
    .select('-password')
    .sort('-createdAt');

  res.json({
    success: true,
    count: users.length,
    data: users
  });
});
