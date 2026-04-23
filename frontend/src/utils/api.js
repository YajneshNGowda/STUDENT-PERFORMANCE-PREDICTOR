import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '',
  timeout: 30000,
})

// Request: attach token if present
api.interceptors.request.use(config => {
  const token = localStorage.getItem('eg_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Response: redirect to login on 401
api.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('eg_token')
      if (!window.location.pathname.includes('/login')) {
        window.location.href = '/login'
      }
    }
    return Promise.reject(err)
  }
)

export default api

// ── Typed helpers ─────────────────────────────────────────────────────────────
export const authAPI = {
  login: (email, password) => api.post('/api/auth/login', { email, password }),
  logout: () => api.post('/api/auth/logout'),
  me: () => api.get('/api/auth/me'),
  forgotPassword: (email) => api.post('/api/auth/forgot-password', { email }),
  resetPassword: (token, new_password) => api.post('/api/auth/reset-password', { token, new_password }),
  changePassword: (current_password, new_password) => api.post('/api/auth/change-password', { current_password, new_password }),
}

export const dashboardAPI = {
  overview: () => api.get('/api/dashboard/overview'),
}

export const studentsAPI = {
  list: (params) => api.get('/api/students', { params }),
  get: (id) => api.get(`/api/students/${id}`),
  create: (data) => api.post('/api/students', data),
  update: (id, data) => api.patch(`/api/students/${id}`, data),
  delete: (id) => api.delete(`/api/students/${id}`),
  predictions: (id) => api.get(`/api/students/${id}/predictions`),
  bulkUpload: (file, dept_id) => {
    const form = new FormData()
    form.append('file', file)
    return api.post(`/api/students/bulk/upload${dept_id ? `?dept_id=${dept_id}` : ''}`, form)
  },
}

export const mlAPI = {
  metrics: () => api.get('/api/ml/metrics'),
  featureImportance: () => api.get('/api/ml/feature-importance'),
  train: () => api.post('/api/ml/train'),
}

export const alertsAPI = {
  list: (params) => api.get('/api/alerts', { params }),
  acknowledge: (id) => api.post(`/api/alerts/${id}/acknowledge`),
}

export const usersAPI = {
  list: (params) => api.get('/api/users', { params }),
  create: (data) => api.post('/api/users', data),
  update: (id, data) => api.patch(`/api/users/${id}`, data),
  delete: (id) => api.delete(`/api/users/${id}`),
}

export const deptsAPI = {
  list: () => api.get('/api/departments'),
}
