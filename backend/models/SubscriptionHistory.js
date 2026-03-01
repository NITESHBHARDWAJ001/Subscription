const mongoose = require('mongoose');

const subscriptionHistorySchema = new mongoose.Schema({
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: true,
    index: true
  },
  subscriptionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Subscription',
    required: true
  },
  action: {
    type: String,
    enum: [
      'created',
      'upgraded',
      'downgraded',
      'renewed',
      'cancelled',
      'expired',
      'reactivated',
      'trial_started',
      'trial_ended',
      'entered_grace_period',
      'payment_received',
      'payment_failed'
    ],
    required: true
  },
  previousPlanId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Plan'
  },
  newPlanId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Plan'
  },
  previousStatus: {
    type: String
  },
  newStatus: {
    type: String
  },
  // Who performed the action
  performedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  performedByRole: {
    type: String,
    enum: ['SUPER_ADMIN', 'ORG_ADMIN', 'USER', 'SYSTEM']
  },
  // Additional details
  reason: {
    type: String
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  }
});

// Indexes for efficient querying
subscriptionHistorySchema.index({ organizationId: 1, timestamp: -1 });
subscriptionHistorySchema.index({ subscriptionId: 1, timestamp: -1 });
subscriptionHistorySchema.index({ action: 1, timestamp: -1 });

module.exports = mongoose.model('SubscriptionHistory', subscriptionHistorySchema);
