import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'

// Public pages
import LandingPage from './pages/LandingPage'
import LoginPage from './pages/auth/LoginPage'
import RegisterPage from './pages/auth/RegisterPage'

// Layout
import AppLayout from './components/layout/AppLayout'

// Protected pages
import Dashboard from './pages/Dashboard'
import Products from './pages/Products'
import Customers from './pages/Customers'
import Billing from './pages/Billing'
import Sales from './pages/Sales'
import Discounts from './pages/Discounts'
import TheftDetection from './pages/TheftDetection'

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth()
  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh' }}>
      <div className="spinner" />
    </div>
  )
  return isAuthenticated ? children : <Navigate to="/login" replace />
}

const PublicRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth()
  if (loading) return null
  return !isAuthenticated ? children : <Navigate to="/dashboard" replace />
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 3500,
              style: {
                fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
                borderRadius: '10px',
                fontSize: '13.5px',
                background: 'var(--bg-modal)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-md)',
              },
              success: { iconTheme: { primary: 'var(--primary)', secondary: '#fff' } },
            }}
          />
          <Routes>
            {/* Public */}
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
            <Route path="/register" element={<PublicRoute><RegisterPage /></PublicRoute>} />

            {/* Protected */}
            <Route path="/" element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
              <Route path="dashboard"       element={<Dashboard />} />
              <Route path="products"        element={<Products />} />
              <Route path="customers"       element={<Customers />} />
              <Route path="billing"         element={<Billing />} />
              <Route path="sales"           element={<Sales />} />
              <Route path="discounts"       element={<Discounts />} />
              <Route path="theft-detection" element={<TheftDetection />} />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  )
}
