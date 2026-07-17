import React, { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supplierAPI } from '../../services/api'
import toast from 'react-hot-toast'
import { Building2, Mail, Lock, Phone, MapPin, Eye, EyeOff, User } from 'lucide-react'
import './Auth.css'

const STEPS = ['Basic Info', 'Verify OTP', 'Complete']

export default function SupplierRegisterPage() {
  const [step, setStep]         = useState(0)
  const [loading, setLoading]   = useState(false)
  const [showPass, setShowPass] = useState(false)
  const [resendTimer, setTimer] = useState(0)
  const [locationLoading, setLocLoading] = useState(false)
  const navigate = useNavigate()

  const [form, setForm] = useState({
    companyName: '', supplierName: '', email: '',
    password: '', phoneNumber: '', address: '',
    location: '', otp: ''
  })
  const [errors, setErrors] = useState({})

  const ch = (e) => {
    setForm(p => ({ ...p, [e.target.name]: e.target.value }))
    setErrors(p => ({ ...p, [e.target.name]: '' }))
  }

  // Auto-detect location via browser Geolocation
  const detectLocation = () => {
    if (!navigator.geolocation) {
      toast.error('Geolocation not supported')
      return
    }
    setLocLoading(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc = `${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}`
        setForm(p => ({ ...p, location: loc }))
        setLocLoading(false)
        toast.success('Location detected!')
      },
      (err) => {
        setLocLoading(false)
        toast.error('Location access denied. Enter manually.')
      }
    )
  }

  const startTimer = () => {
    setTimer(60)
    const t = setInterval(() => {
      setTimer(v => { if (v <= 1) { clearInterval(t); return 0 } return v - 1 })
    }, 1000)
  }

  const validate1 = () => {
    const e = {}
    if (!form.companyName.trim())  e.companyName  = 'Company name is required'
    if (!form.supplierName.trim()) e.supplierName = 'Your name is required'
    if (!form.email.trim())        e.email        = 'Email is required'
    else if (!/\S+@\S+\.\S+/.test(form.email)) e.email = 'Invalid email'
    if (!form.password)            e.password     = 'Password is required'
    else if (form.password.length < 8) e.password = 'Minimum 8 characters'
    if (!form.phoneNumber.trim())  e.phoneNumber  = 'Phone is required'
    return e
  }

  const handleStep1 = async (e) => {
    e.preventDefault()
    const errs = validate1()
    if (Object.keys(errs).length) { setErrors(errs); return }
    setLoading(true)
    try {
      await supplierAPI.register({
        companyName:  form.companyName,
        supplierName: form.supplierName,
        email:        form.email,
        password:     form.password,
        phoneNumber:  form.phoneNumber,
        address:      form.address,
        location:     form.location,
      })
      toast.success('OTP sent to your email!')
      setStep(1)
      startTimer()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Registration failed')
    } finally { setLoading(false) }
  }

  const handleStep2 = async (e) => {
    e.preventDefault()
    if (!form.otp || form.otp.length !== 6) {
      setErrors({ otp: 'Enter the 6-digit OTP' }); return
    }
    setLoading(true)
    try {
      await supplierAPI.verifyOtp({ email: form.email, otp: form.otp })
      toast.success('Email verified! You can now login.')
      setStep(2)
    } catch (err) {
      setErrors({ otp: err.response?.data?.message || 'Invalid OTP' })
    } finally { setLoading(false) }
  }

  const handleResend = async () => {
    try {
      await supplierAPI.register({
        companyName: form.companyName, supplierName: form.supplierName,
        email: form.email, password: form.password,
        phoneNumber: form.phoneNumber, address: form.address, location: form.location,
      })
      toast.success('OTP resent!')
      startTimer()
    } catch { toast.error('Failed to resend OTP') }
  }

  return (
    <div className="auth-page">
      <div className="auth-bg">
        <div className="auth-bg-circle auth-bg-circle--1" />
        <div className="auth-bg-circle auth-bg-circle--2" />
        <div className="auth-bg-circle auth-bg-circle--3" />
      </div>

      <div className="auth-card auth-card--wide animate-scale">
        {/* Steps */}
        <div className="steps-bar">
          {STEPS.map((s, i) => (
            <div key={i} className={`step-item ${i <= step ? 'step-item--done':''} ${i===step?'step-item--active':''}`}>
              <div className="step-circle">{i < step ? '✓' : i + 1}</div>
              <span className="step-label">{s}</span>
              {i < STEPS.length - 1 && <div className={`step-line ${i < step ? 'step-line--done':''}`} />}
            </div>
          ))}
        </div>

        {/* ── Step 1: Basic Info ── */}
        {step === 0 && (
          <>
            <div className="auth-header">
              <div className="auth-logo" style={{ background:'linear-gradient(135deg,#F59E0B,#FBBF24)' }}>
                <Building2 size={24} style={{ color:'#fff' }} />
              </div>
              <h1 className="auth-title">Supplier Registration</h1>
              <p className="auth-subtitle">Register your company on Smart Inventory</p>
            </div>

            <form className="auth-form" onSubmit={handleStep1}>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Company Name *</label>
                  <div className="input-icon-wrap">
                    <Building2 className="input-icon" size={15} strokeWidth={1.75} />
                    <input name="companyName"
                      className={`form-input input-with-icon ${errors.companyName?'error':''}`}
                      placeholder="ABC Suppliers Ltd" value={form.companyName} onChange={ch} />
                  </div>
                  {errors.companyName && <p className="form-error">{errors.companyName}</p>}
                </div>
                <div className="form-group">
                  <label className="form-label">Your Name *</label>
                  <div className="input-icon-wrap">
                    <User className="input-icon" size={15} strokeWidth={1.75} />
                    <input name="supplierName"
                      className={`form-input input-with-icon ${errors.supplierName?'error':''}`}
                      placeholder="John Doe" value={form.supplierName} onChange={ch} />
                  </div>
                  {errors.supplierName && <p className="form-error">{errors.supplierName}</p>}
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Email Address *</label>
                <div className="input-icon-wrap">
                  <Mail className="input-icon" size={15} strokeWidth={1.75} />
                  <input type="email" name="email"
                    className={`form-input input-with-icon ${errors.email?'error':''}`}
                    placeholder="supplier@company.com" value={form.email} onChange={ch} />
                </div>
                {errors.email && <p className="form-error">{errors.email}</p>}
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Phone Number *</label>
                  <div className="input-icon-wrap">
                    <Phone className="input-icon" size={15} strokeWidth={1.75} />
                    <input name="phoneNumber"
                      className={`form-input input-with-icon ${errors.phoneNumber?'error':''}`}
                      placeholder="+91 9876543210" value={form.phoneNumber} onChange={ch} />
                  </div>
                  {errors.phoneNumber && <p className="form-error">{errors.phoneNumber}</p>}
                </div>
                <div className="form-group">
                  <label className="form-label">Password *</label>
                  <div className="input-icon-wrap">
                    <Lock className="input-icon" size={15} strokeWidth={1.75} />
                    <input type={showPass?'text':'password'} name="password"
                      className={`form-input input-with-icon input-with-right-icon ${errors.password?'error':''}`}
                      placeholder="Min 8 characters" value={form.password} onChange={ch} />
                    <button type="button" className="input-eye" onClick={() => setShowPass(v=>!v)}>
                      {showPass ? <EyeOff size={15} strokeWidth={1.75}/> : <Eye size={15} strokeWidth={1.75}/>}
                    </button>
                  </div>
                  {errors.password && <p className="form-error">{errors.password}</p>}
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Address</label>
                <div className="input-icon-wrap">
                  <MapPin className="input-icon" size={15} strokeWidth={1.75} />
                  <input name="address"
                    className="form-input input-with-icon"
                    placeholder="Street, City, State" value={form.address} onChange={ch} />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Location (Auto-detect or type)</label>
                <div style={{ display:'flex', gap:8 }}>
                  <div className="input-icon-wrap" style={{ flex:1 }}>
                    <MapPin className="input-icon" size={15} strokeWidth={1.75} />
                    <input name="location"
                      className="form-input input-with-icon"
                      placeholder="lat, lng or city name" value={form.location} onChange={ch} />
                  </div>
                  <button type="button" className="btn btn-secondary btn-sm"
                    onClick={detectLocation} disabled={locationLoading}
                    style={{ whiteSpace:'nowrap', flexShrink:0 }}>
                    {locationLoading ? <span className="btn-spinner" /> : '📍 Detect'}
                  </button>
                </div>
              </div>

              <button type="submit" className="btn btn-primary auth-submit" disabled={loading}>
                {loading ? <span className="btn-spinner" /> : 'Send OTP →'}
              </button>
            </form>
            <p className="auth-link-text">
              Already registered? <Link to="/login?role=SUPPLIER" className="auth-link">Sign In</Link>
            </p>
          </>
        )}

        {/* ── Step 2: OTP Verify ── */}
        {step === 1 && (
          <>
            <div className="auth-header">
              <div className="auth-logo" style={{ fontSize:28 }}>📧</div>
              <h1 className="auth-title">Verify Your Email</h1>
              <p className="auth-subtitle">
                Enter the 6-digit OTP sent to <strong>{form.email}</strong>
              </p>
            </div>
            <form className="auth-form" onSubmit={handleStep2}>
              <div className="form-group">
                <label className="form-label">OTP Code</label>
                <input name="otp"
                  className={`form-input otp-input ${errors.otp?'error':''}`}
                  placeholder="000000" maxLength={6}
                  value={form.otp} onChange={ch}
                  style={{ textAlign:'center', letterSpacing:'12px', fontSize:'24px' }}
                  autoFocus />
                {errors.otp && <p className="form-error" style={{ textAlign:'center' }}>{errors.otp}</p>}
              </div>
              <button type="submit" className="btn btn-primary auth-submit" disabled={loading}>
                {loading ? <span className="btn-spinner" /> : 'Verify OTP →'}
              </button>
              <div className="resend-row">
                {resendTimer > 0
                  ? <span className="resend-timer">Resend in {resendTimer}s</span>
                  : <button type="button" className="resend-btn" onClick={handleResend}>Resend OTP</button>
                }
              </div>
            </form>
          </>
        )}

        {/* ── Step 3: Success ── */}
        {step === 2 && (
          <div className="auth-success">
            <div className="success-icon">🎉</div>
            <h2>Registration Complete!</h2>
            <p>Your supplier account is verified and ready.<br />You can now sign in.</p>
            <button className="btn btn-primary auth-submit" onClick={() => navigate('/login?role=SUPPLIER', { state: { role: 'SUPPLIER' } })}>
              Go to Sign In →
            </button>
          </div>
        )}

        <div style={{ textAlign:'center', marginTop:16 }}>
          <Link to="/" style={{ fontSize:13, color:'var(--text-3)', fontWeight:500 }}>← Back to Home</Link>
        </div>
      </div>
    </div>
  )
}
