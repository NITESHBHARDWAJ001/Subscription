const asyncHandler = require('../utils/asyncHandler');
const Plan = require('../models/Plan');
const PlanFeatureMapping = require('../models/PlanFeatureMapping');
const PlanLimit = require('../models/PlanLimit');

// @desc    Get all active plans (public for upgrade selection)
// @route   GET /api/public/plans
// @access  Private (any authenticated user)
exports.getPublicPlans = asyncHandler(async (req, res) => {
  const plans = await Plan.find({ isActive: true }).sort('price');

  // Get features and limits for each plan
  const plansWithDetails = await Promise.all(
    plans.map(async (plan) => {
      const features = await PlanFeatureMapping.find({ planId: plan._id })
        .populate('featureId', 'name key description');
      
      const limits = await PlanLimit.find({ planId: plan._id });

      return {
        ...plan.toObject(),
        features: features.map(f => ({
          name: f.featureId.name,
          key: f.featureId.key,
          description: f.featureId.description
        })),
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
