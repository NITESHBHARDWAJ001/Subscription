const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const Project = require('../models/Project');
const UsageService = require('../services/usageService');

// @desc    Create new project
// @route   POST /api/projects
// @access  Private (ORG_ADMIN)
exports.createProject = asyncHandler(async (req, res) => {
  const { name, description } = req.body;
  const { organizationId, userId } = req.user;

  if (!name) {
    throw new ApiError(400, 'Project name is required');
  }

  // Create project
  const project = await Project.create({
    organizationId,
    name,
    description,
    createdBy: userId,
    members: [userId],
    status: 'active'
  });

  // Increment usage counter atomically
  await UsageService.incrementUsage(organizationId, 'PROJECTS_COUNT');

  res.status(201).json({
    success: true,
    data: project
  });
});

// @desc    Get all projects for organization
// @route   GET /api/projects
// @access  Private
exports.getProjects = asyncHandler(async (req, res) => {
  const { organizationId } = req.user;

  const projects = await Project.find({
    organizationId,
    status: { $ne: 'archived' }
  })
    .populate('createdBy', 'name email')
    .populate('members', 'name email')
    .sort('-createdAt');

  res.json({
    success: true,
    count: projects.length,
    data: projects
  });
});

// @desc    Get single project
// @route   GET /api/projects/:id
// @access  Private
exports.getProject = asyncHandler(async (req, res) => {
  const { organizationId } = req.user;

  const project = await Project.findOne({
    _id: req.params.id,
    organizationId // Tenant isolation
  })
    .populate('createdBy', 'name email')
    .populate('members', 'name email');

  if (!project) {
    throw new ApiError(404, 'Project not found');
  }

  res.json({
    success: true,
    data: project
  });
});

// @desc    Update project
// @route   PUT /api/projects/:id
// @access  Private (ORG_ADMIN)
exports.updateProject = asyncHandler(async (req, res) => {
  const { organizationId } = req.user;
  const { name, description, status } = req.body;

  const project = await Project.findOne({
    _id: req.params.id,
    organizationId
  });

  if (!project) {
    throw new ApiError(404, 'Project not found');
  }

  if (name) project.name = name;
  if (description !== undefined) project.description = description;
  if (status) project.status = status;

  await project.save();

  res.json({
    success: true,
    data: project
  });
});

// @desc    Delete project
// @route   DELETE /api/projects/:id
// @access  Private (ORG_ADMIN)
exports.deleteProject = asyncHandler(async (req, res) => {
  const { organizationId } = req.user;

  const project = await Project.findOne({
    _id: req.params.id,
    organizationId
  });

  if (!project) {
    throw new ApiError(404, 'Project not found');
  }

  await project.deleteOne();

  // Decrement usage counter
  await UsageService.decrementUsage(organizationId, 'PROJECTS_COUNT');

  res.json({
    success: true,
    message: 'Project deleted successfully'
  });
});
