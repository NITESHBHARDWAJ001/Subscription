const mongoose = require('mongoose');

const usageTrackerSchema = new mongoose.Schema({
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
  metricKey: {
    type: String,
    required: true,
    uppercase: true
  },
  count: {
    type: Number,
    default: 0,
    min: 0
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  }
});

// Ensures unique metric tracking per subscription
usageTrackerSchema.index({ organizationId: 1, subscriptionId: 1, metricKey: 1 }, { unique: true });

module.exports = mongoose.model('UsageTracker', usageTrackerSchema);
