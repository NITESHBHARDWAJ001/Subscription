const Subscription = require('../models/Subscription');
const SubscriptionHistory = require('../models/SubscriptionHistory');

/**
 * Auto-expire subscriptions that have passed their grace period
 * This function can be called:
 * - Via a cron job (recommended for production)
 * - Periodically by a scheduler
 * - On-demand via an admin endpoint
 */
const autoExpireSubscriptions = async () => {
  try {
    const now = new Date();
    
    // Expire subscriptions that have passed grace period
    const expiredResult = await Subscription.updateMany(
      {
        status: { $in: ['active', 'past_due'] },
        gracePeriodEndDate: { $lt: now }
      },
      {
        $set: { status: 'expired' }
      }
    );

    // Log history for expired subscriptions
    if (expiredResult.modifiedCount > 0) {
      const expiredSubs = await Subscription.find({
        status: 'expired',
        updatedAt: { $gte: new Date(Date.now() - 5000) } // Last 5 seconds
      });

      for (const sub of expiredSubs) {
        await SubscriptionHistory.create({
          organizationId: sub.organizationId,
          subscriptionId: sub._id,
          action: 'expired',
          previousStatus: 'past_due',
          newStatus: 'expired',
          performedByRole: 'SYSTEM',
          reason: 'Grace period ended'
        });
      }
    }

    // Move subscriptions to past_due if endDate passed but still in grace period
    const pastDueResult = await Subscription.updateMany(
      {
        status: 'active',
        endDate: { $lt: now },
        gracePeriodEndDate: { $gte: now }
      },
      {
        $set: { status: 'past_due' }
      }
    );

    console.log(`✓ Expired ${expiredResult.modifiedCount} subscriptions`);
    console.log(`✓ Moved ${pastDueResult.modifiedCount} to past_due status`);
    
    return {
      expired: expiredResult.modifiedCount,
      pastDue: pastDueResult.modifiedCount
    };
  } catch (error) {
    console.error('Error auto-expiring subscriptions:', error);
    throw error;
  }
};

/**
 * Auto-convert trial subscriptions to expired or active based on trial end
 */
const processTrialSubscriptions = async () => {
  try {
    const now = new Date();
    
    // Find trials that have ended
    const endedTrials = await Subscription.find({
      status: 'trialing',
      trialEndDate: { $lt: now }
    });

    let converted = 0;
    for (const sub of endedTrials) {
      // Trial ended - move to expired (user needs to pay)
      sub.status = 'expired';
      sub.isTrialing = false;
      await sub.save();

      await SubscriptionHistory.create({
        organizationId: sub.organizationId,
        subscriptionId: sub._id,
        action: 'trial_ended',
        previousStatus: 'trialing',
        newStatus: 'expired',
        performedByRole: 'SYSTEM',
        reason: 'Trial period ended'
      });

      converted++;
    }

    console.log(`✓ Processed ${converted} trial subscriptions`);
    return { converted };
  } catch (error) {
    console.error('Error processing trial subscriptions:', error);
    throw error;
  }
};

/**
 * Get subscriptions expiring soon (within specified days)
 * Useful for sending reminder notifications
 */
const getExpiringSubscriptions = async (daysBeforeExpiry = 7) => {
  try {
    const now = new Date();
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + daysBeforeExpiry);

    const subscriptions = await Subscription.find({
      status: { $in: ['active', 'trialing'] },
      endDate: { $gte: now, $lte: futureDate }
    })
      .populate('organizationId', 'name email')
      .populate('planId', 'name price billingCycle');

    return subscriptions;
  } catch (error) {
    console.error('Error getting expiring subscriptions:', error);
    throw error;
  }
};

/**
 * Calculate remaining days for a subscription
 */
const getRemainingDays = (endDate) => {
  const now = new Date();
  const end = new Date(endDate);
  const diffTime = end - now;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return Math.max(0, diffDays);
};

/**
 * Create subscription with trial period
 */
const createSubscriptionWithTrial = async (organizationId, planId, plan, userId = null) => {
  const now = new Date();
  const hasTrialPeriod = plan.hasTrialPeriod && plan.trialDays > 0;

  let subscriptionData = {
    organizationId,
    planId,
    startDate: now
  };

  if (hasTrialPeriod) {
    // Trial subscription
    const trialEndDate = new Date();
    trialEndDate.setDate(trialEndDate.getDate() + plan.trialDays);

    subscriptionData = {
      ...subscriptionData,
      status: 'trialing',
      isTrialing: true,
      trialStartDate: now,
      trialEndDate,
      endDate: trialEndDate, // Initially set to trial end
      gracePeriodEndDate: null
    };
  } else {
    // Regular subscription
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + plan.durationDays);

    const gracePeriodEndDate = new Date(endDate);
    gracePeriodEndDate.setDate(gracePeriodEndDate.getDate() + (plan.gracePeriodDays || 3));

    subscriptionData = {
      ...subscriptionData,
      status: 'active',
      isTrialing: false,
      endDate,
      gracePeriodEndDate
    };
  }

  const subscription = await Subscription.create(subscriptionData);

  // Log history
  await SubscriptionHistory.create({
    organizationId,
    subscriptionId: subscription._id,
    action: hasTrialPeriod ? 'trial_started' : 'created',
    newPlanId: planId,
    newStatus: subscription.status,
    performedBy: userId,
    performedByRole: userId ? 'ORG_ADMIN' : 'SYSTEM',
    reason: hasTrialPeriod ? `Started ${plan.trialDays}-day trial` : 'Initial subscription'
  });

  return subscription;
};

/**
 * Convert trial to paid subscription
 */
const convertTrialToPaid = async (subscriptionId, paymentId = null) => {
  const subscription = await Subscription.findById(subscriptionId).populate('planId');
  
  if (!subscription || subscription.status !== 'trialing') {
    throw new Error('Invalid subscription or not in trial period');
  }

  const plan = subscription.planId;
  const now = new Date();
  const endDate = new Date();
  endDate.setDate(endDate.getDate() + plan.durationDays);

  const gracePeriodEndDate = new Date(endDate);
  gracePeriodEndDate.setDate(gracePeriodEndDate.getDate() + (plan.gracePeriodDays || 3));

  subscription.status = 'active';
  subscription.isTrialing = false;
  subscription.startDate = now;
  subscription.endDate = endDate;
  subscription.gracePeriodEndDate = gracePeriodEndDate;
  subscription.lastPaymentDate = now;

  await subscription.save();

  // Log history
  await SubscriptionHistory.create({
    organizationId: subscription.organizationId,
    subscriptionId: subscription._id,
    action: 'payment_received',
    previousStatus: 'trialing',
    newStatus: 'active',
    performedByRole: 'SYSTEM',
    reason: 'Trial converted to paid subscription',
    metadata: { paymentId }
  });

  return subscription;
};

/**
 * Cancel subscription (end-of-period)
 */
const cancelSubscription = async (subscriptionId, userId, reason = null) => {
  const subscription = await Subscription.findById(subscriptionId);
  
  if (!subscription) {
    throw new Error('Subscription not found');
  }

  if (subscription.status === 'cancelled' || subscription.status === 'expired') {
    throw new Error('Subscription already cancelled or expired');
  }

  // Set to cancel at end of period (don't cancel immediately)
  subscription.willCancelAt = subscription.endDate;
  subscription.cancelledAt = new Date();
  subscription.cancelledBy = userId;
  subscription.cancellationReason = reason;
  subscription.autoRenew = false;

  await subscription.save();

  // Log history
  await SubscriptionHistory.create({
    organizationId: subscription.organizationId,
    subscriptionId: subscription._id,
    action: 'cancelled',
    previousStatus: subscription.status,
    newStatus: subscription.status, // Status doesn't change yet
    performedBy: userId,
    performedByRole: 'ORG_ADMIN',
    reason: reason || 'User requested cancellation',
    metadata: { willCancelAt: subscription.willCancelAt }
  });

  return subscription;
};

/**
 * Reactivate cancelled subscription
 */
const reactivateSubscription = async (subscriptionId, userId) => {
  const subscription = await Subscription.findById(subscriptionId);
  
  if (!subscription) {
    throw new Error('Subscription not found');
  }

  if (!subscription.willCancelAt) {
    throw new Error('Subscription is not scheduled for cancellation');
  }

  // Remove cancellation
  subscription.willCancelAt = null;
  subscription.cancelledAt = null;
  subscription.cancelledBy = null;
  subscription.cancellationReason = null;

  await subscription.save();

  // Log history
  await SubscriptionHistory.create({
    organizationId: subscription.organizationId,
    subscriptionId: subscription._id,
    action: 'reactivated',
    previousStatus: subscription.status,
    newStatus: subscription.status,
    performedBy: userId,
    performedByRole: 'ORG_ADMIN',
    reason: 'User reactivated subscription'
  });

  return subscription;
};

module.exports = {
  autoExpireSubscriptions,
  processTrialSubscriptions,
  getExpiringSubscriptions,
  getRemainingDays,
  createSubscriptionWithTrial,
  convertTrialToPaid,
  cancelSubscription,
  reactivateSubscription
};
