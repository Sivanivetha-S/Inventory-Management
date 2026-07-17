import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'

const AuthContext = createContext(null)

export const AuthProvider = ({ children }) => {
  const [user,    setUser]    = useState(null)
  const [role,    setRole]    = useState(null)
  const [token,   setToken]   = useState(null)
  const [loading, setLoading] = useState(true)

  // Restore session from sessionStorage on mount
  useEffect(() => {
    try {
      const t = sessionStorage.getItem('si_token')
      const u = sessionStorage.getItem('si_user')
      const r = sessionStorage.getItem('si_role')
      if (t && u && r) {
        setToken(t)
        setUser(JSON.parse(u))
        setRole(r)
      }
    } catch (_) { /* ignore corrupt data */ }
    setLoading(false)
  }, [])

  /**
   * Called immediately after a successful login API call.
   * Stores token + user metadata in sessionStorage so:
   *   1. axios interceptor can read 'si_token' and attach Authorization header
   *   2. page refresh restores the session
   */
  const login = useCallback((tokenValue, userData, userRole) => {
    sessionStorage.setItem('si_token', tokenValue)
    sessionStorage.setItem('si_user',  JSON.stringify(userData))
    sessionStorage.setItem('si_role',  userRole)
    setToken(tokenValue)
    setUser(userData)
    setRole(userRole)
  }, [])

  /**
   * Logout — clear sessionStorage + call server to clear HttpOnly cookie too.
   * Server call is best-effort; we always clear local state.
   */
  const logout = useCallback(async () => {
    // Clear local state first so UI reacts immediately
    sessionStorage.removeItem('si_token')
    sessionStorage.removeItem('si_user')
    sessionStorage.removeItem('si_role')
    // Clear any legacy keys
    localStorage.removeItem('token')
    localStorage.removeItem('admin')
    setToken(null)
    setUser(null)
    setRole(null)

    // Best-effort: tell server to clear cookie
    try {
      const endpoint = role === 'STAFF' ? '/staff/logout' :
                       role === 'SUPPLIER' ? '/suppliers/logout' :
                       '/auth/logout'
      await fetch(`/api${endpoint}`, {
        method: 'POST',
        credentials: 'include',
      })
    } catch (_) { /* ignore */ }
  }, [role])

  const [activeBranchId, setActiveBranchId] = useState(() => localStorage.getItem('si_active_branch_id') || 'all')

  const switchBranch = useCallback((branchId) => {
    localStorage.setItem('si_active_branch_id', branchId)
    setActiveBranchId(branchId)
  }, [])

  // Backward-compat alias
  const admin = role === 'ADMIN' ? user : null

  return (
    <AuthContext.Provider value={{
      user, role, admin, token, loading,
      login, logout, activeBranchId, switchBranch,
      isAuthenticated: !!token,
      isAdmin:    role === 'ADMIN',
      isStaff:    role === 'STAFF',
      isSupplier: role === 'SUPPLIER',
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be inside AuthProvider')
  return ctx
}
