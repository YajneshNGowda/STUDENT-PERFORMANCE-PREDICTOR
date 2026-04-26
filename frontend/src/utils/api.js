import axios from 'axios'

const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || '', timeout: 30000 })

api.interceptors.request.use(cfg => {
  const t = localStorage.getItem('eg_token')
  if (t) cfg.headers.Authorization = `Bearer ${t}`
  return cfg
})
api.interceptors.response.use(res => res, err => {
  if (err.response?.status === 401) {
    localStorage.removeItem('eg_token')
    if (!window.location.pathname.includes('/login')) window.location.href = '/login'
  }
  return Promise.reject(err)
})

export default api

export const authAPI = {
  login:        (email, password) => api.post('/api/auth/login', { email, password }),
  studentLogin: (full_name, usn)  => api.post('/api/auth/student-login', { full_name, usn }),
  parentLogin:  (full_name, usn)  => api.post('/api/auth/parent-login',  { full_name, usn }),
  logout:       ()                => api.post('/api/auth/logout'),
  me:           ()                => api.get('/api/auth/me'),
  forgotPassword:  email          => api.post('/api/auth/forgot-password', { email }),
  resetPassword:   (token, new_password) => api.post('/api/auth/reset-password', { token, new_password }),
  changePassword:  (current_password, new_password) => api.post('/api/auth/change-password', { current_password, new_password }),
}
export const dashboardAPI = { overview: () => api.get('/api/dashboard/overview') }
export const studentsAPI  = {
  list:         params  => api.get('/api/students', { params }),
  get:          id      => api.get(`/api/students/${id}`),
  myProfile:    ()      => api.get('/api/students/my-profile'),
  create:       data    => api.post('/api/students', data),
  update:       (id,d)  => api.patch(`/api/students/${id}`, d),
  delete:       id      => api.delete(`/api/students/${id}`),
  predictions:  id      => api.get(`/api/students/${id}/predictions`),
  riskAnalysis: id      => api.get(`/api/students/${id}/risk-analysis`),
  bulkUpload:   (file, dept_id) => {
    const form = new FormData(); form.append('file', file)
    return api.post(`/api/students/bulk/upload${dept_id?`?dept_id=${dept_id}`:''}`, form)
  },
}
export const mlAPI = {
  metrics:           () => api.get('/api/ml/metrics'),
  featureImportance: () => api.get('/api/ml/feature-importance'),
  train:             () => api.post('/api/ml/train'),
}
export const alertsAPI = {
  list:        params => api.get('/api/alerts', { params }),
  acknowledge: id     => api.post(`/api/alerts/${id}/acknowledge`),
}
export const usersAPI = {
  list:   params    => api.get('/api/users', { params }),
  create: data      => api.post('/api/users', data),
  update: (id, d)   => api.patch(`/api/users/${id}`, d),
  delete: id        => api.delete(`/api/users/${id}`),
}
export const deptsAPI = { list: () => api.get('/api/departments') }
