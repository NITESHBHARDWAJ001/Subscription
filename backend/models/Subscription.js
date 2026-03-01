const mongoose = require('mongoose');

const subscriptionSchema = new mongoose.Schema({
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: true,
    index: true
  },
  planId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Plan',
    required: true
  },
  status: {
    type: String,
    enum: ['trialing', 'active', 'past_due', 'cancelled', 'expired'],
    default: 'active'
  },
  // Trial configuration
  isTrialing: {
    type: Boolean,
    default: false
  },
  trialStartDate: {
    type: Date
  },
  trialEndDate: {
    type: Date
  },
  // Subscription period
  startDate: {
    type: Date,
    required: true,
    default: Date.now
  },
  endDate: {
    type: Date,
    required: true
  },
  // Grace period (3 days after expiry)
  gracePeriodEndDate: {
    type: Date
  },
  // Cancellation tracking
  cancelledAt: {
    type: Date
  },
  cancelledBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  cancellationReason: {
    type: String
  },
  willCancelAt: {
    type: Date  // For end-of-period cancellations
  },
  // Payment tracking
  lastPaymentDate: {
    type: Date
  },
  nextPaymentDate: {
    type: Date
  },
  autoRenew: {
    type: Boolean,
    default: false  // Manual renewal for MVP
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Update timestamp on save
subscriptionSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Ensure we can quickly find active subscription per org
subscriptionSchema.index({ organizationId: 1, status: 1 });
subscriptionSchema.index({ status: 1, endDate: 1 });
subscriptionSchema.index({ status: 1, gracePeriodEndDate: 1 });

module.exports = mongoose.model('Subscription', subscriptionSchema);
