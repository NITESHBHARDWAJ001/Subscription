const mongoose = require('mongoose');

const planFeatureMappingSchema = new mongoose.Schema({
  planId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Plan',
    required: true
  },
  featureId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Feature',
    required: true
  },
  enabled: {
    type: Boolean,
    default: true
  }
});

// Ensures unique feature per plan
planFeatureMappingSchema.index({ planId: 1, featureId: 1 }, { unique: true });

module.exports = mongoose.model('PlanFeatureMapping', planFeatureMappingSchema);
