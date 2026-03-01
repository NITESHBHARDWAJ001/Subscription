const mongoose = require('mongoose');

const planLimitSchema = new mongoose.Schema({
  planId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Plan',
    required: true
  },
  featureId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Feature',
    required: false  // Optional: if set, this is a feature-specific limit
  },
  metricKey: {
    type: String,
    required: true,
    uppercase: true
  },
  metricName: {
    type: String,
    required: true
  },
  limit: {
    type: Number,
    required: true,
    min: 0
  }
});

// Ensures unique metric per plan (and per feature if featureId is set)
planLimitSchema.index({ planId: 1, featureId: 1, metricKey: 1 }, { unique: true });

module.exports = mongoose.model('PlanLimit', planLimitSchema);
