const bcrypt = require('bcrypt');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const User = require('../models/User');
const Organization = require('../models/Organization');

/**
 * @desc    Bootstrap Super Admin (One-time setup)
 * @route   POST /api/system/bootstrap-super-admin
 * @access  Protected by setup key
 * @security Requires x-setup-key header matching SUPER_ADMIN_SETUP_KEY env variable
 */
exports.bootstrapSuperAdmin = asyncHandler(async (req, res) => {
  // ------------------------------------
  // SECURITY CHECK 1: Verify setup key
  // ------------------------------------
  const setupKey = req.headers['x-setup-key'];
  const validSetupKey = process.env.SUPER_ADMIN_SETUP_KEY;

  if (!validSetupKey) {
    throw new ApiError(
      500,
      'System not configured: SUPER_ADMIN_SETUP_KEY missing in environment'
    );
  }

  if (!setupKey || setupKey !== validSetupKey) {
    throw new ApiError(403, 'Invalid or missing setup key');
  }

  // ------------------------------------
  // SECURITY CHECK 2: Prevent duplicate Super Admin
  // ------------------------------------
  const existingSuperAdmin = await User.findOne({ role: 'SUPER_ADMIN' });
  
  if (existingSuperAdmin) {
    throw new ApiError(
      403,
      'Super Admin already exists. Bootstrap endpoint is disabled.'
    );
  }

  // ------------------------------------
  // VALIDATION: Required fields
  // ------------------------------------
  const { email, password, name } = req.body;

  if (!email || !password || !name) {
    throw new ApiError(400, 'Please provide email, password, and name');
  }

  // Email format validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    throw new ApiError(400, 'Please provide a valid email address');
  }

  // Password strength validation
  if (password.length < 8) {
    throw new ApiError(400, 'Password must be at least 8 characters long');
  }

  // ------------------------------------
  // SECURITY CHECK 3: Check if email already exists
  // ------------------------------------
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    throw new ApiError(400, 'Email already registered');
  }

  // ------------------------------------
  // CREATE SUPER ADMIN ORGANIZATION
  // ------------------------------------
  // Super Admin needs an organization (for tenant isolation)
  const superAdminOrg = await Organization.create({
    name: 'System Administration',
    slug: 'system-admin',
    status: 'active'
  });

  // ------------------------------------
  // HASH PASSWORD
  // ------------------------------------
  const hashedPassword = await bcrypt.hash(password, 10);

  // ------------------------------------
  // CREATE SUPER ADMIN USER
  // Role is HARDCODED - NOT from request body
  // ------------------------------------
  const superAdmin = await User.create({
    organizationId: superAdminOrg._id,
    email: email.toLowerCase(),
    password: hashedPassword,
    name,
    role: 'SUPER_ADMIN', // HARDCODED - Critical security requirement
    status: 'active'
  });

  // Remove password from response
  const superAdminResponse = {
    _id: superAdmin._id,
    name: superAdmin.name,
    email: superAdmin.email,
    role: superAdmin.role,
    organizationId: superAdmin.organizationId,
    createdAt: superAdmin.createdAt
  };

  res.status(201).json({
    success: true,
    message: 'Super Admin created successfully. Bootstrap endpoint is now permanently disabled.',
    data: superAdminResponse
  });
});

/**
 * @desc    Check system bootstrap status
 * @route   GET /api/system/bootstrap-status
 * @access  Public (only returns boolean, no sensitive data)
 */
exports.getBootstrapStatus = asyncHandler(async (req, res) => {
  const superAdminExists = await User.exists({ role: 'SUPER_ADMIN' });

  res.json({
    success: true,
    data: {
      bootstrapRequired: !superAdminExists,
      systemInitialized: !!superAdminExists
    }
  });
});
