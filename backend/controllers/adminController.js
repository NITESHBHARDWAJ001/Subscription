const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const Plan = require('../models/Plan');
const Feature = require('../models/Feature');
const PlanFeatureMapping = require('../models/PlanFeatureMapping');
const PlanLimit = require('../models/PlanLimit');
const Organization = require('../models/Organization');
const Subscription = require('../models/Subscription');
const Payment = require('../models/Payment');
const SubscriptionHistory = require('../models/SubscriptionHistory');

// ============ SUPER ADMIN - PLAN MANAGEMENT ============

// @desc    Create new plan
// @route   POST /api/admin/plans
// @access  Private (SUPER_ADMIN)
exports.createPlan = asyncHandler(async (req, res) => {
  const { name, slug, description, price, billingCycle, durationDays, features, limits } = req.body;

  if (!name || !slug || price === undefined) {
    throw new ApiError(400, 'Please provide name, slug, and price');
  }

  // Calculate default duration based on billing cycle if not provided
  let planDuration = durationDays;
  if (!planDuration) {
    planDuration = billingCycle === 'yearly' ? 365 : 30;
  }

  // Create plan
  const plan = await Plan.create({
    name,
    slug: slug.toLowerCase(),
    description,
    price,
    billingCycle: billingCycle || 'monthly',
    durationDays: planDuration,
    isActive: true
  });

  // Add features to plan (features are now feature IDs)
  if (features && Array.isArray(features) && features.length > 0) {
    const featureMappings = features.map(featureId => ({
      planId: plan._id,
      featureId: featureId,
      enabled: true
    }));
    await PlanFeatureMapping.insertMany(featureMappings);
  }

  // Add limits to plan (now supports both plan-level and feature-specific limits)
  if (limits && Array.isArray(limits)) {
    for (const limit of limits) {
      await PlanLimit.create({
        planId: plan._id,
        featureId: limit.featureId || null,  // null for plan-level limits, featureId for feature-specific
        metricKey: limit.metricKey.toUpperCase(),
        metricName: limit.metricName,
        limit: limit.limit
      });
    }
  }

  res.status(201).json({
    success: true,
    data: plan
  });
});

// @desc    Get all plans
// @route   GET /api/admin/plans
// @access  Private (SUPER_ADMIN)
exports.getPlans = asyncHandler(async (req, res) => {
  const plans = await Plan.find().sort('price');

  // Get features and limits for each plan
  const plansWithDetails = await Promise.all(
    plans.map(async (plan) => {
      const features = await PlanFeatureMapping.find({ planId: plan._id })
        .populate('featureId', 'name key description');
      
      const limits = await PlanLimit.find({ planId: plan._id })
        .populate('featureId', 'name key');

      return {
        ...plan.toObject(),
        features: features.map(f => f.featureId),
        limits
      };
    })
  );

  res.json({
    success: true,
    count: plansWithDetails.length,
    data: plansWithDetails
  });
});

// @desc    Update plan
// @route   PUT /api/admin/plans/:id
// @access  Private (SUPER_ADMIN)
exports.updatePlan = asyncHandler(async (req, res) => {
  const { name, description, price, billingCycle, durationDays, isActive, features, limits } = req.body;

  const plan = await Plan.findById(req.params.id);

  if (!plan) {
    throw new ApiError(404, 'Plan not found');
  }

  if (name) plan.name = name;
  if (description !== undefined) plan.description = description;
  if (price !== undefined) plan.price = price;
  if (billingCycle) plan.billingCycle = billingCycle;
  if (durationDays !== undefined) plan.durationDays = durationDays;
  if (isActive !== undefined) plan.isActive = isActive;

  await plan.save();

  // Update features if provided
  if (features && Array.isArray(features)) {
    // Remove existing feature mappings
    await PlanFeatureMapping.deleteMany({ planId: plan._id });
    
    // Create new feature mappings
    if (features.length > 0) {
      const featureMappings = features.map(featureId => ({
        planId: plan._id,
        featureId
      }));
      await PlanFeatureMapping.insertMany(featureMappings);
    }
  }

  // Update limits if provided
  if (limits && Array.isArray(limits)) {
    // Remove existing limits
    await PlanLimit.deleteMany({ planId: plan._id });
    
    // Create new limits (supports both plan-level and feature-specific)
    if (limits.length > 0) {
      const planLimits = limits.map(limit => ({
        planId: plan._id,
        featureId: limit.featureId || null,
        metricKey: limit.metricKey,
        metricName: limit.metricName,
        limit: limit.limit
      }));
      await PlanLimit.insertMany(planLimits);
    }
  }

  // Fetch updated plan with features and limits
  const updatedPlan = await Plan.findById(plan._id);
  const planFeatures = await PlanFeatureMapping.find({ planId: plan._id }).populate('featureId');
  const planLimits = await PlanLimit.find({ planId: plan._id }).populate('featureId', 'name key');

  res.json({
    success: true,
    data: {
      ...updatedPlan.toObject(),
      features: planFeatures.map(pf => pf.featureId),
      limits: planLimits
    }
  });
});

// @desc    Get plan details with subscribers and usage
// @route   GET /api/admin/plans/:id/details
// @access  Private (SUPER_ADMIN)
exports.getPlanDetails = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const UsageService = require('../services/usageService');

  // Get plan with features and limits
  const plan = await Plan.findById(id);
  if (!plan) {
    throw new ApiError(404, 'Plan not found');
  }

  const planFeatures = await PlanFeatureMapping.find({ planId: id })
    .populate('featureId', 'name key description');
  
  const planLimits = await PlanLimit.find({ planId: id })
    .populate('featureId', 'name key');

  // Get all subscriptions for this plan
  const subscriptions = await Subscription.find({ 
    planId: id,
    status: { $in: ['trialing', 'active', 'past_due'] }
  })
    .populate('organizationId', 'name status')
    .sort('-createdAt');

  // Get usage details for each subscription
  const subscribersWithUsage = await Promise.all(
    subscriptions.map(async (sub) => {
      try {
        const usage = await UsageService.getAllUsage(sub.organizationId._id);
        
        // Calculate usage percentages based on plan limits
        const usageWithPercentages = planLimits
          .filter(limit => !limit.featureId) // Only plan-level limits
          .map(limit => {
            const usageRecord = usage.find(u => u.metricKey === limit.metricKey);
            const current = usageRecord ? usageRecord.count : 0;
            const percentage = limit.limit > 0 ? Math.round((current / limit.limit) * 100) : 0;
            
            return {
              metricKey: limit.metricKey,
              metricName: limit.metricName,
              limit: limit.limit,
              current,
              percentage
            };
          });

        // Get payment history for this subscription
        const payments = await Payment.find({ subscriptionId: sub._id })
          .sort('-createdAt')
          .limit(5)
          .select('amount status createdAt');

        return {
          subscription: {
            id: sub._id,
            status: sub.status,
            startDate: sub.startDate,
            endDate: sub.endDate,
            isTrialing: sub.isTrialing,
            trialEndDate: sub.trialEndDate,
            willCancelAt: sub.willCancelAt,
            createdAt: sub.createdAt
          },
          organization: {
            id: sub.organizationId._id,
            name: sub.organizationId.name,
            status: sub.organizationId.status
          },
          usage: usageWithPercentages,
          recentPayments: payments
        };
      } catch (error) {
        console.error(`Error fetching usage for org ${sub.organizationId._id}:`, error);
        return {
          subscription: {
            id: sub._id,
            status: sub.status,
            startDate: sub.startDate,
            endDate: sub.endDate
          },
          organization: {
            id: sub.organizationId._id,
            name: sub.organizationId.name,
            status: sub.organizationId.status
          },
          usage: [],
          recentPayments: []
        };
      }
    })
  );

  // Calculate plan statistics
  const totalSubscribers = subscribersWithUsage.length;
  const activeSubscribers = subscribersWithUsage.filter(s => s.subscription.status === 'active').length;
  const trialingSubscribers = subscribersWithUsage.filter(s => s.subscription.status === 'trialing').length;
  const pastDueSubscribers = subscribersWithUsage.filter(s => s.subscription.status === 'past_due').length;

  // Calculate total revenue (from all completed payments)
  const totalPayments = await Payment.find({ 
    subscriptionId: { $in: subscriptions.map(s => s._id) },
    status: 'completed'
  });
  const totalRevenue = totalPayments.reduce((sum, payment) => sum + payment.amount, 0);

  res.json({
    success: true,
    data: {
      plan: {
        ...plan.toObject(),
        features: planFeatures.map(f => f.featureId),
        limits: planLimits
      },
      statistics: {
        totalSubscribers,
        activeSubscribers,
        trialingSubscribers,
        pastDueSubscribers,
        totalRevenue,
        averageUsage: subscribersWithUsage.length > 0 
          ? Math.round(
              subscribersWithUsage.reduce((sum, sub) => {
                const avgUsage = sub.usage.length > 0
                  ? sub.usage.reduce((s, u) => s + u.percentage, 0) / sub.usage.length
                  : 0;
                return sum + avgUsage;
              }, 0) / subscribersWithUsage.length
            )
          : 0
      },
      subscribers: subscribersWithUsage
    }
  });
});

// @desc    Get all organizations with subscriptions
// @route   GET /api/admin/organizations
// @access  Private (SUPER_ADMIN)
exports.getOrganizations = asyncHandler(async (req, res) => {
  const organizations = await Organization.find().sort('-createdAt');

  const orgsWithSubscriptions = await Promise.all(
    organizations.map(async (org) => {
      const subscription = await Subscription.findOne({
        organizationId: org._id,
        status: 'active'
      }).populate('planId', 'name price');

      return {
        ...org.toObject(),
        subscription
      };
    })
  );

  res.json({
    success: true,
    count: orgsWithSubscriptions.length,
    data: orgsWithSubscriptions
  });
});

// @desc    Update organization status (block/unblock)
// @route   PUT /api/admin/organizations/:id/status
// @access  Private (SUPER_ADMIN)
exports.updateOrganizationStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;

  if (!status || !['active', 'suspended', 'deleted'].includes(status)) {
    throw new ApiError(400, 'Invalid status. Must be active, suspended, or deleted');
  }

  const organization = await Organization.findById(req.params.id);

  if (!organization) {
    throw new ApiError(404, 'Organization not found');
  }

  organization.status = status;
  await organization.save();

  res.json({
    success: true,
    data: organization
  });
});

// ============ FEATURES MANAGEMENT ============

// @desc    Create feature
// @route   POST /api/admin/features
// @access  Private (SUPER_ADMIN)
exports.createFeature = asyncHandler(async (req, res) => {
  const { name, key, description } = req.body;

  if (!name || !key) {
    throw new ApiError(400, 'Please provide name and key');
  }

  const feature = await Feature.create({
    name,
    key: key.toUpperCase(),
    description
  });

  res.status(201).json({
    success: true,
    data: feature
  });
});

// @desc    Get all features
// @route   GET /api/admin/features
// @access  Private (SUPER_ADMIN)
exports.getFeatures = asyncHandler(async (req, res) => {
  const features = await Feature.find().sort('name');

  res.json({
    success: true,
    count: features.length,
    data: features
  });
});

// ============ SUBSCRIPTION MANAGEMENT ============

// @desc    Auto-expire subscriptions
// @route   POST /api/admin/subscriptions/auto-expire
// @access  Private (SUPER_ADMIN)
exports.autoExpireSubscriptions = asyncHandler(async (req, res) => {
  const { autoExpireSubscriptions } = require('../utils/subscriptionUtils');
  
  const result = await autoExpireSubscriptions();

  res.json({
    success: true,
    message: `Expired ${result.modifiedCount} subscriptions`,
    data: result
  });
});

// @desc    Get expiring subscriptions
// @route   GET /api/admin/subscriptions/expiring
// @access  Private (SUPER_ADMIN)
exports.getExpiringSubscriptions = asyncHandler(async (req, res) => {
  const { getExpiringSubscriptions } = require('../utils/subscriptionUtils');
  const days = parseInt(req.query.days) || 7;
  
  const subscriptions = await getExpiringSubscriptions(days);

  res.json({
    success: true,
    count: subscriptions.length,
    data: subscriptions
  });
});

// ============ PAYMENT MANAGEMENT ============

// @desc    Record manual payment
// @route   POST /api/admin/payments
// @access  Private (SUPER_ADMIN)
exports.recordPayment = asyncHandler(async (req, res) => {
  const {
    subscriptionId,
    amount,
    currency,
    paymentMethod,
    status,
    notes,
    invoiceNumber
  } = req.body;

  if (!subscriptionId || !amount) {
    throw new ApiError(400, 'Please provide subscriptionId and amount');
  }

  // Verify subscription exists
  const subscription = await Subscription.findById(subscriptionId).populate('organizationId');
  if (!subscription) {
    throw new ApiError(404, 'Subscription not found');
  }

  // Create payment record
  const payment = await Payment.create({
    subscriptionId,
    organizationId: subscription.organizationId._id,
    amount,
    currency: currency || 'USD',
    status: status || 'completed',
    paymentMethod: paymentMethod || 'manual',
    invoiceNumber: invoiceNumber || `INV-${Date.now()}`,
    notes,
    processedBy: req.user.userId,
    processedAt: new Date()
  });

  // If payment is completed, update subscription payment dates
  if (payment.status === 'completed') {
    subscription.lastPaymentDate = new Date();
    
    // If subscription was in grace period, reactivate it
    if (subscription.status === 'past_due') {
      subscription.status = 'active';
      subscription.gracePeriodEndDate = null;
    }
    
    await subscription.save();

    // Log in subscription history
    await SubscriptionHistory.create({
      subscriptionId: subscription._id,
      organizationId: subscription.organizationId._id,
      action: 'payment_received',
      performedBy: req.user.userId,
      metadata: {
        paymentId: payment._id,
        amount: payment.amount,
        currency: payment.currency,
        paymentMethod: payment.paymentMethod
      }
    });
  }

  res.status(201).json({
    success: true,
    message: 'Payment recorded successfully',
    data: payment
  });
});

// @desc    Get all payments
// @route   GET /api/admin/payments
// @access  Private (SUPER_ADMIN)
exports.getPayments = asyncHandler(async (req, res) => {
  const { subscriptionId, organizationId, status, limit = 50, skip = 0 } = req.query;

  const query = {};
  if (subscriptionId) query.subscriptionId = subscriptionId;
  if (organizationId) query.organizationId = organizationId;
  if (status) query.status = status;

  const payments = await Payment.find(query)
    .sort('-createdAt')
    .limit(parseInt(limit))
    .skip(parseInt(skip))
    .populate('organizationId', 'name')
    .populate('subscriptionId', 'status')
    .populate('processedBy', 'name email');

  const total = await Payment.countDocuments(query);

  res.json({
    success: true,
    count: payments.length,
    total,
    data: payments
  });
});

// @desc    Convert trial subscription to paid
// @route   POST /api/admin/subscriptions/:id/convert-trial
// @access  Private (SUPER_ADMIN)
exports.convertTrialToPaid = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { paymentId } = req.body;

  const subscription = await Subscription.findById(id).populate('planId');
  if (!subscription) {
    throw new ApiError(404, 'Subscription not found');
  }

  if (!subscription.isTrialing) {
    throw new ApiError(400, 'Subscription is not in trial period');
  }

  // Use utility function to convert trial
  const { convertTrialToPaid: convertTrial } = require('../utils/subscriptionUtils');
  await convertTrial(id, req.user.userId, paymentId);

  // Refresh subscription
  const updatedSubscription = await Subscription.findById(id).populate('planId');

  res.json({
    success: true,
    message: 'Trial subscription converted to paid successfully',
    data: updatedSubscription
  });
});

// @desc    Get subscription history for any organization
// @route   GET /api/admin/subscriptions/:id/history
// @access  Private (SUPER_ADMIN)
exports.getSubscriptionHistory = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { limit = 50, skip = 0 } = req.query;

  const subscription = await Subscription.findById(id);
  if (!subscription) {
    throw new ApiError(404, 'Subscription not found');
  }

  const history = await SubscriptionHistory.find({ subscriptionId: id })
    .sort('-timestamp')
    .limit(parseInt(limit))
    .skip(parseInt(skip))
    .populate('performedBy', 'name email');

  const total = await SubscriptionHistory.countDocuments({ subscriptionId: id });

  res.json({
    success: true,
    count: history.length,
    total,
    data: history
  });
});
