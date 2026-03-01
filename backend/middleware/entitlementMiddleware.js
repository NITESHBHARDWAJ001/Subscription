const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const Subscription = require('../models/Subscription');
const Plan = require('../models/Plan');
const Feature = require('../models/Feature');
const PlanFeatureMapping = require('../models/PlanFeatureMapping');
const PlanLimit = require('../models/PlanLimit');
const UsageTracker = require('../models/UsageTracker');

/**
 * CRITICAL ENTITLEMENT MIDDLEWARE
 * 
 * This middleware enforces subscription-based access control at the API level.
 * It checks:
 * 1. Subscription validity (not expired)
 * 2. Feature access (feature enabled in plan)
 * 3. Usage limits (within plan limits)
 * 
 * @param {string} requiredFeatureKey - Feature key required (e.g., 'CREATE_PROJECT')
 * @param {string} usageMetricKey - Usage metric to check (e.g., 'PROJECTS_COUNT')
 * @returns {Function} Express middleware
 */
const checkEntitlement = (requiredFeatureKey = null, usageMetricKey = null) => {
  return asyncHandler(async (req, res, next) => {
    const { organizationId } = req.user;

    // Step 1: Load subscription (including trialing and past_due)
    const subscription = await Subscription.findOne({
      organizationId,
      status: { $in: ['trialing', 'active', 'past_due'] }
    }).populate('planId');

    if (!subscription) {
      throw new ApiError(402, 'No active subscription found. Please subscribe to a plan.');
    }

    const now = new Date();

    // Step 2: Check subscription validity based on status
    if (subscription.status === 'trialing') {
      // Check if trial has ended
      if (subscription.trialEndDate && subscription.trialEndDate < now) {
        subscription.status = 'expired';
        subscription.isTrialing = false;
        await subscription.save();
        throw new ApiError(402, 'Trial period has ended. Please upgrade to a paid plan.');
      }
      // Trial is valid, continue
    } else if (subscription.status === 'active') {
      // Check if subscription period has ended
      if (subscription.endDate < now) {
        // Move to past_due (grace period)
        subscription.status = 'past_due';
        await subscription.save();
        
        // Still allow access during grace period
        req.isInGracePeriod = true;
      }
    } else if (subscription.status === 'past_due') {
      // Check if grace period has ended
      if (subscription.gracePeriodEndDate && subscription.gracePeriodEndDate < now) {
        subscription.status = 'expired';
        await subscription.save();
        throw new ApiError(402, 'Subscription has expired. Please renew your subscription.');
      }
      // Still in grace period, allow access but flag it
      req.isInGracePeriod = true;
    }

    // Attach subscription to request for later use
    req.subscription = subscription;

    // Step 3: Check feature access (if required)
    if (requiredFeatureKey) {
      const feature = await Feature.findOne({ key: requiredFeatureKey });

      if (!feature) {
        throw new ApiError(500, `Feature ${requiredFeatureKey} not found in system`);
      }

      const featureMapping = await PlanFeatureMapping.findOne({
        planId: subscription.planId._id,
        featureId: feature._id,
        enabled: true
      });

      if (!featureMapping) {
        throw new ApiError(
          403,
          `Feature not available in your ${subscription.planId.name} plan. Please upgrade.`
        );
      }
    }

    // Step 4: Check usage limits (if metric provided)
    if (usageMetricKey) {
      // Get plan limit
      const planLimit = await PlanLimit.findOne({
        planId: subscription.planId._id,
        metricKey: usageMetricKey
      });

      if (!planLimit) {
        throw new ApiError(500, `Usage metric ${usageMetricKey} not configured for this plan`);
      }

      // Get current usage
      const usage = await UsageTracker.findOne({
        organizationId,
        subscriptionId: subscription._id,
        metricKey: usageMetricKey
      });

      const currentCount = usage ? usage.count : 0;

      // Check if limit exceeded
      if (currentCount >= planLimit.limit) {
        throw new ApiError(
          429,
          `Usage limit exceeded. You have reached the maximum of ${planLimit.limit} ${planLimit.metricName}. Please upgrade your plan.`
        );
      }

      // Attach usage info to request
      req.usageInfo = {
        metricKey: usageMetricKey,
        currentCount,
        limit: planLimit.limit
      };
    }

    // All checks passed
    next();
  });
};

module.exports = checkEntitlement;
