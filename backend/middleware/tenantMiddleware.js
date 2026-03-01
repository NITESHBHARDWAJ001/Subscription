const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');

/**
 * Tenant isolation middleware
 * Ensures all queries are scoped to the user's organization
 */
const tenantIsolation = asyncHandler(async (req, res, next) => {
  // Attach organizationId to query params for easy filtering
  if (!req.user || !req.user.organizationId) {
    throw new ApiError(401, 'Organization context not found');
  }

  req.tenantId = req.user.organizationId;

  next();
});

module.exports = tenantIsolation;
