const UsageTracker = require('../models/UsageTracker');
const Subscription = require('../models/Subscription');

class UsageService {
  /**
   * Increment usage counter atomically
   * Uses MongoDB $inc operator for atomic updates
   * 
   * @param {ObjectId} organizationId 
   * @param {string} metricKey 
   * @param {number} incrementBy 
   */
  static async incrementUsage(organizationId, metricKey, incrementBy = 1) {
    try {
      // Get active subscription
      const subscription = await Subscription.findOne({
        organizationId,
        status: 'active'
      });

      if (!subscription) {
        throw new Error('No active subscription found');
      }

      // Atomic increment using findOneAndUpdate with upsert
      const result = await UsageTracker.findOneAndUpdate(
        {
          organizationId,
          subscriptionId: subscription._id,
          metricKey: metricKey.toUpperCase()
        },
        {
          $inc: { count: incrementBy },
          $set: { lastUpdated: new Date() }
        },
        {
          upsert: true, // Create if doesn't exist
          new: true,
          setDefaultsOnInsert: true
        }
      );

      return result;
    } catch (error) {
      console.error('Error incrementing usage:', error);
      throw error;
    }
  }

  /**
   * Decrement usage counter (e.g., when deleting a resource)
   * 
   * @param {ObjectId} organizationId 
   * @param {string} metricKey 
   * @param {number} decrementBy 
   */
  static async decrementUsage(organizationId, metricKey, decrementBy = 1) {
    try {
      const subscription = await Subscription.findOne({
        organizationId,
        status: 'active'
      });

      if (!subscription) {
        return null;
      }

      const result = await UsageTracker.findOneAndUpdate(
        {
          organizationId,
          subscriptionId: subscription._id,
          metricKey: metricKey.toUpperCase()
        },
        {
          $inc: { count: -decrementBy },
          $set: { lastUpdated: new Date() }
        },
        {
          new: true
        }
      );

      // Ensure count doesn't go below 0
      if (result && result.count < 0) {
        result.count = 0;
        await result.save();
      }

      return result;
    } catch (error) {
      console.error('Error decrementing usage:', error);
      throw error;
    }
  }

  /**
   * Get current usage for an organization
   * 
   * @param {ObjectId} organizationId 
   * @param {string} metricKey 
   */
  static async getUsage(organizationId, metricKey) {
    try {
      const subscription = await Subscription.findOne({
        organizationId,
        status: 'active'
      });

      if (!subscription) {
        return null;
      }

      const usage = await UsageTracker.findOne({
        organizationId,
        subscriptionId: subscription._id,
        metricKey: metricKey.toUpperCase()
      });

      return usage ? usage.count : 0;
    } catch (error) {
      console.error('Error getting usage:', error);
      throw error;
    }
  }

  /**
   * Get all usage metrics for an organization
   * 
   * @param {ObjectId} organizationId 
   */
  static async getAllUsage(organizationId) {
    try {
      const subscription = await Subscription.findOne({
        organizationId,
        status: 'active'
      });

      if (!subscription) {
        return [];
      }

      const usage = await UsageTracker.find({
        organizationId,
        subscriptionId: subscription._id
      });

      return usage;
    } catch (error) {
      console.error('Error getting all usage:', error);
      throw error;
    }
  }
}

module.exports = UsageService;
