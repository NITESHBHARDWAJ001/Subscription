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

  // Check if it's the same plan (renewal)
  const isRenewal = currentSubscription.planId._id.toString() === planId;
  
  // Calculate remaining days from current subscription
  const now = new Date();
  const currentEndDate = new Date(currentSubscription.endDate);
  const remainingDays = Math.max(0, Math.ceil((currentEndDate - now) / (1000 * 60 * 60 * 24)));
  
  // Determine if upgrade or downgrade (based on price)
  const isUpgrade = !isRenewal && plan.price > currentSubscription.planId.price;
  const action = isRenewal ? 'renewed' : (isUpgrade ? 'upgraded' : 'downgraded');

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
      newPlanName: plan.name,
      remainingDays: remainingDays
    }
  });

  // Create new subscription with remaining days added
  const startDate = new Date();
  const endDate = new Date();
  
  // Add plan duration PLUS remaining days from old subscription
  const totalDays = plan.durationDays + remainingDays;
  endDate.setDate(endDate.getDate() + totalDays);

  const newSubscription = await Subscription.create({
    organizationId,
    planId: plan._id,
    status: 'active',
    startDate,
    endDate,
    isTrialing: false,
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
      source: isRenewal ? 'renewal' : (isUpgrade ? 'upgrade' : 'downgrade'),
      remainingDaysAdded: remainingDays,
      totalDays: totalDays
    }
  });

  const message = remainingDays > 0 
    ? `Subscription ${action} successfully! ${remainingDays} remaining days added to your new subscription.`
    : `Subscription ${action} successfully!`;

  res.json({
    success: true,
    message,
    data: {
      subscription: await newSubscription.populate('planId'),
      remainingDaysAdded: remainingDays,
      newEndDate: endDate
    }
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

// @desc    Get subscription notifications/alerts
// @route   GET /api/organization/subscription/notifications
// @access  Private (ORG_ADMIN, USER)
exports.getSubscriptionNotifications = asyncHandler(async (req, res) => {
  const { organizationId } = req.user;

  const subscription = await Subscription.findOne({
    organizationId,
    status: { $in: ['trialing', 'active', 'past_due'] }
  }).populate('planId');

  if (!subscription) {
    return res.json({
      success: true,
      data: {
        hasNotifications: false,
        notifications: []
      }
    });
  }

  const notifications = [];
  const now = new Date();

  // Calculate days remaining
  const endDate = new Date(subscription.endDate);
  const daysRemaining = Math.ceil((endDate - now) / (1000 * 60 * 60 * 24));

  // Trial ending notification
  if (subscription.isTrialing && subscription.trialEndDate) {
    const trialEndDate = new Date(subscription.trialEndDate);
    const trialDaysRemaining = Math.ceil((trialEndDate - now) / (1000 * 60 * 60 * 24));
    
    if (trialDaysRemaining <= 3 && trialDaysRemaining > 0) {
      notifications.push({
        type: 'trial_ending',
        severity: trialDaysRemaining <= 1 ? 'high' : 'medium',
        title: 'Trial Period Ending Soon',
        message: `Your trial period ends in ${trialDaysRemaining} ${trialDaysRemaining === 1 ? 'day' : 'days'}. Upgrade to continue using the service.`,
        daysRemaining: trialDaysRemaining,
        actionRequired: true,
        actionText: 'Upgrade Now'
      });
    }
  }

  // Subscription expiring notification (3 days or less)
  if (!subscription.isTrialing && daysRemaining <= 3 && daysRemaining > 0) {
    notifications.push({
      type: 'subscription_expiring',
      severity: daysRemaining <= 1 ? 'high' : 'medium',
      title: 'Subscription Expiring Soon',
      message: `Your subscription expires in ${daysRemaining} ${daysRemaining === 1 ? 'day' : 'days'}. Renew now to continue without interruption.`,
      daysRemaining,
      actionRequired: true,
      actionText: 'Renew Now',
      remainingDays: daysRemaining
    });
  }

  // Subscription expired
  if (daysRemaining <= 0 && subscription.status === 'active') {
    notifications.push({
      type: 'subscription_expired',
      severity: 'high',
      title: 'Subscription Expired',
      message: 'Your subscription has expired. Renew immediately to restore access.',
      daysRemaining: 0,
      actionRequired: true,
      actionText: 'Renew Now'
    });
  }

  // Grace period notification
  if (subscription.status === 'past_due' && subscription.gracePeriodEndDate) {
    const gracePeriodEndDate = new Date(subscription.gracePeriodEndDate);
    const graceDaysRemaining = Math.ceil((gracePeriodEndDate - now) / (1000 * 60 * 60 * 24));
    
    if (graceDaysRemaining > 0) {
      notifications.push({
        type: 'grace_period',
        severity: 'high',
        title: 'Payment Required - Grace Period Active',
        message: `Your subscription is past due. Please make payment within ${graceDaysRemaining} ${graceDaysRemaining === 1 ? 'day' : 'days'} to avoid service interruption.`,
        daysRemaining: graceDaysRemaining,
        actionRequired: true,
        actionText: 'Make Payment'
      });
    }
  }

  // Scheduled cancellation notification
  if (subscription.willCancelAt) {
    const cancelDate = new Date(subscription.willCancelAt);
    const cancelDaysRemaining = Math.ceil((cancelDate - now) / (1000 * 60 * 60 * 24));
    
    if (cancelDaysRemaining > 0) {
      notifications.push({
        type: 'scheduled_cancellation',
        severity: 'medium',
        title: 'Subscription Scheduled for Cancellation',
        message: `Your subscription will be cancelled in ${cancelDaysRemaining} ${cancelDaysRemaining === 1 ? 'day' : 'days'}. You can reactivate it anytime before then.`,
        daysRemaining: cancelDaysRemaining,
        actionRequired: false,
        actionText: 'Reactivate Subscription'
      });
    }
  }

  res.json({
    success: true,
    data: {
      hasNotifications: notifications.length > 0,
      count: notifications.length,
      notifications,
      subscription: {
        status: subscription.status,
        endDate: subscription.endDate,
        daysRemaining,
        planName: subscription.planId.name
      }
    }
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
