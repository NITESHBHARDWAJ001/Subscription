import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// Create axios instance
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Add token to requests
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Handle response errors
api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const message = error.response?.data?.error || 'An error occurred';
    return Promise.reject({ message, status: error.response?.status });
  }
);

// Auth API
export const authAPI = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  getMe: () => api.get('/auth/me')
};

// Admin API
export const adminAPI = {
  createPlan: (data) => api.post('/admin/plans', data),
  getPlans: () => api.get('/admin/plans'),
  getPlanDetails: (id) => api.get(`/admin/plans/${id}/details`),
  updatePlan: (id, data) => api.put(`/admin/plans/${id}`, data),
  getOrganizations: () => api.get('/admin/organizations'),
  updateOrganizationStatus: (id, status) => api.put(`/admin/organizations/${id}/status`, { status }),
  createFeature: (data) => api.post('/admin/features', data),
  getFeatures: () => api.get('/admin/features')
};

// Organization API
export const organizationAPI = {
  inviteUser: (data) => api.post('/organization/invite', data),
  getUsers: () => api.get('/organization/users'),
  getSubscription: () => api.get('/organization/subscription'),
  getSubscriptionNotifications: () => api.get('/organization/subscription/notifications'),
  upgradeSubscription: (planId) => api.put('/organization/subscription/upgrade', { planId }),
  cancelSubscription: (reason) => api.put('/organization/subscription/cancel', { reason }),
  reactivateSubscription: () => api.put('/organization/subscription/reactivate'),
  getSubscriptionHistory: (params) => api.get('/organization/subscription/history', { params })
};

// Project API
export const projectAPI = {
  createProject: (data) => api.post('/projects', data),
  getProjects: () => api.get('/projects'),
  getProject: (id) => api.get(`/projects/${id}`),
  updateProject: (id, data) => api.put(`/projects/${id}`, data),
  deleteProject: (id) => api.delete(`/projects/${id}`)
};

// Public API (authenticated but not role-restricted)
export const publicAPI = {
  getPlans: () => api.get('/public/plans')
};

export default api;
