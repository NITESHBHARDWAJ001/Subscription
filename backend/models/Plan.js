const mongoose = require('mongoose');

const planSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true
  },
  slug: {
    type: String,
    required: true,
    unique: true,
    lowercase: true
  },
  description: {
    type: String
  },
  price: {
    type: Number,
    required: true,
    min: 0
  },
  billingCycle: {
    type: String,
    enum: ['monthly', 'yearly', 'custom'],
    default: 'monthly'
  },
  durationDays: {
    type: Number,
    required: true,
    default: 30,
    min: 1
  },
  // Trial configuration
  hasTrialPeriod: {
    type: Boolean,
    default: false
  },
  trialDays: {
    type: Number,
    default: 14,
    min: 0
  },
  // Grace period after expiry
  gracePeriodDays: {
    type: Number,
    default: 3,
    min: 0
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Plan', planSchema);
