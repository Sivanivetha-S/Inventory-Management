import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
  timeout: 30000,
})

// Attach JWT to every request
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token')
    if (token) config.headers.Authorization = `Bearer ${token}`
    return config
  },
  (error) => Promise.reject(error)
)

// Handle 401 globally
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('admin')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

export default api

// ─── Auth ──────────────────────────────────────────────────────────────────
export const authAPI = {
  registerStep1: (data)   => api.post('/auth/register/step1', data),
  verifyOtp: (data)       => api.post('/auth/register/verify-otp', data),
  registerStep3: (data)   => api.post('/auth/register/step3', data),
  login: (data)           => api.post('/auth/login', data),
  resendOtp: (email)      => api.post(`/auth/resend-otp?email=${email}`),
  getProfile: ()          => api.get('/auth/profile'),
}

// ─── Products ──────────────────────────────────────────────────────────────
export const productAPI = {
  getAll: ()              => api.get('/products'),
  getById: (id)           => api.get(`/products/${id}`),
  create: (data)          => api.post('/products', data),
  update: (id, data)      => api.put(`/products/${id}`, data),
  delete: (id)            => api.delete(`/products/${id}`),
  getLowStock: ()         => api.get('/products/low-stock'),
  search: (q)             => api.get(`/products/search?q=${q}`),
  getCategories: ()       => api.get('/products/categories'),
}

// ─── Customers ─────────────────────────────────────────────────────────────
export const customerAPI = {
  getAll: ()              => api.get('/customers'),
  getById: (id)           => api.get(`/customers/${id}`),
  create: (data)          => api.post('/customers', data),
  update: (id, data)      => api.put(`/customers/${id}`, data),
  delete: (id)            => api.delete(`/customers/${id}`),
  search: (q)             => api.get(`/customers/search?q=${q}`),
  verifyOtp: (data)       => api.post('/customers/verify-otp', data),
  resendOtp: (email)      => api.post(`/customers/resend-otp?email=${encodeURIComponent(email)}`),
}

// ─── Invoices ──────────────────────────────────────────────────────────────
export const invoiceAPI = {
  create: (data)          => api.post('/invoices', data),
  getAll: ()              => api.get('/invoices'),
  getById: (id)           => api.get(`/invoices/${id}`),
  getByCustomer: (id)     => api.get(`/invoices/customer/${id}`),
  getReport: (from, to)   => api.get(`/invoices/report?from=${from}&to=${to}`),
  search: (q)             => api.get(`/invoices/search?q=${q}`),
}

// ─── Discounts ─────────────────────────────────────────────────────────────
export const discountAPI = {
  getAll: ()              => api.get('/discounts'),
  getActive: ()           => api.get('/discounts/active'),
  getById: (id)           => api.get(`/discounts/${id}`),
  create: (data)          => api.post('/discounts', data),
  update: (id, data)      => api.put(`/discounts/${id}`, data),
  delete: (id)            => api.delete(`/discounts/${id}`),
}

// ─── Theft Detection ───────────────────────────────────────────────────────
export const theftAPI = {
  verifyStock: (data)     => api.post('/theft/verify-stock', data),
  getAll: ()              => api.get('/theft'),
  getByDate: (date)       => api.get(`/theft/date/${date}`),
  getByDateRange: (f, t)  => api.get(`/theft/range?from=${f}&to=${t}`),
  updateNotes: (id, data) => api.patch(`/theft/${id}/notes`, data),
  getProductHistory: (id) => api.get(`/theft/product/${id}`),
}

// ─── Damage Records ────────────────────────────────────────────────────────
export const damageAPI = {
  create: (data)          => api.post('/damage', data),
  getAll: ()              => api.get('/damage'),
  getByDate: (date)       => api.get(`/damage/date/${date}`),
  getByDateRange: (f, t)  => api.get(`/damage/range?from=${f}&to=${t}`),
  getProductHistory: (id) => api.get(`/damage/product/${id}`),
}

// ─── Dashboard ─────────────────────────────────────────────────────────────
export const dashboardAPI = {
  getData: ()             => api.get('/dashboard'),
}
