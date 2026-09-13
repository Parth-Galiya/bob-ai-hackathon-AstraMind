import axios from 'axios'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000'

const api = axios.create({
  baseURL: API_BASE,
  timeout: 30000,
})

api.interceptors.response.use(
  res => res.data,
  err => {
    const msg = err.response?.data?.detail || err.message || 'API error'
    return Promise.reject(new Error(msg))
  }
)

export const portflowApi = {
  // Health
  health: () => api.get('/api/health'),

  // Dashboard
  getDashboard: () => api.get('/api/dashboard'),

  // Vessels
  getVessels: (params = {}) => api.get('/api/vessels', { params }),

  // Berths
  getBerths: () => api.get('/api/berths'),

  // Cranes
  getCranes: () => api.get('/api/cranes'),

  // Yard
  getYard: () => api.get('/api/yard'),

  // Congestion
  getCongestion: () => api.get('/api/congestion/predict'),
  runCongestionPredict: () => api.post('/api/congestion/predict'),

  // Optimization
  getBerthOptimization: () => api.get('/api/optimization/berths'),
  runBerthOptimization: () => api.post('/api/optimization/berths'),
  getCraneOptimization: () => api.get('/api/optimization/cranes'),
  runCraneOptimization: () => api.post('/api/optimization/cranes'),

  // Routing
  getRouting: () => api.get('/api/routing/recommend'),
  runRouting: () => api.post('/api/routing/recommend'),

  // 72h Plan
  get72hPlan: () => api.get('/api/plan/72-hours'),

  // Simulation
  runSimulation: (config) => api.post('/api/simulation/run', config),

  // Scenario
  runScenario: (scenario) => api.post('/api/scenario/run', scenario),

  // Alerts
  getAlerts: () => api.get('/api/alerts'),
  acknowledgeAlert: (id) => api.post(`/api/alerts/${id}/acknowledge`),

  // Data
  uploadData: (formData) => api.post('/api/data/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  resetData: () => api.post('/api/data/reset'),
  generateData: (config) => api.post('/api/data/generate', config),

  // Copilot
  queryCopilot: (question) => api.post('/api/copilot/query', { question }),

  // Metrics
  getBeforeAfter: () => api.get('/api/metrics/before-after'),
  getConfig: () => api.get('/api/config'),
}

export default portflowApi
