const express = require('express');
const router = express.Router();
const {
  createProject,
  getProjects,
  getProject,
  updateProject,
  deleteProject
} = require('../controllers/projectController');
const { protect, authorize } = require('../middleware/authMiddleware');
const tenantIsolation = require('../middleware/tenantMiddleware');
const checkEntitlement = require('../middleware/entitlementMiddleware');

// All routes require authentication and tenant isolation
router.use(protect);
router.use(tenantIsolation);

// Create project - CHECK ENTITLEMENT (Feature + Usage Limit)
router.post(
  '/',
  authorize('ORG_ADMIN'),
  checkEntitlement('CREATE_PROJECT', 'PROJECTS_COUNT'),
  createProject
);

// Get all projects
router.get('/', getProjects);

// Get single project
router.get('/:id', getProject);

// Update project
router.put('/:id', authorize('ORG_ADMIN'), updateProject);

// Delete project
router.delete('/:id', authorize('ORG_ADMIN'), deleteProject);

module.exports = router;
