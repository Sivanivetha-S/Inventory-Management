import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { authAPI } from '../services/api'

const AuthContext = createContext(null)

export const AuthProvider = ({ children }) => {
  const [admin, setAdmin]       = useState(null)
  const [loading, setLoading]   = useState(true)
  const [token, setToken]       = useState(null)

  useEffect(() => {
    const storedToken = localStorage.getItem('token')
    const storedAdmin = localStorage.getItem('admin')
    if (storedToken && storedAdmin) {
      setToken(storedToken)
      setAdmin(JSON.parse(storedAdmin))
    }
    setLoading(false)
  }, [])

  const login = useCallback((tokenValue, adminData) => {
    localStorage.setItem('token', tokenValue)
    localStorage.setItem('admin', JSON.stringify(adminData))
    setToken(tokenValue)
    setAdmin(adminData)
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem('token')
    localStorage.removeItem('admin')
    setToken(null)
    setAdmin(null)
  }, [])

  const refreshProfile = useCallback(async () => {
    try {
      const res = await authAPI.getProfile()
      const updated = res.data.data
      setAdmin(updated)
      localStorage.setItem('admin', JSON.stringify(updated))
    } catch { /* ignore */ }
  }, [])

  return (
    <AuthContext.Provider value={{ admin, token, loading, login, logout, refreshProfile, isAuthenticated: !!token }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be inside AuthProvider')
  return ctx
}
