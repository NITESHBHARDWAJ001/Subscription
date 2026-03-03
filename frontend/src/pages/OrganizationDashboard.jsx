import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { organizationAPI, projectAPI, publicAPI } from '../services/api';
import { 
  FiUsers, 
  FiFolder, 
  FiUserPlus, 
  FiTrendingUp,
  FiPackage,
  FiCheck,
  FiBell,
  FiX
} from 'react-icons/fi';

function OrganizationDashboard() {
  const { user, logout } = useAuth();
  const [subscription, setSubscription] = useState(null);
  const [projects, setProjects] = useState([]);
  const [plans, setPlans] = useState([]);
  const [users, setUsers] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [showNotificationPanel, setShowNotificationPanel] = useState(false);
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [showCreateProject, setShowCreateProject] = useState(false);
  const [showUpgradePlan, setShowUpgradePlan] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [processingPayment, setProcessingPayment] = useState(false);
  const notificationRef = useRef(null);

  const [inviteData, setInviteData] = useState({ email: '', name: '', role: 'USER' });
  const [projectData, setProjectData] = useState({ name: '', description: '' });
  const [paymentData, setPaymentData] = useState({
    cardNumber: '',
    cardName: '',
    expiryMonth: '',
    expiryYear: '',
    cvv: '',
    agreedToTerms: false
  });

  useEffect(() => {
    loadData();
  }, []);

  // Close notification panel when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (notificationRef.current && !notificationRef.current.contains(event.target)) {
        setShowNotificationPanel(false);
      }
    };

    if (showNotificationPanel) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showNotificationPanel]);

  const loadData = async () => {
    try {
      const [subRes, projRes, usersRes, plansRes, notifRes] = await Promise.all([
        organizationAPI.getSubscription(),
        projectAPI.getProjects(),
        organizationAPI.getUsers(),
        publicAPI.getPlans(),
        organizationAPI.getSubscriptionNotifications()
      ]);
      
      setSubscription(subRes.data);
      setProjects(projRes.data);
      setUsers(usersRes.data);
      setPlans(plansRes.data || []);
      setNotifications(notifRes.data?.notifications || []);
    } catch (error) {
      console.error('Error loading data:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleInviteUser = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await organizationAPI.inviteUser(inviteData);
      setShowInviteForm(false);
      setInviteData({ email: '', name: '', role: 'USER' });
      loadData();
      alert('User invited successfully!');
    } catch (error) {
      setError(error.message);
    }
  };

  const handleCreateProject = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await projectAPI.createProject(projectData);
      setShowCreateProject(false);
      setProjectData({ name: '', description: '' });
      loadData();
    } catch (error) {
      setError(error.message);
    }
  };

  const handleUpgrade = async (planId) => {
    // Find the selected plan
    const plan = plans.find(p => p._id === planId);
    if (plan) {
      setSelectedPlan(plan);
      setShowPaymentModal(true);
      setShowUpgradePlan(false);
    }
  };

  const handlePaymentSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Validate payment data
    if (!paymentData.agreedToTerms) {
      setError('Please agree to the Terms of Service and Privacy Policy');
      return;
    }

    if (paymentData.cardNumber.replace(/\s/g, '').length !== 16) {
      setError('Please enter a valid 16-digit card number');
      return;
    }

    if (!paymentData.expiryMonth || !paymentData.expiryYear) {
      setError('Please enter card expiry date');
      return;
    }

    if (paymentData.cvv.length !== 3) {
      setError('Please enter a valid 3-digit CVV');
      return;
    }

    setProcessingPayment(true);

    try {
      // Simulate payment processing delay
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Process the upgrade
      const result = await organizationAPI.upgradeSubscription(selectedPlan._id);
      
      // Reset form and close modal
      setShowPaymentModal(false);
      setSelectedPlan(null);
      setPaymentData({
        cardNumber: '',
        cardName: '',
        expiryMonth: '',
        expiryYear: '',
        cvv: '',
        agreedToTerms: false
      });
      
      // Reload data
      loadData();
      
      // Show success message with remaining days info
      const { remainingDaysAdded, newEndDate } = result.data || {};
      let message = `Successfully upgraded to ${selectedPlan.name} plan! 🎉`;
      
      if (remainingDaysAdded && remainingDaysAdded > 0) {
        message += `\n\n✨ Bonus: ${remainingDaysAdded} remaining day${remainingDaysAdded > 1 ? 's' : ''} from your previous subscription ${remainingDaysAdded > 1 ? 'have' : 'has'} been added!`;
        if (newEndDate) {
          message += `\nYour new subscription expires on ${new Date(newEndDate).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          })}`;
        }
      }
      
      alert(message);
    } catch (error) {
      setError(error.message);
    } finally {
      setProcessingPayment(false);
    }
  };

  const formatCardNumber = (value) => {
    const cleaned = value.replace(/\s/g, '');
    const match = cleaned.match(/.{1,4}/g);
    return match ? match.join(' ') : cleaned;
  };

  const handleCardNumberChange = (e) => {
    const value = e.target.value.replace(/\s/g, '');
    if (/^\d*$/.test(value) && value.length <= 16) {
      setPaymentData({ ...paymentData, cardNumber: formatCardNumber(value) });
    }
  };

  const handleCvvChange = (e) => {
    const value = e.target.value;
    if (/^\d*$/.test(value) && value.length <= 3) {
      setPaymentData({ ...paymentData, cvv: value });
    }
  };

  const handleCancelSubscription = async () => {
    const reason = prompt('Please tell us why you are cancelling (optional):');
    
    if (confirm('Are you sure you want to cancel your subscription? You will retain access until the end of your billing period.')) {
      setError('');
      try {
        await organizationAPI.cancelSubscription(reason || '');
        loadData();
        alert('Subscription cancelled. You will retain access until ' + 
          new Date(subscription.subscription.endDate).toLocaleDateString());
      } catch (error) {
        setError(error.message);
      }
    }
  };

  const handleReactivateSubscription = async () => {
    setError('');
    try {
      await organizationAPI.reactivateSubscription();
      loadData();
      alert('Subscription reactivated successfully!');
    } catch (error) {
      setError(error.message);
    }
  };

  // Helper to get status badge
  const getStatusBadge = (status) => {
    const badges = {
      trialing: { text: 'Trial', color: 'bg-blue-100 text-blue-800' },
      active: { text: 'Active', color: 'bg-green-100 text-green-800' },
      past_due: { text: 'Past Due', color: 'bg-yellow-100 text-yellow-800' },
      cancelled: { text: 'Cancelled', color: 'bg-gray-100 text-gray-800' },
      expired: { text: 'Expired', color: 'bg-red-100 text-red-800' }
    };
    
    const badge = badges[status] || badges.active;
    return (
      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${badge.color}`}>
        {badge.text}
      </span>
    );
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{user?.organizationName}</h1>
              <p className="text-sm text-gray-600">{user?.role} Dashboard</p>
            </div>
            <div className="flex items-center gap-4">
              {/* Notification Bell */}
              <div className="relative" ref={notificationRef}>
                <button
                  onClick={() => setShowNotificationPanel(!showNotificationPanel)}
                  className="relative p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                  aria-label="Notifications"
                >
                  <FiBell className="text-2xl" />
                  {notifications.length > 0 && (
                    <span className="absolute top-0 right-0 inline-flex items-center justify-center w-5 h-5 text-xs font-bold text-white bg-red-600 rounded-full">
                      {notifications.length}
                    </span>
                  )}
                </button>

                {/* Notification Dropdown Panel */}
                {showNotificationPanel && (
                  <div className="absolute right-0 mt-2 w-96 bg-white rounded-lg shadow-2xl border border-gray-200 z-50 max-h-96 overflow-y-auto">
                    <div className="sticky top-0 bg-white border-b border-gray-200 px-4 py-3 flex justify-between items-center">
                      <h3 className="font-semibold text-gray-900">Notifications</h3>
                      <button
                        onClick={() => setShowNotificationPanel(false)}
                        className="text-gray-500 hover:text-gray-700"
                      >
                        <FiX className="text-xl" />
                      </button>
                    </div>

                    {notifications.length === 0 ? (
                      <div className="p-8 text-center">
                        <FiBell className="mx-auto text-4xl text-gray-300 mb-3" />
                        <p className="text-gray-500 text-sm">No notifications</p>
                        <p className="text-gray-400 text-xs mt-1">You're all caught up!</p>
                      </div>
                    ) : (
                      <div className="divide-y divide-gray-100">
                        {notifications.map((notif, index) => (
                          <div
                            key={index}
                            className={`p-4 hover:bg-gray-50 transition-colors ${
                              notif.severity === 'high' ? 'bg-red-50' : 'bg-yellow-50'
                            }`}
                          >
                            <div className="flex items-start gap-3">
                              <div
                                className={`mt-1 w-2 h-2 rounded-full flex-shrink-0 ${
                                  notif.severity === 'high' ? 'bg-red-500' : 'bg-yellow-500'
                                }`}
                              />
                              <div className="flex-1 min-w-0">
                                <p
                                  className={`font-semibold text-sm mb-1 ${
                                    notif.severity === 'high' ? 'text-red-900' : 'text-yellow-900'
                                  }`}
                                >
                                  {notif.title}
                                </p>
                                <p
                                  className={`text-sm mb-2 ${
                                    notif.severity === 'high' ? 'text-red-700' : 'text-yellow-700'
                                  }`}
                                >
                                  {notif.message}
                                </p>
                                {notif.daysRemaining !== undefined && notif.daysRemaining >= 0 && (
                                  <p
                                    className={`text-xs font-medium mb-2 ${
                                      notif.severity === 'high' ? 'text-red-600' : 'text-yellow-600'
                                    }`}
                                  >
                                    {notif.daysRemaining === 0
                                      ? '⏰ Expires today!'
                                      : `⏱️ ${notif.daysRemaining} day${
                                          notif.daysRemaining > 1 ? 's' : ''
                                        } remaining`}
                                  </p>
                                )}
                                {notif.actionRequired && user?.role === 'ORG_ADMIN' && (
                                  <button
                                    onClick={() => {
                                      setShowNotificationPanel(false);
                                      if (
                                        notif.type === 'subscription_expired' ||
                                        notif.type === 'grace_period'
                                      ) {
                                        handleReactivateSubscription();
                                      } else {
                                        setShowUpgradePlan(true);
                                      }
                                    }}
                                    className={`text-xs px-3 py-1.5 rounded font-medium ${
                                      notif.severity === 'high'
                                        ? 'bg-red-600 hover:bg-red-700 text-white'
                                        : 'bg-yellow-600 hover:bg-yellow-700 text-white'
                                    }`}
                                  >
                                    {notif.actionText || 'Take Action'}
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <button onClick={logout} className="btn-secondary">
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg mb-4">
            {error}
          </div>
        )}

        {/* Subscription Notifications */}
        {notifications && notifications.length > 0 && (
          <div className="mb-6 space-y-3">
            {notifications.map((notif, index) => (
              <div
                key={index}
                className={`rounded-lg border-l-4 p-4 ${
                  notif.severity === 'high'
                    ? 'bg-red-50 border-red-500'
                    : 'bg-yellow-50 border-yellow-500'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3
                      className={`font-semibold mb-1 ${
                        notif.severity === 'high' ? 'text-red-800' : 'text-yellow-800'
                      }`}
                    >
                      {notif.title}
                    </h3>
                    <p
                      className={`text-sm mb-2 ${
                        notif.severity === 'high' ? 'text-red-700' : 'text-yellow-700'
                      }`}
                    >
                      {notif.message}
                    </p>
                    {notif.daysRemaining !== undefined && notif.daysRemaining >= 0 && (
                      <p
                        className={`text-xs font-medium ${
                          notif.severity === 'high' ? 'text-red-600' : 'text-yellow-600'
                        }`}
                      >
                        {notif.daysRemaining === 0
                          ? 'Expires today!'
                          : `${notif.daysRemaining} day${notif.daysRemaining > 1 ? 's' : ''} remaining`}
                      </p>
                    )}
                  </div>
                  {notif.actionRequired && user?.role === 'ORG_ADMIN' && (
                    <button
                      onClick={() => {
                        if (notif.type === 'subscription_expired' || notif.type === 'grace_period') {
                          handleReactivateSubscription();
                        } else {
                          setShowUpgradePlan(true);
                        }
                      }}
                      className={`ml-4 px-4 py-2 rounded-lg font-medium text-sm whitespace-nowrap ${
                        notif.severity === 'high'
                          ? 'bg-red-600 hover:bg-red-700 text-white'
                          : 'bg-yellow-600 hover:bg-yellow-700 text-white'
                      }`}
                    >
                      {notif.actionText || 'Take Action'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Subscription Info */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Current Plan</h3>
              <FiPackage className="text-primary-600 text-2xl" />
            </div>
            
            <div className="flex items-center gap-2 mb-2">
              <p className="text-2xl font-bold text-primary-600">
                {subscription?.subscription?.planId?.name}
              </p>
              {subscription?.subscription?.status && getStatusBadge(subscription.subscription.status)}
            </div>

            <p className="text-sm text-gray-600 mb-2">
              ${subscription?.subscription?.planId?.price}/{subscription?.subscription?.planId?.billingCycle}
            </p>

            {/* Trial Period Info */}
            {subscription?.subscription?.isTrialing && subscription?.subscription?.trialEndDate && (
              <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-xs font-semibold text-blue-800 mb-1">Trial Period</p>
                <p className="text-sm text-blue-700">
                  Ends on {new Date(subscription.subscription.trialEndDate).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric'
                  })}
                </p>
                <p className="text-xs text-blue-600 mt-1">
                  ({Math.ceil((new Date(subscription.subscription.trialEndDate) - new Date()) / (1000 * 60 * 60 * 24))} days remaining)
                </p>
              </div>
            )}

            {/* Grace Period Warning */}
            {subscription?.subscription?.status === 'past_due' && subscription?.subscription?.gracePeriodEndDate && (
              <div className="mb-3 p-3 bg-yellow-50 border border-yellow-300 rounded-lg">
                <p className="text-xs font-semibold text-yellow-800 mb-1">⚠️ Grace Period</p>
                <p className="text-sm text-yellow-700">
                  Payment required before {new Date(subscription.subscription.gracePeriodEndDate).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric'
                  })}
                </p>
                <p className="text-xs text-yellow-600 mt-1">
                  Your subscription will expire in {Math.ceil((new Date(subscription.subscription.gracePeriodEndDate) - new Date()) / (1000 * 60 * 60 * 24))} days without payment
                </p>
              </div>
            )}

            {/* Cancellation Notice */}
            {subscription?.subscription?.willCancelAt && (
              <div className="mb-3 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                <p className="text-xs font-semibold text-orange-800 mb-1">Scheduled Cancellation</p>
                <p className="text-sm text-orange-700">
                  Will cancel on {new Date(subscription.subscription.willCancelAt).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric'
                  })}
                </p>
                {subscription?.subscription?.cancellationReason && (
                  <p className="text-xs text-orange-600 mt-1">
                    Reason: {subscription.subscription.cancellationReason}
                  </p>
                )}
              </div>
            )}

            {/* Expiration Date (for active subscriptions) */}
            {subscription?.subscription?.endDate && !subscription?.subscription?.willCancelAt && (
              <div className="mb-4">
                <p className="text-xs text-gray-500">
                  {subscription?.subscription?.isTrialing ? 'Trial expires on:' : 'Renews on:'}
                </p>
                <p className="text-sm font-medium text-gray-700">
                  {new Date(subscription.subscription.endDate).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </p>
                {!subscription?.subscription?.isTrialing && (
                  <p className="text-xs text-gray-500 mt-1">
                    ({Math.ceil((new Date(subscription.subscription.endDate) - new Date()) / (1000 * 60 * 60 * 24))} days remaining)
                  </p>
                )}
              </div>
            )}

            {/* Action Buttons */}
            {user?.role === 'ORG_ADMIN' && (
              <div className="space-y-2">
                <button
                  onClick={() => setShowUpgradePlan(true)}
                  className="btn-primary text-sm flex items-center w-full justify-center"
                >
                  <FiTrendingUp className="mr-2" />
                  Change Plan
                </button>
                
                {subscription?.subscription?.willCancelAt ? (
                  <button
                    onClick={handleReactivateSubscription}
                    className="btn-secondary text-sm w-full"
                  >
                    Reactivate Subscription
                  </button>
                ) : subscription?.subscription?.status !== 'cancelled' && subscription?.subscription?.status !== 'expired' && (
                  <button
                    onClick={handleCancelSubscription}
                    className="text-sm text-red-600 hover:text-red-700 w-full text-center py-2"
                  >
                    Cancel Subscription
                  </button>
                )}
              </div>
            )}
          </div>

          {subscription?.usage?.map((metric) => (
            <div key={metric.metricKey} className="card">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-gray-600">{metric.metricName}</h3>
                {metric.metricKey === 'PROJECTS_COUNT' ? (
                  <FiFolder className="text-primary-600 text-xl" />
                ) : (
                  <FiUsers className="text-primary-600 text-xl" />
                )}
              </div>
              <p className="text-3xl font-bold text-gray-900">
                {metric.current}
                <span className="text-lg text-gray-500 font-normal"> / {metric.limit}</span>
              </p>
              <div className="mt-3 w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-primary-600 h-2 rounded-full"
                  style={{ width: `${(metric.current / metric.limit) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>

        {/* Actions */}
        {user?.role === 'ORG_ADMIN' && (
          <div className="flex space-x-4 mb-6">
            <button
              onClick={() => setShowCreateProject(true)}
              className="btn-primary flex items-center"
            >
              <FiFolder className="mr-2" />
              Create Project
            </button>
            <button
              onClick={() => setShowInviteForm(true)}
              className="btn-primary flex items-center"
            >
              <FiUserPlus className="mr-2" />
              Invite User
            </button>
          </div>
        )}

        {/* Invite User Form */}
        {showInviteForm && (
          <div className="card mb-6">
            <h3 className="text-lg font-semibold mb-4">Invite New User</h3>
            <form onSubmit={handleInviteUser} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Name</label>
                  <input
                    type="text"
                    className="input"
                    value={inviteData.name}
                    onChange={(e) => setInviteData({ ...inviteData, name: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="label">Email</label>
                  <input
                    type="email"
                    className="input"
                    value={inviteData.email}
                    onChange={(e) => setInviteData({ ...inviteData, email: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div>
                <label className="label">Role</label>
                <select
                  className="input"
                  value={inviteData.role}
                  onChange={(e) => setInviteData({ ...inviteData, role: e.target.value })}
                >
                  <option value="USER">User</option>
                  <option value="ORG_ADMIN">Org Admin</option>
                </select>
              </div>
              <div className="flex space-x-2">
                <button type="submit" className="btn-primary">Send Invite</button>
                <button
                  type="button"
                  onClick={() => setShowInviteForm(false)}
                  className="btn-secondary"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Create Project Form */}
        {showCreateProject && (
          <div className="card mb-6">
            <h3 className="text-lg font-semibold mb-4">Create New Project</h3>
            <form onSubmit={handleCreateProject} className="space-y-4">
              <div>
                <label className="label">Project Name</label>
                <input
                  type="text"
                  className="input"
                  value={projectData.name}
                  onChange={(e) => setProjectData({ ...projectData, name: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="label">Description</label>
                <textarea
                  className="input"
                  value={projectData.description}
                  onChange={(e) => setProjectData({ ...projectData, description: e.target.value })}
                  rows="3"
                />
              </div>
              <div className="flex space-x-2">
                <button type="submit" className="btn-primary">Create Project</button>
                <button
                  type="button"
                  onClick={() => setShowCreateProject(false)}
                  className="btn-secondary"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Upgrade Plan Modal */}
        {showUpgradePlan && (
          <div className="card mb-6">
            <h3 className="text-lg font-semibold mb-4">Change Your Plan</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {plans.filter(p => p._id !== subscription?.subscription?.planId?._id).map((plan) => (
                <div key={plan._id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow relative">
                  {/* Trial Badge */}
                  {plan.hasTrialPeriod && (
                    <div className="absolute top-2 right-2">
                      <span className="px-2 py-1 text-xs font-semibold bg-blue-100 text-blue-800 rounded-full">
                        {plan.trialDays || 14}-day trial
                      </span>
                    </div>
                  )}
                  
                  <h4 className="text-lg font-bold mb-2">{plan.name}</h4>
                  <p className="text-2xl font-bold text-primary-600 mb-1">
                    ${plan.price}
                    <span className="text-sm font-normal text-gray-500">/{plan.billingCycle}</span>
                  </p>
                  <p className="text-xs text-gray-500 mb-3">Valid for {plan.durationDays} days</p>
                  <p className="text-sm text-gray-600 mb-3">{plan.description}</p>
                  
                  {/* Features */}
                  {plan.features && plan.features.length > 0 && (
                    <div className="mb-3">
                      <p className="text-xs font-semibold text-gray-700 mb-2">Features:</p>
                      <ul className="space-y-1">
                        {plan.features.map((feature, idx) => {
                          // Find if this feature has a specific limit
                          const featureLimit = plan.limits?.find(l => 
                            l.featureId && (l.featureId._id === feature._id || l.featureId === feature._id)
                          );
                          
                          return (
                            <li key={idx} className="text-xs text-gray-600">
                              <div className="flex items-start">
                                <FiCheck className="text-green-500 mr-1 mt-0.5 flex-shrink-0" />
                                <span>{feature.name}</span>
                              </div>
                              {featureLimit && (
                                <div className="ml-5 text-[10px] text-gray-500">
                                  ↳ {featureLimit.metricName}: {featureLimit.limit}
                                </div>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  )}
                  
                  {/* Plan-Level Limits */}
                  {plan.limits && plan.limits.filter(l => !l.featureId).length > 0 && (
                    <div className="mb-4">
                      <p className="text-xs font-semibold text-gray-700 mb-2">Plan Limits:</p>
                      <ul className="space-y-1">
                        {plan.limits.filter(l => !l.featureId).map((limit, idx) => (
                          <li key={idx} className="text-xs text-gray-600">
                            • {limit.limit} {limit.metricName}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  
                  <button
                    onClick={() => handleUpgrade(plan._id)}
                    className="btn-primary w-full text-sm"
                  >
                    Switch to {plan.name}
                  </button>
                </div>
              ))}
            </div>
            <button
              onClick={() => setShowUpgradePlan(false)}
              className="btn-secondary mt-4"
            >
              Cancel
            </button>
          </div>
        )}

        {/* Payment Modal */}
        {showPaymentModal && selectedPlan && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                {/* Header */}
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">Complete Your Plan Change</h2>
                    <p className="text-sm text-gray-600">Review details and complete payment</p>
                  </div>
                  <button
                    onClick={() => {
                      setShowPaymentModal(false);
                      setSelectedPlan(null);
                      setShowUpgradePlan(true);
                    }}
                    className="text-gray-400 hover:text-gray-600 text-2xl"
                    disabled={processingPayment}
                  >
                    ×
                  </button>
                </div>

                {error && (
                  <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg mb-4">
                    {error}
                  </div>
                )}

                {/* Plan Comparison */}
                <div className="grid grid-cols-2 gap-4 mb-6">
                  {/* Current Plan */}
                  <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                    <p className="text-xs text-gray-500 mb-2">Current Plan</p>
                    <h3 className="text-lg font-bold text-gray-900 mb-1">
                      {subscription?.subscription?.planId?.name}
                    </h3>
                    <p className="text-2xl font-bold text-gray-600">
                      ${subscription?.subscription?.planId?.price}
                      <span className="text-sm font-normal text-gray-500">
                        /{subscription?.subscription?.planId?.billingCycle}
                      </span>
                    </p>
                  </div>

                  {/* New Plan */}
                  <div className="border-2 border-primary-600 rounded-lg p-4 bg-primary-50">
                    <p className="text-xs text-primary-600 font-semibold mb-2">New Plan</p>
                    <h3 className="text-lg font-bold text-gray-900 mb-1">
                      {selectedPlan.name}
                    </h3>
                    <p className="text-2xl font-bold text-primary-600">
                      ${selectedPlan.price}
                      <span className="text-sm font-normal text-gray-600">
                        /{selectedPlan.billingCycle}
                      </span>
                    </p>
                    {selectedPlan.hasTrialPeriod && (
                      <div className="mt-2">
                        <span className="px-2 py-1 text-xs font-semibold bg-blue-100 text-blue-800 rounded-full">
                          {selectedPlan.trialDays}-day free trial
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Plan Features */}
                <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                  <h4 className="text-sm font-semibold text-gray-900 mb-3">What's included:</h4>
                  <div className="grid grid-cols-2 gap-3">
                    {selectedPlan.features && selectedPlan.features.map((feature, idx) => (
                      <div key={idx} className="flex items-start text-sm">
                        <FiCheck className="text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                        <span className="text-gray-700">{feature.name}</span>
                      </div>
                    ))}
                    {selectedPlan.limits && selectedPlan.limits.filter(l => !l.featureId).map((limit, idx) => (
                      <div key={`limit-${idx}`} className="flex items-start text-sm">
                        <FiCheck className="text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                        <span className="text-gray-700">{limit.limit} {limit.metricName}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Payment Form */}
                <form onSubmit={handlePaymentSubmit}>
                  <div className="mb-6">
                    <h4 className="text-lg font-semibold text-gray-900 mb-4">Payment Information</h4>
                    
                    <div className="space-y-4">
                      {/* Card Number */}
                      <div>
                        <label className="label">Card Number</label>
                        <input
                          type="text"
                          className="input font-mono"
                          placeholder="1234 5678 9012 3456"
                          value={paymentData.cardNumber}
                          onChange={handleCardNumberChange}
                          maxLength="19"
                          required
                          disabled={processingPayment}
                        />
                      </div>

                      {/* Cardholder Name */}
                      <div>
                        <label className="label">Cardholder Name</label>
                        <input
                          type="text"
                          className="input"
                          placeholder="John Doe"
                          value={paymentData.cardName}
                          onChange={(e) => setPaymentData({ ...paymentData, cardName: e.target.value })}
                          required
                          disabled={processingPayment}
                        />
                      </div>

                      {/* Expiry and CVV */}
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <label className="label">Expiry Month</label>
                          <select
                            className="input"
                            value={paymentData.expiryMonth}
                            onChange={(e) => setPaymentData({ ...paymentData, expiryMonth: e.target.value })}
                            required
                            disabled={processingPayment}
                          >
                            <option value="">MM</option>
                            {Array.from({ length: 12 }, (_, i) => i + 1).map(month => (
                              <option key={month} value={month.toString().padStart(2, '0')}>
                                {month.toString().padStart(2, '0')}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="label">Expiry Year</label>
                          <select
                            className="input"
                            value={paymentData.expiryYear}
                            onChange={(e) => setPaymentData({ ...paymentData, expiryYear: e.target.value })}
                            required
                            disabled={processingPayment}
                          >
                            <option value="">YYYY</option>
                            {Array.from({ length: 10 }, (_, i) => new Date().getFullYear() + i).map(year => (
                              <option key={year} value={year}>
                                {year}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="label">CVV</label>
                          <input
                            type="text"
                            className="input font-mono"
                            placeholder="123"
                            value={paymentData.cvv}
                            onChange={handleCvvChange}
                            maxLength="3"
                            required
                            disabled={processingPayment}
                          />
                        </div>
                      </div>

                      {/* Billing Summary */}
                      <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-sm text-gray-600">Subtotal</span>
                          <span className="text-sm font-medium text-gray-900">
                            ${selectedPlan.price}
                          </span>
                        </div>
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-sm text-gray-600">Tax (0%)</span>
                          <span className="text-sm font-medium text-gray-900">$0.00</span>
                        </div>
                        <div className="border-t border-gray-300 pt-2 mt-2">
                          <div className="flex justify-between items-center">
                            <span className="text-base font-semibold text-gray-900">Total Due Today</span>
                            <span className="text-xl font-bold text-primary-600">
                              ${selectedPlan.hasTrialPeriod ? '0.00' : selectedPlan.price}
                            </span>
                          </div>
                          {selectedPlan.hasTrialPeriod && (
                            <p className="text-xs text-gray-500 mt-1 text-right">
                              You'll be charged ${selectedPlan.price} after the {selectedPlan.trialDays}-day trial
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Terms and Privacy */}
                      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                        <h5 className="text-sm font-semibold text-gray-900 mb-2">Terms of Service & Privacy Policy</h5>
                        <div className="text-xs text-gray-700 space-y-2 mb-3 max-h-40 overflow-y-auto">
                          <p><strong>1. Subscription Terms:</strong> By subscribing to the {selectedPlan.name} plan, you agree to pay ${selectedPlan.price} per {selectedPlan.billingCycle}. Your subscription will automatically renew unless cancelled.</p>
                          <p><strong>2. Cancellation Policy:</strong> You may cancel your subscription at any time. You will retain access until the end of your billing period.</p>
                          <p><strong>3. Refund Policy:</strong> Payments are non-refundable except as required by law or at our sole discretion.</p>
                          <p><strong>4. Privacy:</strong> We collect and process your payment information securely. Your data will not be shared with third parties except as necessary to process payments.</p>
                          <p><strong>5. Plan Changes:</strong> Your new plan takes effect immediately. Any unused portion of your previous plan will not be refunded or prorated.</p>
                        </div>
                        
                        <label className="flex items-start cursor-pointer">
                          <input
                            type="checkbox"
                            className="mt-1 mr-2 rounded"
                            checked={paymentData.agreedToTerms}
                            onChange={(e) => setPaymentData({ ...paymentData, agreedToTerms: e.target.checked })}
                            required
                            disabled={processingPayment}
                          />
                          <span className="text-sm text-gray-700">
                            I agree to the Terms of Service and Privacy Policy, and authorize this payment
                          </span>
                        </label>
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setShowPaymentModal(false);
                        setSelectedPlan(null);
                        setShowUpgradePlan(true);
                      }}
                      className="btn-secondary flex-1"
                      disabled={processingPayment}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="btn-primary flex-1 flex items-center justify-center"
                      disabled={processingPayment || !paymentData.agreedToTerms}
                    >
                      {processingPayment ? (
                        <>
                          <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Processing...
                        </>
                      ) : (
                        `Complete Payment - $${selectedPlan.hasTrialPeriod ? '0.00' : selectedPlan.price}`
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* Projects List */}
        <div className="card mb-6">
          <h3 className="text-lg font-semibold mb-4">Projects</h3>
          {projects.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No projects yet</p>
          ) : (
            <div className="space-y-3">
              {projects.map((project) => (
                <div key={project._id} className="border border-gray-200 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-900">{project.name}</h4>
                  <p className="text-sm text-gray-600 mt-1">{project.description}</p>
                  <div className="flex items-center mt-2 text-xs text-gray-500">
                    <FiUsers className="mr-1" />
                    {project.members?.length || 0} members
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Team Members */}
        <div className="card">
          <h3 className="text-lg font-semibold mb-4">Team Members</h3>
          <div className="space-y-2">
            {users.map((u) => (
              <div key={u._id} className="flex justify-between items-center py-2 border-b border-gray-100">
                <div>
                  <p className="font-medium text-gray-900">{u.name}</p>
                  <p className="text-sm text-gray-500">{u.email}</p>
                </div>
                <span className="px-3 py-1 text-xs font-medium rounded-full bg-primary-100 text-primary-800">
                  {u.role}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default OrganizationDashboard;
