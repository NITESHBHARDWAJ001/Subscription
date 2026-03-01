const express = require('express');
const router = express.Router();
const {
  inviteUser,
  getSubscription,
  upgradeSubscription,
  cancelSubscription,
  reactivateSubscription,
  getSubscriptionHistory,
  getUsers
} = require('../controllers/organizationController');
const { protect, authorize } = require('../middleware/authMiddleware');
const tenantIsolation = require('../middleware/tenantMiddleware');

// All routes require authentication and tenant isolation
router.use(protect);
router.use(tenantIsolation);

// Invite user - ORG_ADMIN only
router.post('/invite', authorize('ORG_ADMIN'), inviteUser);

// Get users - ORG_ADMIN only
router.get('/users', authorize('ORG_ADMIN'), getUsers);

// Subscription routes - any authenticated user can view
router.get('/subscription', getSubscription);
router.get('/subscription/history', getSubscriptionHistory);

// Upgrade/Cancel/Reactivate subscription - ORG_ADMIN only
router.put('/subscription/upgrade', authorize('ORG_ADMIN'), upgradeSubscription);
router.put('/subscription/cancel', authorize('ORG_ADMIN'), cancelSubscription);
router.put('/subscription/reactivate', authorize('ORG_ADMIN'), reactivateSubscription);

module.exports = router;
