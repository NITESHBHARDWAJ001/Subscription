const express = require('express');
const router = express.Router();
const { getPublicPlans } = require('../controllers/publicController');
const { protect } = require('../middleware/authMiddleware');

// All routes require authentication but not specific roles
router.use(protect);

// Get all active plans (for upgrade selection)
router.get('/plans', getPublicPlans);

module.exports = router;
