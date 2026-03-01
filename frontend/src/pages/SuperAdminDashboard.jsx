import { useState, useEffect } from 'react';
import { adminAPI } from '../services/api';
import { FiPlus, FiEdit, FiBriefcase, FiCheck, FiX, FiLock, FiUnlock, FiUsers, FiTrendingUp, FiDollarSign, FiClock, FiAlertCircle, FiPackage } from 'react-icons/fi';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

function SuperAdminDashboard() {
  const [plans, setPlans] = useState([]);
  const [organizations, setOrganizations] = useState([]);
  const [features, setFeatures] = useState([]);
  const [showCreatePlan, setShowCreatePlan] = useState(false);
  const [editingPlan, setEditingPlan] = useState(null);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [planDetails, setPlanDetails] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const { logout } = useAuth();
  const navigate = useNavigate();

  const [newPlan, setNewPlan] = useState({
    name: '',
    slug: '',
    description: '',
    price: '',
    billingCycle: 'monthly',
    durationDays: 30,
    features: [],
    limits: [
      { metricKey: 'PROJECTS_COUNT', metricName: 'projects', limit: 0 },
      { metricKey: 'USERS_COUNT', metricName: 'users', limit: 0 }
    ],
    featureLimits: {}  // { featureId: { metricKey, metricName, limit } }
  });

  const [editPlanData, setEditPlanData] = useState({
    name: '',
    description: '',
    price: '',
    billingCycle: 'monthly',
    durationDays: 30,
    isActive: true
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [plansRes, orgsRes, featuresRes] = await Promise.all([
        adminAPI.getPlans(),
        adminAPI.getOrganizations(),
        adminAPI.getFeatures()
      ]);
      setPlans(plansRes.data);
      setOrganizations(orgsRes.data);
      setFeatures(featuresRes.data);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePlan = async (e) => {
    e.preventDefault();
    try {
      // Convert feature limits object to array format with featureId
      const allLimits = [
        ...newPlan.limits.map(l => ({
          ...l,
          limit: parseInt(l.limit),
          featureId: null  // Plan-level limits
        })),
        ...Object.entries(newPlan.featureLimits).map(([featureId, limitData]) => ({
          featureId,
          metricKey: limitData.metricKey,
          metricName: limitData.metricName,
          limit: parseInt(limitData.limit) || 0
        }))
      ];

      await adminAPI.createPlan({
        ...newPlan,
        price: parseFloat(newPlan.price),
        limits: allLimits
      });
      setShowCreatePlan(false);
      setNewPlan({
        name: '',
        slug: '',
        description: '',
        price: '',
        billingCycle: 'monthly',
        durationDays: 30,
        features: [],
        limits: [
          { metricKey: 'PROJECTS_COUNT', metricName: 'projects', limit: 0 },
          { metricKey: 'USERS_COUNT', metricName: 'users', limit: 0 }
        ],
        featureLimits: {}
      });
      loadData();
    } catch (error) {
      alert(error.message);
    }
  };

  const startEditPlan = (plan) => {
    // Separate plan-level limits from feature-specific limits
    const planLevelLimits = plan.limits?.filter(l => !l.featureId) || [];
    const featureSpecificLimits = plan.limits?.filter(l => l.featureId) || [];
    
    // Convert feature-specific limits to featureLimits object
    const featureLimitsObj = {};
    featureSpecificLimits.forEach(limit => {
      const featureId = limit.featureId._id || limit.featureId;
      featureLimitsObj[featureId] = {
        metricKey: limit.metricKey,
        metricName: limit.metricName,
        limit: limit.limit
      };
    });
    
    setEditingPlan(plan._id);
    setEditPlanData({
      name: plan.name,
      description: plan.description,
      price: plan.price,
      billingCycle: plan.billingCycle,
      durationDays: plan.durationDays || 30,
      isActive: plan.isActive,
      features: plan.features?.map(f => f._id || f) || [],
      limits: planLevelLimits.length > 0 ? planLevelLimits : [
        { metricKey: 'PROJECTS_COUNT', metricName: 'projects', limit: 0 },
        { metricKey: 'USERS_COUNT', metricName: 'users', limit: 0 }
      ],
      featureLimits: featureLimitsObj
    });
    setShowCreatePlan(false);
  };

  const handleEditPlan = async (e) => {
    e.preventDefault();
    try {
      // Convert feature limits object to array format with featureId
      const allLimits = [
        ...(editPlanData.limits?.map(l => ({
          ...l,
          limit: parseInt(l.limit),
          featureId: null  // Plan-level limits
        })) || []),
        ...Object.entries(editPlanData.featureLimits || {}).map(([featureId, limitData]) => ({
          featureId,
          metricKey: limitData.metricKey,
          metricName: limitData.metricName,
          limit: parseInt(limitData.limit) || 0
        }))
      ];
      
      await adminAPI.updatePlan(editingPlan, {
        ...editPlanData,
        price: parseFloat(editPlanData.price),
        limits: allLimits
      });
      setEditingPlan(null);
      loadData();
    } catch (error) {
      alert(error.message);
    }
  };

  const cancelEdit = () => {
    setEditingPlan(null);
    setEditPlanData({
      name: '',
      description: '',
      price: '',
      billingCycle: 'monthly',
      isActive: true
    });
  };

  const handleToggleOrgStatus = async (orgId, currentStatus) => {
    try {
      const newStatus = currentStatus === 'active' ? 'suspended' : 'active';
      await adminAPI.updateOrganizationStatus(orgId, newStatus);
      loadData();
    } catch (error) {
      alert(error.message);
    }
  };

  const handlePlanClick = async (plan) => {
    if (editingPlan === plan._id) return; // Don't open details if editing
    setSelectedPlan(plan);
    await loadPlanDetails(plan._id);
  };

  const loadPlanDetails = async (planId) => {
    setDetailsLoading(true);
    try {
      const response = await adminAPI.getPlanDetails(planId);
      setPlanDetails(response.data);
    } catch (error) {
      console.error('Error loading plan details:', error);
      alert(error.response?.data?.message || error.message);
    } finally {
      setDetailsLoading(false);
    }
  };

  const closePlanDetails = () => {
    setSelectedPlan(null);
    setPlanDetails(null);
  };

  const getStatusBadge = (status) => {
    const badges = {
      trialing: { text: 'Trial', color: 'bg-blue-100 text-blue-800', icon: FiClock },
      active: { text: 'Active', color: 'bg-green-100 text-green-800', icon: FiCheck },
      past_due: { text: 'Past Due', color: 'bg-yellow-100 text-yellow-800', icon: FiAlertCircle }
    };
    
    const badge = badges[status] || badges.active;
    const Icon = badge.icon;
    
    return (
      <span className={`inline-flex items-center px-2 py-1 text-xs font-semibold rounded-full ${badge.color}`}>
        <Icon className="mr-1" size={12} />
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
            <h1 className="text-2xl font-bold text-gray-900">Super Admin Dashboard</h1>
            <button onClick={logout} className="btn-secondary">
              Logout
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Plans Section */}
        <div className="mb-8">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-gray-900">Subscription Plans</h2>
            <button
              onClick={() => setShowCreatePlan(!showCreatePlan)}
              className="btn-primary flex items-center"
            >
              <FiPlus className="mr-2" />
              Create Plan
            </button>
          </div>

          {showCreatePlan && (
            <div className="card mb-6">
              <h3 className="text-lg font-semibold mb-4">Create New Plan</h3>
              <form onSubmit={handleCreatePlan} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">Plan Name</label>
                    <input
                      type="text"
                      className="input"
                      value={newPlan.name}
                      onChange={(e) => setNewPlan({ ...newPlan, name: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <label className="label">Slug</label>
                    <input
                      type="text"
                      className="input"
                      value={newPlan.slug}
                      onChange={(e) => setNewPlan({ ...newPlan, slug: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="label">Description</label>
                  <textarea
                    className="input"
                    value={newPlan.description}
                    onChange={(e) => setNewPlan({ ...newPlan, description: e.target.value })}
                    rows="2"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">Price</label>
                    <input
                      type="number"
                      className="input"
                      value={newPlan.price}
                      onChange={(e) => setNewPlan({ ...newPlan, price: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <label className="label">Billing Cycle</label>
                    <select
                      className="input"
                      value={newPlan.billingCycle}
                      onChange={(e) => {
                        const cycle = e.target.value;
                        const defaultDuration = cycle === 'yearly' ? 365 : cycle === 'custom' ? newPlan.durationDays : 30;
                        setNewPlan({ ...newPlan, billingCycle: cycle, durationDays: defaultDuration });
                      }}
                    >
                      <option value="monthly">Monthly</option>
                      <option value="yearly">Yearly</option>
                      <option value="custom">Custom</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="label">Subscription Duration (Days)</label>
                  <input
                    type="number"
                    min="1"
                    className="input"
                    value={newPlan.durationDays}
                    onChange={(e) => setNewPlan({ ...newPlan, durationDays: parseInt(e.target.value) || 30 })}
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    How long the subscription will be valid (e.g., 30 days for monthly, 365 for yearly)
                  </p>
                </div>

                {/* Features Section */}
                <div>
                  <label className="label mb-2">Features</label>
                  <div className="border border-gray-200 rounded-lg p-4 space-y-3 bg-gray-50">
                    {features.length === 0 ? (
                      <p className="text-sm text-gray-500">No features available. Create features first.</p>
                    ) : (
                      features.map((feature) => (
                        <div key={feature._id} className="border-b border-gray-200 pb-3 last:border-b-0 last:pb-0">
                          <label className="flex items-center space-x-2 cursor-pointer mb-2">
                            <input
                              type="checkbox"
                              checked={newPlan.features.includes(feature._id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setNewPlan({ 
                                    ...newPlan, 
                                    features: [...newPlan.features, feature._id] 
                                  });
                                } else {
                                  const updatedFeatureLimits = { ...newPlan.featureLimits };
                                  delete updatedFeatureLimits[feature._id];
                                  setNewPlan({ 
                                    ...newPlan, 
                                    features: newPlan.features.filter(id => id !== feature._id),
                                    featureLimits: updatedFeatureLimits
                                  });
                                }
                              }}
                              className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                            />
                            <span className="text-sm font-medium text-gray-700">{feature.name}</span>
                            <span className="text-xs text-gray-500">({feature.key})</span>
                          </label>
                          
                          {/* Feature-specific limit input (only shown when feature is checked) */}
                          {newPlan.features.includes(feature._id) && (
                            <div className="ml-6 mt-2 bg-white rounded p-3 border border-gray-200">
                              <p className="text-xs font-medium text-gray-600 mb-2">Feature Limit (Optional)</p>
                              <div className="grid grid-cols-3 gap-2">
                                <input
                                  type="text"
                                  placeholder="Metric Key"
                                  className="input text-xs"
                                  value={newPlan.featureLimits[feature._id]?.metricKey || ''}
                                  onChange={(e) => {
                                    setNewPlan({
                                      ...newPlan,
                                      featureLimits: {
                                        ...newPlan.featureLimits,
                                        [feature._id]: {
                                          ...(newPlan.featureLimits[feature._id] || {}),
                                          metricKey: e.target.value.toUpperCase().replace(/\s+/g, '_'),
                                          metricName: e.target.value.toLowerCase().replace(/_/g, ' ')
                                        }
                                      }
                                    });
                                  }}
                                />
                                <input
                                  type="number"
                                  min="0"
                                  placeholder="Limit"
                                  className="input text-xs"
                                  value={newPlan.featureLimits[feature._id]?.limit || ''}
                                  onChange={(e) => {
                                    const currentLimit = newPlan.featureLimits[feature._id] || {};
                                    setNewPlan({
                                      ...newPlan,
                                      featureLimits: {
                                        ...newPlan.featureLimits,
                                        [feature._id]: {
                                          ...currentLimit,
                                          limit: e.target.value
                                        }
                                      }
                                    });
                                  }}
                                />
                                <button
                                  type="button"
                                  onClick={() => {
                                    const updatedFeatureLimits = { ...newPlan.featureLimits };
                                    delete updatedFeatureLimits[feature._id];
                                    setNewPlan({ ...newPlan, featureLimits: updatedFeatureLimits });
                                  }}
                                  className="text-xs text-red-600 hover:text-red-700"
                                >
                                  Clear
                                </button>
                              </div>
                              {newPlan.featureLimits[feature._id]?.metricKey && (
                                <p className="text-xs text-gray-500 mt-1">
                                  e.g., API_CALLS, REPORTS, REQUESTS, etc.
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Limits Section */}
                <div>
                  <label className="label mb-2">Usage Limits</label>
                  <div className="border border-gray-200 rounded-lg p-4 space-y-3 bg-gray-50">
                    {newPlan.limits.map((limit, index) => (
                      <div key={limit.metricKey} className="flex items-center space-x-3">
                        <div className="flex-1">
                          <label className="text-sm font-medium text-gray-700 capitalize">
                            {limit.metricName} Limit
                          </label>
                        </div>
                        <input
                          type="number"
                          min="0"
                          className="input w-32 text-sm"
                          value={limit.limit}
                          onChange={(e) => {
                            const updatedLimits = [...newPlan.limits];
                            updatedLimits[index].limit = parseInt(e.target.value) || 0;
                            setNewPlan({ ...newPlan, limits: updatedLimits });
                          }}
                          placeholder="0"
                        />
                        <span className="text-xs text-gray-500 w-16">{limit.metricName}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex space-x-2">
                  <button type="submit" className="btn-primary">Create Plan</button>
                  <button
                    type="button"
                    onClick={() => setShowCreatePlan(false)}
                    className="btn-secondary"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {plans.map((plan) => (
              <div key={plan._id} className="card">
                {editingPlan === plan._id ? (
                  // Edit Form
                  <form onSubmit={handleEditPlan} className="space-y-3">
                    <h3 className="text-lg font-semibold mb-2">Edit Plan</h3>
                    
                    <div>
                      <label className="label text-xs">Plan Name</label>
                      <input
                        type="text"
                        className="input text-sm"
                        value={editPlanData.name}
                        onChange={(e) => setEditPlanData({ ...editPlanData, name: e.target.value })}
                        required
                      />
                    </div>

                    <div>
                      <label className="label text-xs">Description</label>
                      <textarea
                        className="input text-sm"
                        value={editPlanData.description}
                        onChange={(e) => setEditPlanData({ ...editPlanData, description: e.target.value })}
                        rows="2"
                      />
                    </div>

                    <div>
                      <label className="label text-xs">Price</label>
                      <input
                        type="number"
                        className="input text-sm"
                        value={editPlanData.price}
                        onChange={(e) => setEditPlanData({ ...editPlanData, price: e.target.value })}
                        required
                      />
                    </div>

                    <div>
                      <label className="label text-xs">Billing Cycle</label>
                      <select
                        className="input text-sm"
                        value={editPlanData.billingCycle}
                        onChange={(e) => {
                          const cycle = e.target.value;
                          const defaultDuration = cycle === 'yearly' ? 365 : cycle === 'custom' ? editPlanData.durationDays : 30;
                          setEditPlanData({ ...editPlanData, billingCycle: cycle, durationDays: defaultDuration });
                        }}
                      >
                        <option value="monthly">Monthly</option>
                        <option value="yearly">Yearly</option>
                        <option value="custom">Custom</option>
                      </select>
                    </div>

                    <div>
                      <label className="label text-xs">Duration (Days)</label>
                      <input
                        type="number"
                        min="1"
                        className="input text-sm"
                        value={editPlanData.durationDays}
                        onChange={(e) => setEditPlanData({ ...editPlanData, durationDays: parseInt(e.target.value) || 30 })}
                        required
                      />
                      <p className="text-[10px] text-gray-500 mt-1">Subscription validity period</p>
                    </div>

                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        id={`isActive-${plan._id}`}
                        checked={editPlanData.isActive}
                        onChange={(e) => setEditPlanData({ ...editPlanData, isActive: e.target.checked })}
                        className="mr-2"
                      />
                      <label htmlFor={`isActive-${plan._id}`} className="text-sm text-gray-700">
                        Active Plan
                      </label>
                    </div>

                    {/* Features Section */}
                    <div>
                      <label className="label text-xs mb-2">Features</label>
                      <div className="border border-gray-200 rounded-lg p-3 space-y-2 bg-gray-50 max-h-60 overflow-y-auto">
                        {features.length === 0 ? (
                          <p className="text-xs text-gray-500">No features available.</p>
                        ) : (
                          features.map((feature) => (
                            <div key={feature._id} className="border-b border-gray-200 pb-2 last:border-b-0 last:pb-0">
                              <label className="flex items-center space-x-2 cursor-pointer mb-1">
                                <input
                                  type="checkbox"
                                  checked={editPlanData.features?.includes(feature._id)}
                                  onChange={(e) => {
                                    const currentFeatures = editPlanData.features || [];
                                    if (e.target.checked) {
                                      setEditPlanData({ 
                                        ...editPlanData, 
                                        features: [...currentFeatures, feature._id] 
                                      });
                                    } else {
                                      const updatedFeatureLimits = { ...(editPlanData.featureLimits || {}) };
                                      delete updatedFeatureLimits[feature._id];
                                      setEditPlanData({ 
                                        ...editPlanData, 
                                        features: currentFeatures.filter(id => id !== feature._id),
                                        featureLimits: updatedFeatureLimits
                                      });
                                    }
                                  }}
                                  className="w-3 h-3 text-blue-600 rounded focus:ring-blue-500"
                                />
                                <span className="text-xs font-medium text-gray-700">{feature.name}</span>
                              </label>
                              
                              {/* Feature-specific limit input */}
                              {editPlanData.features?.includes(feature._id) && (
                                <div className="ml-5 mt-1 bg-white rounded p-2 border border-gray-200">
                                  <p className="text-[10px] font-medium text-gray-600 mb-1">Feature Limit</p>
                                  <div className="grid grid-cols-3 gap-1">
                                    <input
                                      type="text"
                                      placeholder="Metric"
                                      className="input text-[10px] py-1"
                                      value={editPlanData.featureLimits?.[feature._id]?.metricKey || ''}
                                      onChange={(e) => {
                                        setEditPlanData({
                                          ...editPlanData,
                                          featureLimits: {
                                            ...(editPlanData.featureLimits || {}),
                                            [feature._id]: {
                                              ...(editPlanData.featureLimits?.[feature._id] || {}),
                                              metricKey: e.target.value.toUpperCase().replace(/\s+/g, '_'),
                                              metricName: e.target.value.toLowerCase().replace(/_/g, ' ')
                                            }
                                          }
                                        });
                                      }}
                                    />
                                    <input
                                      type="number"
                                      min="0"
                                      placeholder="Limit"
                                      className="input text-[10px] py-1"
                                      value={editPlanData.featureLimits?.[feature._id]?.limit || ''}
                                      onChange={(e) => {
                                        const currentLimit = editPlanData.featureLimits?.[feature._id] || {};
                                        setEditPlanData({
                                          ...editPlanData,
                                          featureLimits: {
                                            ...(editPlanData.featureLimits || {}),
                                            [feature._id]: {
                                              ...currentLimit,
                                              limit: e.target.value
                                            }
                                          }
                                        });
                                      }}
                                    />
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const updatedFeatureLimits = { ...(editPlanData.featureLimits || {}) };
                                        delete updatedFeatureLimits[feature._id];
                                        setEditPlanData({ ...editPlanData, featureLimits: updatedFeatureLimits });
                                      }}
                                      className="text-[10px] text-red-600 hover:text-red-700"
                                    >
                                      Clear
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    {/* Limits Section */}
                    <div>
                      <label className="label text-xs mb-2">Usage Limits</label>
                      <div className="border border-gray-200 rounded-lg p-3 space-y-2 bg-gray-50">
                        {(editPlanData.limits || []).map((limit, index) => (
                          <div key={limit.metricKey} className="flex items-center space-x-2">
                            <div className="flex-1">
                              <label className="text-xs font-medium text-gray-700 capitalize">
                                {limit.metricName}
                              </label>
                            </div>
                            <input
                              type="number"
                              min="0"
                              className="input w-20 text-xs"
                              value={limit.limit}
                              onChange={(e) => {
                                const updatedLimits = [...(editPlanData.limits || [])];
                                updatedLimits[index].limit = parseInt(e.target.value) || 0;
                                setEditPlanData({ ...editPlanData, limits: updatedLimits });
                              }}
                            />
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="flex space-x-2 pt-2">
                      <button type="submit" className="btn-primary text-sm flex-1">
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={cancelEdit}
                        className="btn-secondary text-sm flex-1"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                ) : (
                  // Display Mode
                  <>
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="text-lg font-bold text-gray-900">{plan.name}</h3>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          startEditPlan(plan);
                        }}
                        className="text-primary-600 hover:text-primary-700"
                        title="Edit Plan"
                      >
                        <FiEdit className="text-lg" />
                      </button>
                    </div>
                    <p className="text-3xl font-bold text-primary-600 mb-2">
                      ${plan.price}
                      <span className="text-sm text-gray-500 font-normal">/{plan.billingCycle}</span>
                    </p>
                    <p className="text-sm text-gray-600 mb-4">{plan.description}</p>
                    
                    {/* Features List */}
                    {plan.features && plan.features.length > 0 && (
                      <div className="mb-3">
                        <p className="text-xs font-semibold text-gray-700 mb-2">Features:</p>
                        <div className="space-y-1">
                          {plan.features.map((feature) => {
                            // Find if this feature has a specific limit
                            const featureLimit = plan.limits?.find(l => 
                              l.featureId && (l.featureId._id === feature._id || l.featureId === feature._id)
                            );
                            
                            return (
                              <div key={feature._id} className="text-xs text-gray-600">
                                <div className="flex items-center">
                                  <FiCheck className="text-green-600 mr-1 flex-shrink-0" />
                                  <span>{feature.name}</span>
                                </div>
                                {featureLimit && (
                                  <div className="ml-5 text-[10px] text-gray-500">
                                    ↳ {featureLimit.metricName}: {featureLimit.limit}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    
                    {/* Plan-Level Limits */}
                    {plan.limits && plan.limits.filter(l => !l.featureId).length > 0 && (
                      <div className="mb-3">
                        <p className="text-xs font-semibold text-gray-700 mb-2">Plan Limits:</p>
                        <div className="space-y-1">
                          {plan.limits.filter(l => !l.featureId).map((limit, idx) => (
                            <div key={idx} className="text-xs text-gray-600">
                              <span className="font-medium capitalize">{limit.metricName}:</span> {limit.limit}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    <div className="text-sm text-gray-600 mb-4">
                      <p className="font-medium">
                        Duration: 
                        <span className="ml-2 text-gray-900">
                          {plan.durationDays} days
                        </span>
                      </p>
                      <p className="font-medium mt-2">
                        Status: 
                        <span className={`ml-2 px-2 py-1 text-xs rounded-full ${
                          plan.isActive 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {plan.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </p>
                    </div>

                    {/* View Details Button */}
                    <button
                      onClick={() => handlePlanClick(plan)}
                      className="w-full text-center py-2 bg-primary-50 hover:bg-primary-100 text-primary-600 rounded-lg text-sm font-medium transition-colors"
                    >
                      View Subscribers & Usage Details
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Organizations Section */}
        <div>
          <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
            <FiBriefcase className="mr-2" />
            Organizations
          </h2>
          <div className="card overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Organization
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Email
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Plan
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {organizations.map((org) => (
                  <tr key={org._id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {org.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {org.email}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {org.subscription?.planId?.name || 'No Plan'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                        org.status === 'active' 
                          ? 'bg-green-100 text-green-800' 
                          : org.status === 'suspended'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {org.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <button
                        onClick={() => handleToggleOrgStatus(org._id, org.status)}
                        className={`inline-flex items-center px-3 py-1 rounded-md text-xs font-medium ${
                          org.status === 'active'
                            ? 'bg-red-100 text-red-700 hover:bg-red-200'
                            : 'bg-green-100 text-green-700 hover:bg-green-200'
                        }`}
                        title={org.status === 'active' ? 'Block Organization' : 'Unblock Organization'}
                      >
                        {org.status === 'active' ? (
                          <>
                            <FiLock className="mr-1" />
                            Block
                          </>
                        ) : (
                          <>
                            <FiUnlock className="mr-1" />
                            Unblock
                          </>
                        )}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Plan Details Modal */}
      {selectedPlan && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              {/* Modal Header */}
              <div className="flex justify-between items-start mb-6 pb-4 border-b border-gray-200">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">{selectedPlan.name} Plan Details</h2>
                  <p className="text-sm text-gray-600">{selectedPlan.description}</p>
                  <div className="mt-2 flex items-center gap-4">
                    <span className="text-2xl font-bold text-primary-600">
                      ${selectedPlan.price} <span className="text-sm font-normal text-gray-500">/{selectedPlan.billingCycle}</span>
                    </span>
                    {selectedPlan.hasTrialPeriod && (
                      <span className="px-3 py-1 text-sm font-semibold bg-blue-100 text-blue-800 rounded-full">
                        {selectedPlan.trialDays}-day trial
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={closePlanDetails}
                  className="text-gray-400 hover:text-gray-600 text-2xl"
                >
                  <FiX />
                </button>
              </div>

              {detailsLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
                    <p className="text-gray-600">Loading plan details...</p>
                  </div>
                </div>
              ) : planDetails ? (
                <>
                  {/* Statistics Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                    <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4 border border-blue-200">
                      <div className="flex items-center justify-between mb-2">
                        <FiUsers className="text-blue-600 text-2xl" />
                      </div>
                      <p className="text-3xl font-bold text-blue-900">{planDetails.statistics.totalSubscribers}</p>
                      <p className="text-sm text-blue-700">Total Subscribers</p>
                    </div>

                    <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-4 border border-green-200">
                      <div className="flex items-center justify-between mb-2">
                        <FiCheck className="text-green-600 text-2xl" />
                      </div>
                      <p className="text-3xl font-bold text-green-900">{planDetails.statistics.activeSubscribers}</p>
                      <p className="text-sm text-green-700">Active Subscriptions</p>
                    </div>

                    <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-4 border border-purple-200">
                      <div className="flex items-center justify-between mb-2">
                        <FiTrendingUp className="text-purple-600 text-2xl" />
                      </div>
                      <p className="text-3xl font-bold text-purple-900">{planDetails.statistics.averageUsage}%</p>
                      <p className="text-sm text-purple-700">Average Usage</p>
                    </div>

                    <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-lg p-4 border border-emerald-200">
                      <div className="flex items-center justify-between mb-2">
                        <FiDollarSign className="text-emerald-600 text-2xl" />
                      </div>
                      <p className="text-3xl font-bold text-emerald-900">${planDetails.statistics.totalRevenue.toFixed(2)}</p>
                      <p className="text-sm text-emerald-700">Total Revenue</p>
                    </div>
                  </div>

                  {/* Plan Features and Limits */}
                  <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                    <h3 className="text-lg font-semibold text-gray-900 mb-3">Plan Features & Limits</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <h4 className="text-sm font-semibold text-gray-700 mb-2">Features:</h4>
                        {planDetails.plan.features.map((feature, idx) => (
                          <div key={idx} className="flex items-start text-sm mb-1">
                            <FiCheck className="text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                            <span className="text-gray-700">{feature.name}</span>
                          </div>
                        ))}
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-gray-700 mb-2">Limits:</h4>
                        {planDetails.plan.limits.filter(l => !l.featureId).map((limit, idx) => (
                          <div key={idx} className="flex items-start text-sm mb-1">
                            <span className="text-gray-700">• {limit.limit} {limit.metricName}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Subscribers List */}
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">
                      Active Subscribers ({planDetails.subscribers.length})
                    </h3>
                    
                    {planDetails.subscribers.length === 0 ? (
                      <div className="text-center py-8 bg-gray-50 rounded-lg">
                        <p className="text-gray-500">No active subscribers yet</p>
                      </div>
                    ) : (
                      <div className="space-y-3 max-h-96 overflow-y-auto">
                        {planDetails.subscribers.map((subscriber, idx) => (
                          <div key={idx} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                            {/* Organization Info */}
                            <div className="flex justify-between items-start mb-3">
                              <div>
                                <h4 className="text-base font-semibold text-gray-900">
                                  {subscriber.organization.name}
                                </h4>
                                <p className="text-xs text-gray-500">
                                  Subscribed on {new Date(subscriber.subscription.startDate).toLocaleDateString()}
                                </p>
                              </div>
                              <div className="flex items-center gap-2">
                                {getStatusBadge(subscriber.subscription.status)}
                                {subscriber.subscription.willCancelAt && (
                                  <span className="px-2 py-1 text-xs font-semibold bg-orange-100 text-orange-800 rounded-full">
                                    Cancelling
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Trial Info */}
                            {subscriber.subscription.isTrialing && (
                              <div className="mb-3 p-2 bg-blue-50 rounded text-xs text-blue-700">
                                Trial ends on {new Date(subscriber.subscription.trialEndDate).toLocaleDateString()}
                              </div>
                            )}

                            {/* Usage Metrics */}
                            {subscriber.usage.length > 0 && (
                              <div className="mb-3">
                                <p className="text-xs font-semibold text-gray-700 mb-2">Usage:</p>
                                <div className="grid grid-cols-2 gap-3">
                                  {subscriber.usage.map((usage, uIdx) => (
                                    <div key={uIdx} className="bg-gray-50 rounded p-2">
                                      <div className="flex justify-between items-center mb-1">
                                        <span className="text-xs text-gray-600">{usage.metricName}</span>
                                        <span className="text-xs font-semibold text-gray-900">
                                          {usage.current} / {usage.limit}
                                        </span>
                                      </div>
                                      <div className="w-full bg-gray-200 rounded-full h-2">
                                        <div
                                          className={`h-2 rounded-full transition-all ${
                                            usage.percentage >= 90
                                              ? 'bg-red-500'
                                              : usage.percentage >= 70
                                              ? 'bg-yellow-500'
                                              : 'bg-green-500'
                                          }`}
                                          style={{ width: `${Math.min(usage.percentage, 100)}%` }}
                                        />
                                      </div>
                                      <p className="text-xs text-gray-500 mt-1">{usage.percentage}% used</p>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Recent Payments */}
                            {subscriber.recentPayments.length > 0 && (
                              <div className="pt-3 border-t border-gray-200">
                                <p className="text-xs font-semibold text-gray-700 mb-2">Recent Payments:</p>
                                <div className="space-y-1">
                                  {subscriber.recentPayments.map((payment, pIdx) => (
                                    <div key={pIdx} className="flex justify-between items-center text-xs">
                                      <span className="text-gray-600">
                                        {new Date(payment.createdAt).toLocaleDateString()}
                                      </span>
                                      <span className={`font-semibold ${
                                        payment.status === 'completed' ? 'text-green-600' : 'text-gray-600'
                                      }`}>
                                        ${payment.amount}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default SuperAdminDashboard;
