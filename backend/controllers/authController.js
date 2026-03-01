const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const User = require('../models/User');
const Organization = require('../models/Organization');
const Subscription = require('../models/Subscription');
const Plan = require('../models/Plan');

// Generate JWT Token
const generateToken = (userId, organizationId, role) => {
  return jwt.sign(
    { userId, organizationId, role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRE || '7d' }
  );
};

// @desc    Register new organization with admin user
// @route   POST /api/auth/register
// @access  Public
exports.registerOrganization = asyncHandler(async (req, res) => {
  const { organizationName, email, password, adminName } = req.body;

  // Validation
  if (!organizationName || !email || !password || !adminName) {
    throw new ApiError(400, 'Please provide all required fields');
  }

  // Check if user already exists
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    throw new ApiError(400, 'Email already registered');
  }

  // Create slug from organization name
  const slug = organizationName.toLowerCase().replace(/[^a-z0-9]+/g, '-');

  // Check if organization slug exists
  const existingOrg = await Organization.findOne({ slug });
  if (existingOrg) {
    throw new ApiError(400, 'Organization name already taken');
  }

  // Hash password
  const hashedPassword = await bcrypt.hash(password, 10);

  // Create organization
  const organization = await Organization.create({
    name: organizationName,
    slug,
    email,
    status: 'active'
  });

  // Create admin user
  const user = await User.create({
    organizationId: organization._id,
    email,
    password: hashedPassword,
    name: adminName,
    role: 'ORG_ADMIN',
    status: 'active'
  });

  // Assign default Free plan with trial support
  const { createSubscriptionWithTrial } = require('../utils/subscriptionUtils');
  const freePlan = await Plan.findOne({ slug: 'free' });
  
  if (freePlan) {
    await createSubscriptionWithTrial(
      organization._id,
      freePlan._id,
      freePlan,
      user._id
    );
  }

  // Generate token
  const token = generateToken(user._id, organization._id, user.role);

  res.status(201).json({
    success: true,
    data: {
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        organizationId: organization._id,
        organizationName: organization.name
      }
    }
  });
});

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
exports.login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  // Validation
  if (!email || !password) {
    throw new ApiError(400, 'Please provide email and password');
  }

  // Find user
  const user = await User.findOne({ email }).populate('organizationId', 'name slug status');

  if (!user) {
    throw new ApiError(401, 'Invalid credentials');
  }

  // Check if user is active
  if (user.status !== 'active') {
    throw new ApiError(401, 'Account is not active');
  }

  // Check if organization is active
  if (user.organizationId.status !== 'active') {
    throw new ApiError(401, 'Organization is not active');
  }

  // Check password
  const isPasswordMatch = await bcrypt.compare(password, user.password);

  if (!isPasswordMatch) {
    throw new ApiError(401, 'Invalid credentials');
  }

  // Generate token
  const token = generateToken(user._id, user.organizationId._id, user.role);

  res.json({
    success: true,
    data: {
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        organizationId: user.organizationId._id,
        organizationName: user.organizationId.name
      }
    }
  });
});

// @desc    Get current user
// @route   GET /api/auth/me
// @access  Private
exports.getMe = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.userId)
    .select('-password')
    .populate('organizationId', 'name slug');

  res.json({
    success: true,
    data: user
  });
});
