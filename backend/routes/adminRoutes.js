const express = require('express');
const router = express.Router();
const {
  createPlan,
  getPlans,
  updatePlan,
  getPlanDetails,
  getOrganizations,
  updateOrganizationStatus,
  createFeature,
  getFeatures,
  autoExpireSubscriptions,
  getExpiringSubscriptions,
  recordPayment,
  getPayments,
  convertTrialToPaid,
  getSubscriptionHistory
} = require('../controllers/adminController');
const { protect, authorize } = require('../middleware/authMiddleware');

// All routes require SUPER_ADMIN role
router.use(protect);
router.use(authorize('SUPER_ADMIN'));

// Plan routes
router.post('/plans', createPlan);
router.get('/plans', getPlans);
router.get('/plans/:id/details', getPlanDetails);
router.put('/plans/:id', updatePlan);

// Organization routes
router.get('/organizations', getOrganizations);
router.put('/organizations/:id/status', updateOrganizationStatus);

// Feature routes
router.post('/features', createFeature);
router.get('/features', getFeatures);

// Subscription management routes
router.post('/subscriptions/auto-expire', autoExpireSubscriptions);
router.get('/subscriptions/expiring', getExpiringSubscriptions);
router.post('/subscriptions/:id/convert-trial', convertTrialToPaid);
router.get('/subscriptions/:id/history', getSubscriptionHistory);

// Payment management routes
router.post('/payments', recordPayment);
router.get('/payments', getPayments);

module.exports = router;
