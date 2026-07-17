import axios from 'axios'

/**
 * Central axios instance.
 * withCredentials: true  — browser sends HttpOnly cookies on every request.
 * No Authorization header needed — JWT lives in the cookie.
 */
const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
  timeout: 30000,
  withCredentials: true,
})

// Attach JWT — send via Authorization header (sessionStorage) for Vite proxy compat
// The HttpOnly cookie is also sent automatically via withCredentials as a backup
api.interceptors.request.use(
  (config) => {
    const token = sessionStorage.getItem('si_token')
    if (token) config.headers.Authorization = `Bearer ${token}`
    
    // Inject branch context header
    const activeBranchId = localStorage.getItem('si_active_branch_id') || 'all'
    config.headers['X-Branch-ID'] = activeBranchId
    
    return config
  },
  (error) => Promise.reject(error)
)

// Handle 401 globally
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const isAuthRequest = error.config?.url?.includes('/auth/login') ||
                          error.config?.url?.includes('/staff/login') ||
                          error.config?.url?.includes('/suppliers/login') ||
                          error.config?.url?.includes('/auth/register') ||
                          error.config?.url?.includes('/suppliers/register');

    if (error.response?.status === 401 && !isAuthRequest) {
      sessionStorage.clear()
      localStorage.removeItem('si_token')
      localStorage.removeItem('si_user')
      localStorage.removeItem('si_role')
      // Clear legacy keys if present
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
  registerStep1: (data)            => api.post('/auth/register/step1', data),
  verifyOtp:     (data)            => api.post('/auth/register/verify-otp', data),
  registerStep3: (data)            => api.post('/auth/register/step3', data),
  login:         (data)            => api.post('/auth/login', data),
  logout:        ()                => api.post('/auth/logout'),
  resendOtp:     (email)           => api.post(`/auth/resend-otp?email=${email}`),
  getProfile:    ()                => api.get('/auth/profile'),
  // Forgot password
  forgotPassword: (email)          => api.post('/auth/forgot-password', { email }),
  verifyResetOtp: (email, otp)     => api.post('/auth/forgot-password/verify-otp', { email, otp }),
  resetPassword:  (email, otp, newPassword) =>
    api.post('/auth/forgot-password/reset', { email, otp, newPassword }),
}

// ─── Products ──────────────────────────────────────────────────────────────
export const productAPI = {
  getAll:       ()             => api.get('/products'),
  getById:      (id)           => api.get(`/products/${id}`),
  create:       (data)         => api.post('/products', data),
  update:       (id, data)     => api.put(`/products/${id}`, data),
  delete:       (id)           => api.delete(`/products/${id}`),
  getLowStock:  ()             => api.get('/products/low-stock'),
  search:       (q)            => api.get(`/products/search?q=${q}`),
  getCategories:()             => api.get('/products/categories'),
}

// ─── Customers ─────────────────────────────────────────────────────────────
export const customerAPI = {
  getAll:       ()             => api.get('/customers'),
  getById:      (id)           => api.get(`/customers/${id}`),
  create:       (data)         => api.post('/customers', data),
  update:       (id, data)     => api.put(`/customers/${id}`, data),
  delete:       (id)           => api.delete(`/customers/${id}`),
  search:       (q)            => api.get(`/customers/search?q=${q}`),
  verifyOtp:    (data)         => api.post('/customers/verify-otp', data),
  resendOtp:    (email)        => api.post(`/customers/resend-otp?email=${encodeURIComponent(email)}`),
  searchByEmail: (email)       => api.get(`/customers/search-by-email?email=${encodeURIComponent(email)}`),
  linkBranch:    (id)          => api.post(`/customers/${id}/link-branch`),
}

// ─── Invoices ──────────────────────────────────────────────────────────────
export const invoiceAPI = {
  create:       (data)         => api.post('/invoices', data),
  getAll:       ()             => api.get('/invoices'),
  getById:      (id)           => api.get(`/invoices/${id}`),
  getByCustomer:(id)           => api.get(`/invoices/customer/${id}`),
  getReport:    (from, to)     => api.get(`/invoices/report?from=${from}&to=${to}`),
  search:       (q)            => api.get(`/invoices/search?q=${q}`),
}

// ─── Discounts ─────────────────────────────────────────────────────────────
export const discountAPI = {
  getAll:       ()             => api.get('/discounts'),
  getActive:    ()             => api.get('/discounts/active'),
  getById:      (id)           => api.get(`/discounts/${id}`),
  create:       (data)         => api.post('/discounts', data),
  update:       (id, data)     => api.put(`/discounts/${id}`, data),
  delete:       (id)           => api.delete(`/discounts/${id}`),
}

// ─── Theft Detection ───────────────────────────────────────────────────────
export const theftAPI = {
  verifyStock:      (data)     => api.post('/theft/verify-stock', data),
  getAll:           ()         => api.get('/theft'),
  getByDate:        (date)     => api.get(`/theft/date/${date}`),
  getByDateRange:   (f, t)     => api.get(`/theft/range?from=${f}&to=${t}`),
  updateNotes:      (id, data) => api.patch(`/theft/${id}/notes`, data),
  getProductHistory:(id)       => api.get(`/theft/product/${id}`),
}

// ─── Damage Records ────────────────────────────────────────────────────────
export const damageAPI = {
  create:           (data)     => api.post('/damage', data),
  getAll:           ()         => api.get('/damage'),
  getByDate:        (date)     => api.get(`/damage/date/${date}`),
  getByDateRange:   (f, t)     => api.get(`/damage/range?from=${f}&to=${t}`),
  getProductHistory:(id)       => api.get(`/damage/product/${id}`),
}

// ─── Dashboard ─────────────────────────────────────────────────────────────
export const dashboardAPI = {
  getData:      ()             => api.get('/dashboard'),
}

// ─── Staff ─────────────────────────────────────────────────────────────────
export const staffAPI = {
  login:        (data)         => api.post('/staff/login', data),
  logout:       ()             => api.post('/staff/logout'),
  getMe:        ()             => api.get('/staff/me'),
  getAll:       ()             => api.get('/staff'),
  getById:      (id)           => api.get(`/staff/${id}`),
  add:          (data)         => api.post('/staff', data),
  update:       (id, data)     => api.put(`/staff/${id}`, data),
  toggle:       (id)           => api.patch(`/staff/${id}/toggle`),
  toggleLogin:  (id)           => api.patch(`/staff/${id}/toggle-login`),
  toggleBilling: (id)           => api.patch(`/staff/${id}/toggle-billing`),
  delete:       (id)           => api.delete(`/staff/${id}`),
}

// ─── Suppliers ─────────────────────────────────────────────────────────────
export const supplierAPI = {
  register:     (data)         => api.post('/suppliers/register', data),
  verifyOtp:    (data)         => api.post('/suppliers/verify-otp', data),
  login:        (data)         => api.post('/suppliers/login', data),
  logout:       ()             => api.post('/suppliers/logout'),
  getAll:       ()             => api.get('/suppliers'),
  getById:      (id)           => api.get(`/suppliers/${id}`),
}

// ─── Supplier Products (catalog) ───────────────────────────────────────────
export const supplierProductAPI = {

  /**
   * Add product — sends as multipart/form-data
   * @param {Object} data   — product fields (will be JSON-serialised as "data" part)
   * @param {File|null} imageFile — optional image file
   */
  add: (data, imageFile = null) => {
    const form = new FormData()
    form.append('data', JSON.stringify(data))
    if (imageFile) form.append('image', imageFile)
    return api.post('/supplier-products', form, {
      headers: { 'Content-Type': undefined }
    })
  },

  /**
   * Update product — same multipart format
   */
  update: (id, data, imageFile = null) => {
    const form = new FormData()
    form.append('data', JSON.stringify(data))
    if (imageFile) form.append('image', imageFile)
    return api.put(`/supplier-products/${id}`, form, {
      headers: { 'Content-Type': undefined }
    })
  },

  delete:          (id)   => api.delete(`/supplier-products/${id}`),
  getMyCatalog:    ()     => api.get('/supplier-products/my-catalog'),
  getAll:          (q)    => api.get(`/supplier-products${q ? `?q=${encodeURIComponent(q)}` : ''}`),
  getBySupplierId: (id)   => api.get(`/supplier-products/by-supplier/${id}`),
}

// ─── Owners (for supplier to browse registered shops) ──────────────────────
export const ownerAPI = {
  getAll: ()                   => api.get('/owners'),
}

// ─── Product Batches ───────────────────────────────────────────────────────
export const batchAPI = {
  addBatch:         (data)     => api.post('/batches', data),
  getAll:           ()         => api.get('/batches'),
  getByProduct:     (id)       => api.get(`/batches/product/${id}`),
  lookupByBarcode:  (code)     => api.get(`/batches/barcode/${code}`),
}

// ─── Barcode ───────────────────────────────────────────────────────────────
export const barcodeAPI = {
  decode: (formData) => api.post('/barcode/decode', formData, {
    headers: { 'Content-Type': undefined },
  }),
  lookup: (barcode, action = 'SEARCH')  => api.get(`/barcode/lookup/${barcode}?action=${action}`),
  getScanHistory: () => api.get('/barcode/history'),
  verifyInventory: (scannedItems, notes) => api.post(`/barcode/verify${notes ? `?notes=${encodeURIComponent(notes)}` : ''}`, scannedItems),
  submitCustomerReturnRequest: (formData) => api.post('/barcode/return/customer/request', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 120000
  }),
  approveCustomerReturn: (id) => api.post(`/barcode/return/customer/${id}/approve`),
  rejectCustomerReturn: (id, reason) => api.post(`/barcode/return/customer/${id}/reject?reason=${encodeURIComponent(reason)}`),
  processCustomerRefund: (id, refundMethod) => api.post(`/barcode/return/customer/${id}/refund?refundMethod=${encodeURIComponent(refundMethod)}`),
  processCustomerExchange: (id, exchangeBarcode, exchangeQty) => api.post(`/barcode/return/customer/${id}/exchange?exchangeBarcode=${exchangeBarcode}&exchangeQty=${exchangeQty}`),
  getCustomerReturnProducts: (invoiceNumber) => api.get(`/barcode/return/customer/invoice/${encodeURIComponent(invoiceNumber)}`),
  processSupplierReturn: (formData) => api.post('/barcode/return/supplier', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 120000
  }),
  getSupplierReturns: () => api.get('/barcode/return/supplier/list'),
  acceptSupplierReturn: (id) => api.post(`/barcode/return/supplier/${id}/accept`),
  rejectSupplierReturn: (id, reason) => api.post(`/barcode/return/supplier/${id}/reject?reason=${encodeURIComponent(reason)}`),
  getOwnerReturns: () => api.get('/barcode/return/owner/list'),
}

// ─── Supply Requests ───────────────────────────────────────────────────────
export const supplyRequestAPI = {
  create:       (data)             => api.post('/supply-requests', data),
  getAll:       ()                 => api.get('/supply-requests'),
  getById:      (id)               => api.get(`/supply-requests/${id}`),
  updateStatus: (id, status, notes) =>
    api.patch(`/supply-requests/${id}/status?status=${status}${notes ? `&notes=${encodeURIComponent(notes)}` : ''}`),
}

// ─── Notifications ─────────────────────────────────────────────────────────
export const notificationAPI = {
  getAll:         (page = 0, size = 20) => api.get(`/notifications?page=${page}&size=${size}`),
  getUnread:      ()                    => api.get('/notifications/unread'),
  getUnreadCount: ()                    => api.get('/notifications/unread/count'),
  markRead:       (id)                  => api.patch(`/notifications/${id}/read`),
  markAllRead:    ()                    => api.patch('/notifications/read-all'),
  delete:         (id)                  => api.delete(`/notifications/${id}`),
}

// ─── Supplier Dispatches ────────────────────────────────────────────────────
export const supplierDispatchAPI = {
  dispatch: (supplierProductId, adminId, branchId, quantity) => {
    let url = `/supplier-dispatches?supplierProductId=${supplierProductId}&adminId=${adminId}&quantity=${quantity}`;
    if (branchId) url += `&branchId=${branchId}`;
    return api.post(url);
  },
  accept: (id) => api.post(`/supplier-dispatches/${id}/accept`),
  reject: (id, reason) => api.post(`/supplier-dispatches/${id}/reject?reason=${encodeURIComponent(reason)}`),
  getSupplierDispatches: () => api.get('/supplier-dispatches/supplier'),
  getOwnerDispatches: () => api.get('/supplier-dispatches/owner'),
}

// ─── Supplier Theft Detection ───────────────────────────────────────────────
export const supplierTheftAPI = {
  verify: (supplierProductId, actualQuantity) =>
    api.post(`/supplier-theft/verify?supplierProductId=${supplierProductId}&actualQuantity=${actualQuantity}`),
  getTheftRecords: () => api.get('/supplier-theft'),
}

// ─── Supplier Dashboard ─────────────────────────────────────────────────────
export const supplierDashboardAPI = {
  getDashboard: () => api.get('/supplier-dashboard'),
}

// ─── Audit Logs ─────────────────────────────────────────────────────────────
export const auditLogAPI = {
  getAuditLogs: () => api.get('/audit-logs'),
}

// ─── Chatbot ───────────────────────────────────────────────────────────────
export const chatbotAPI = {
  chat: (message, history) => api.post('/chat', { message, history }),
}

// ─── Branches ───────────────────────────────────────────────────────────────
export const branchAPI = {
  getAll: () => api.get('/branches'),
  getById: (id) => api.get(`/branches/${id}`),
  create: (data) => api.post('/branches', data),
  update: (id, data) => api.put(`/branches/${id}`, data),
  delete: (id) => api.delete(`/branches/${id}`),
  toggle: (id) => api.patch(`/branches/${id}/toggle`),
}
