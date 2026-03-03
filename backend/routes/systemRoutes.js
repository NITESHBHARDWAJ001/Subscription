const express = require('express');
const router = express.Router();
const { 
  bootstrapSuperAdmin, 
  getBootstrapStatus 
} = require('../controllers/systemController');

/**
 * System Bootstrap Routes
 * 
 * SECURITY NOTICE:
 * - These routes should NOT be exposed in frontend navigation
 * - bootstrapSuperAdmin is a one-time setup endpoint
 * - After first Super Admin is created, endpoint becomes permanently disabled
 */

// Check if bootstrap is needed (public, read-only)
router.get('/bootstrap-status', getBootstrapStatus);

// One-time Super Admin creation (protected by setup key)
router.post('/bootstrap-super-admin', bootstrapSuperAdmin);

module.exports = router;
