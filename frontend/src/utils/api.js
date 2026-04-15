import axios from 'axios';

const TOKEN_KEY = 'blockfund_jwt';

function normalizeApiBaseUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) return '/api';
  return raw.replace(/\/+$/, '');
}

const API_BASE_URL = normalizeApiBaseUrl(import.meta.env.VITE_API_BASE_URL);

function canUseStorage() {
  return typeof window !== 'undefined' && !!window.localStorage;
}

export function getAuthToken() {
  if (!canUseStorage()) return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setAuthToken(token) {
  if (!canUseStorage()) return;
  if (!token) {
    localStorage.removeItem(TOKEN_KEY);
    return;
  }
  localStorage.setItem(TOKEN_KEY, token);
}

const API = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
});

let unauthorizedHandler = null;

export function registerUnauthorizedHandler(handler) {
  unauthorizedHandler = typeof handler === 'function' ? handler : null;
}

API.interceptors.request.use((config) => {
  const token = getAuthToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

API.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;
    const requestUrl = String(error?.config?.url || '');
    const isAuthEndpoint = requestUrl.includes('/auth/login') || requestUrl.includes('/auth/signup');

    if (status === 401 && !isAuthEndpoint && getAuthToken() && unauthorizedHandler) {
      unauthorizedHandler(error);
    }

    return Promise.reject(error);
  }
);

export const api = {
  // Auth
  login: (data) => API.post('/auth/login', data),
  signup: (data) => API.post('/auth/signup', data),
  me: () => API.get('/auth/me'),
  getWalletOptions: () => API.get('/auth/wallet-options'),

  // Users
  getContractors: () => API.get('/users/contractors'),

  // Projects
  createProject: (data) => API.post('/createProject', data),
  getProjects: () => API.get('/projects'),
  getProject: (id) => API.get(`/projects/${id}`),
  getProjectTimeline: (projectId) => API.get(`/projects/${projectId}/timeline`),
  updateProjectStatus: (projectId, status) => API.patch(`/projects/${projectId}/status`, { status }),

  // Updates
  submitUpdate: (data) => API.post('/updateWork', data),
  getUpdates: (projectId) => API.get(`/updates/${projectId}`),

  // Funds
  releaseFunds: (data) => API.post('/releaseFunds', data),
  sendContractRequest: (data) => API.post('/contract-requests', data),
  raiseContractorFundRequest: (data) => API.post('/contract-requests/raise', data),
  getContractRequests: () => API.get('/contract-requests'),
  respondContractRequest: (requestId, data) => API.patch(`/contract-requests/${requestId}/respond`, data),
  releaseAcceptedRequest: (requestId) => API.post(`/contract-requests/${requestId}/release`),

  // Verification
  verifyWork: (data) => API.post('/verifyWork', data),
  getVerifications: (projectId) => API.get(`/verifications/${projectId}`),

  // Stats
  getStats: () => API.get('/stats'),
  getReconciliationTasks: () => API.get('/reconciliation/pending'),
  retryReconciliation: (taskId) => API.post(`/reconcile/${taskId}`),

  // Demo
  getDemoProgress: () => API.get('/demo/progress'),
  getDemoReadiness: () => API.get('/demo/readiness'),
  resetDemoChecklist: () => API.post('/demo/checklist/reset'),
  resetDemo: () => API.post('/demo/reset', {}, { timeout: 180000 }),

  // Blockchain
  getBlockchainStatus: () => API.get('/blockchain/status'),
  getBlockchainAudit: () => API.get('/blockchain/audit'),
};

export function getResolvedApiBaseUrl() {
  return API_BASE_URL;
}

export function formatINR(amount) {
  if (!amount && amount !== 0) return '-';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function shortHash(hash) {
  if (!hash) return '-';
  return hash.substring(0, 10) + '...' + hash.substring(hash.length - 8);
}

export function formatDate(date) {
  if (!date) return '-';
  return new Date(date).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

export function getPercent(spent, total) {
  if (!total) return 0;
  return Math.min(100, Math.round((spent / total) * 100));
}
