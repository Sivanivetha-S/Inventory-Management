import React, { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'

// Public pages
import LandingPage          from './pages/LandingPage'
import LoginPage            from './pages/auth/LoginPage'
import RegisterPage         from './pages/auth/RegisterPage'
import ForgotPasswordPage   from './pages/auth/ForgotPasswordPage'
import SupplierRegisterPage from './pages/auth/SupplierRegisterPage'

// Layout
import AppLayout from './components/layout/AppLayout'

// Core pages — eagerly loaded
import Dashboard         from './pages/Dashboard'
import Products          from './pages/Products'
import Customers         from './pages/Customers'
import Billing           from './pages/Billing'
import Sales             from './pages/Sales'
import Discounts         from './pages/Discounts'
import TheftDetection    from './pages/TheftDetection'
import StaffDashboard    from './pages/StaffDashboard'
import SupplierDashboard from './pages/SupplierDashboard'

// Lazy-loaded pages
const Staff          = lazy(() => import('./pages/Staff'))
const Suppliers      = lazy(() => import('./pages/Suppliers'))
const BatchInventory = lazy(() => import('./pages/BatchInventory'))
const SupplyRequests = lazy(() => import('./pages/SupplyRequests'))
const Notifications  = lazy(() => import('./pages/Notifications'))
const Settings       = lazy(() => import('./pages/Settings'))
const InventoryVerification = lazy(() => import('./pages/InventoryVerification'))
const ProductReturn = lazy(() => import('./pages/ProductReturn'))
const SupplierReturns = lazy(() => import('./pages/SupplierReturns'))

const Loader = () => (
  <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'60vh' }}>
    <div className="spinner" />
  </div>
)

// ── Guards ───────────────────────────────────────────────────────────────────

/** Any authenticated user can access — if not authed, go to login */
const Protected = ({ children }) => {
  const { isAuthenticated, loading } = useAuth()
  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh' }}>
      <div className="spinner" />
    </div>
  )
  return isAuthenticated ? children : <Navigate to="/login" replace />
}

/** Only certain roles — redirect others to their own home */
const OnlyRole = ({ children, roles }) => {
  const { isAuthenticated, loading, role } = useAuth()
  if (loading) return <Loader />
  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (!roles.includes(role)) {
    if (role === 'STAFF')    return <Navigate to="/staff-dashboard"    replace />
    if (role === 'SUPPLIER') return <Navigate to="/supplier-dashboard" replace />
    return <Navigate to="/dashboard" replace />
  }
  return children
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Toaster position="top-right" toastOptions={{
            duration: 3500,
            style: {
              fontFamily: "Inter, -apple-system, 'Segoe UI', sans-serif",
              borderRadius: '10px', fontSize: '13.5px',
            },
          }} />

          <Routes>
            {/* ── Public ── */}
            <Route path="/"                  element={<LandingPage />} />
            <Route path="/login"             element={<LoginPage />} />
            <Route path="/register"          element={<RegisterPage />} />
            <Route path="/forgot-password"   element={<ForgotPasswordPage />} />
            <Route path="/supplier-register" element={<SupplierRegisterPage />} />

            {/* ── Protected — all roles share AppLayout ── */}
            <Route element={<Protected><AppLayout /></Protected>}>

              {/* Admin only */}
              <Route path="/dashboard"
                element={<OnlyRole roles={['ADMIN']}><Dashboard /></OnlyRole>} />
              <Route path="/products"
                element={<OnlyRole roles={['ADMIN','STAFF']}><Products /></OnlyRole>} />
              <Route path="/discounts"
                element={<OnlyRole roles={['ADMIN']}><Discounts /></OnlyRole>} />
              <Route path="/theft-detection"
                element={<OnlyRole roles={['ADMIN']}><TheftDetection /></OnlyRole>} />
              <Route path="/staff"
                element={<OnlyRole roles={['ADMIN']}><Suspense fallback={<Loader/>}><Staff /></Suspense></OnlyRole>} />
              <Route path="/suppliers"
                element={<OnlyRole roles={['ADMIN']}><Suspense fallback={<Loader/>}><Suppliers /></Suspense></OnlyRole>} />
              <Route path="/notifications"
                element={<OnlyRole roles={['ADMIN']}><Suspense fallback={<Loader/>}><Notifications /></Suspense></OnlyRole>} />
              <Route path="/settings"
                element={<OnlyRole roles={['ADMIN']}><Suspense fallback={<Loader/>}><Settings /></Suspense></OnlyRole>} />

              {/* Admin + Staff */}
              <Route path="/billing"
                element={<OnlyRole roles={['ADMIN','STAFF']}><Billing /></OnlyRole>} />
              <Route path="/sales"
                element={<OnlyRole roles={['ADMIN']}><Sales /></OnlyRole>} />
              <Route path="/customers"
                element={<OnlyRole roles={['ADMIN','STAFF']}><Customers /></OnlyRole>} />

              {/* Admin only — batch inventory and supply requests */}
              <Route path="/batch-inventory"
                element={<OnlyRole roles={['ADMIN']}><Suspense fallback={<Loader/>}><BatchInventory /></Suspense></OnlyRole>} />
              <Route path="/supply-requests"
                element={<OnlyRole roles={['ADMIN','SUPPLIER']}><Suspense fallback={<Loader/>}><SupplyRequests /></Suspense></OnlyRole>} />

              {/* Barcode Intelligence Module */}
              <Route path="/inventory-verification"
                element={<OnlyRole roles={['ADMIN','STAFF']}><Suspense fallback={<Loader/>}><InventoryVerification /></Suspense></OnlyRole>} />
              <Route path="/product-returns"
                element={<OnlyRole roles={['ADMIN','STAFF']}><Suspense fallback={<Loader/>}><ProductReturn /></Suspense></OnlyRole>} />

              {/* Supplier dashboard */}
              <Route path="/supplier-dashboard"
                element={<OnlyRole roles={['SUPPLIER']}><SupplierDashboard /></OnlyRole>} />
              <Route path="/supplier-returns"
                element={<OnlyRole roles={['SUPPLIER']}><Suspense fallback={<Loader/>}><SupplierReturns /></Suspense></OnlyRole>} />

              {/* Staff dashboard */}
              <Route path="/staff-dashboard"
                element={<OnlyRole roles={['STAFF']}><StaffDashboard /></OnlyRole>} />

            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  )
}
