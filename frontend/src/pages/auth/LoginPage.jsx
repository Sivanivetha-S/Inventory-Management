import React, { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { authAPI, supplierAPI } from '../../services/api'
import { useAuth } from '../../context/AuthContext'
import toast from 'react-hot-toast'
import { Mail, Lock, Eye, EyeOff, ShieldCheck, Building2 } from 'lucide-react'
import './Auth.css'

const ROLES = [
  { id:'ADMIN',    label:'Owner',    icon:ShieldCheck, color:'#4F46E5', desc:'Shop owner / Admin' },
  { id:'SUPPLIER', label:'Supplier', icon:Building2,   color:'#F59E0B', desc:'Product supplier'   },
]

export default function LoginPage() {
  const [selectedRole, setSelectedRole] = useState('ADMIN')
  const [form, setForm]     = useState({ email:'', password:'' })
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading]   = useState(false)
  const { login, isAuthenticated, role } = useAuth()
  const navigate = useNavigate()

  // Once login() sets token+role in context, navigate to correct home
  useEffect(() => {
    if (isAuthenticated && role) {
      const dest = role === 'SUPPLIER' ? '/supplier-dashboard' : role === 'STAFF' ? '/staff-dashboard' : '/dashboard'
      navigate(dest, { replace: true })
    }
  }, [isAuthenticated, role, navigate])

  const handleChange = e => setForm(p => ({...p, [e.target.name]: e.target.value}))

  const handleSubmit = async e => {
    e.preventDefault()
    if (!form.email.trim() || !form.password.trim()) {
      toast.error('Please fill in all fields'); return
    }
    setLoading(true)
    try {
      if (selectedRole === 'ADMIN') {
        const res = await authAPI.login(form)
        const { token, admin, role: respRole, staff } = res.data.data
        if (respRole === 'STAFF') {
          toast.success(`Welcome back, ${staff.fullName}!`)
          login(token, staff, 'STAFF')
        } else {
          toast.success(`Welcome back, ${admin.fullName}!`)
          login(token, admin, 'ADMIN')
        }

      } else if (selectedRole === 'SUPPLIER') {
        const res = await supplierAPI.login(form)
        const { token, supplier } = res.data.data
        toast.success(`Welcome, ${supplier.supplierName}!`)
        login(token, supplier, 'SUPPLIER')
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Login failed. Check your credentials.')
    } finally { setLoading(false) }
  }

  const activeRole = ROLES.find(r => r.id === selectedRole)
  const ActiveIcon = activeRole.icon

  return (
    <div className="auth-page">
      <div className="auth-bg">
        <div className="auth-bg-circle auth-bg-circle--1" />
        <div className="auth-bg-circle auth-bg-circle--2" />
        <div className="auth-bg-circle auth-bg-circle--3" />
      </div>

      <div className="auth-card animate-scale">
        <div className="auth-header">
          <div className="auth-logo">SI</div>
          <h1 className="auth-title">Welcome Back</h1>
          <p className="auth-subtitle">Sign in to Smart Inventory</p>
        </div>

        {/* Role selector */}
        <div style={{ display:'flex', gap:5, marginBottom:20, padding:'5px',
          background:'var(--slate-100)', borderRadius:'var(--r-lg)', border:'1px solid var(--border)' }}>
          {ROLES.map(r => {
            const Icon = r.icon; const isActive = selectedRole === r.id
            return (
              <button key={r.id} type="button" onClick={() => setSelectedRole(r.id)}
                style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center',
                  gap:4, padding:'10px 4px', border:'none', borderRadius:'var(--r-md)',
                  cursor:'pointer', fontFamily:'inherit',
                  background: isActive ? 'var(--surface)' : 'transparent',
                  boxShadow: isActive ? 'var(--sh-1)' : 'none',
                  color: isActive ? r.color : 'var(--text-4)',
                  transition:'all .16s ease' }}>
                <Icon size={18} strokeWidth={1.75} />
                <span style={{ fontSize:11, fontWeight:700 }}>{r.label}</span>
              </button>
            )
          })}
        </div>

        {/* Role hint */}
        <div style={{ background:'var(--accent-lt)', border:'1px solid var(--indigo-200)',
          borderRadius:'var(--r-md)', padding:'8px 14px', marginBottom:20,
          fontSize:12.5, color:'var(--accent-dk)', display:'flex', alignItems:'center', gap:7 }}>
          <ActiveIcon size={13} strokeWidth={2} />
          Signing in as&nbsp;<strong>{activeRole.desc}</strong>
          {selectedRole === 'SUPPLIER' && (
            <Link to="/supplier-register"
              style={{ marginLeft:'auto', color:'var(--accent)', fontWeight:700, fontSize:12 }}>
              Register →
            </Link>
          )}
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Email Address</label>
            <div className="input-icon-wrap">
              <Mail className="input-icon" size={15} strokeWidth={1.75} />
              <input type="email" name="email" className="form-input input-with-icon"
                placeholder={
                  selectedRole==='ADMIN'    ? 'owner@example.com' :
                  selectedRole==='STAFF'    ? 'staff@example.com' :
                                              'supplier@company.com'
                }
                value={form.email} onChange={handleChange} autoComplete="email" autoFocus />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Password</label>
            <div className="input-icon-wrap">
              <Lock className="input-icon" size={15} strokeWidth={1.75} />
              <input type={showPass?'text':'password'} name="password"
                className="form-input input-with-icon input-with-right-icon"
                placeholder="Enter your password"
                value={form.password} onChange={handleChange} autoComplete="current-password" />
              <button type="button" className="input-eye" onClick={() => setShowPass(v => !v)}>
                {showPass ? <EyeOff size={15} strokeWidth={1.75}/> : <Eye size={15} strokeWidth={1.75}/>}
              </button>
            </div>
          </div>

          {selectedRole === 'ADMIN' && (
            <div style={{ textAlign:'right', marginBottom:6 }}>
              <Link to="/forgot-password" style={{ fontSize:13, color:'var(--accent)', fontWeight:600 }}>
                Forgot password?
              </Link>
            </div>
          )}

          <button type="submit" className="btn btn-primary auth-submit"
            disabled={loading} style={{ marginTop:8 }}>
            {loading ? <span className="btn-spinner"/> : `Sign In as ${activeRole.label}`}
          </button>
        </form>

        {selectedRole === 'SUPPLIER' && (
          <p className="auth-link-text" style={{ marginTop:16 }}>
            New supplier?{' '}
            <Link to="/supplier-register" className="auth-link">Register here</Link>
          </p>
        )}
        <div style={{ textAlign:'center', marginTop:14 }}>
          <Link to="/" style={{ fontSize:13, color:'var(--text-3)', fontWeight:500 }}>← Back to Home</Link>
        </div>
      </div>
    </div>
  )
}
