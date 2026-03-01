const jwt = require('jsonwebtoken');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const User = require('../models/User');

exports.protect = asyncHandler(async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    throw new ApiError(401, 'Not authorized to access this route');
  }

  try {
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Add user info to request
    req.user = {
      userId: decoded.userId,
      organizationId: decoded.organizationId,
      role: decoded.role
    };

    // Verify user still exists and is active
    const user = await User.findById(decoded.userId);
    if (!user || user.status !== 'active') {
      throw new ApiError(401, 'User no longer exists or is inactive');
    }

    next();
  } catch (error) {
    throw new ApiError(401, 'Not authorized to access this route');
  }
});

// Role-based access control
exports.authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      throw new ApiError(403, `Role ${req.user.role} is not authorized to access this route`);
    }
    next();
  };
};
