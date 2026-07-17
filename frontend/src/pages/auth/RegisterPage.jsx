import React, { useState, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { authAPI } from '../../services/api'
import toast from 'react-hot-toast'
import { User, Mail, Lock, Phone, ShoppingBag, Tag, Eye, EyeOff } from 'lucide-react'
import './Auth.css'

const STEPS = ['Basic Info', 'Verify OTP', 'Shop Details', 'Complete']

const SHOP_CATEGORIES = [
  'Grocery', 'Electronics', 'Clothing', 'Pharmacy', 'Hardware',
  'Stationary', 'Food & Beverages', 'Cosmetics', 'Sports', 'Other'
]

export default function RegisterPage() {
  const [step, setStep]          = useState(0)
  const [loading, setLoading]    = useState(false)
  const [showPass, setShowPass]  = useState(false)
  const [resendTimer, setTimer]  = useState(0)
  const timerRef                 = useRef(null)
  const navigate                 = useNavigate()

  const [form, setForm] = useState({
    fullName: '', email: '', password: '', phoneNumber: '',
    otp: '', shopName: '', shopCategory: ''
  })
  const [errors, setErrors] = useState({})

  const change = (e) => {
    setForm(p => ({ ...p, [e.target.name]: e.target.value }))
    setErrors(p => ({ ...p, [e.target.name]: '' }))
  }

  const validate1 = () => {
    const e = {}
    if (!form.fullName.trim()) e.fullName = 'Full name is required'
    if (!form.email.trim()) e.email = 'Email is required'
    else if (!/\S+@\S+\.\S+/.test(form.email)) e.email = 'Invalid email'
    if (!form.password) e.password = 'Password is required'
    else if (form.password.length < 8) e.password = 'Minimum 8 characters'
    if (!form.phoneNumber.trim()) e.phoneNumber = 'Phone is required'
    return e
  }

  const validate3 = () => {
    const e = {}
    if (!form.shopName.trim()) e.shopName = 'Shop name is required'
    if (!form.shopCategory) e.shopCategory = 'Shop category is required'
    return e
  }

  const startResendTimer = () => {
    setTimer(60)
    timerRef.current = setInterval(() => {
      setTimer(t => { if (t <= 1) { clearInterval(timerRef.current); return 0 } return t - 1 })
    }, 1000)
  }

  // Step 1: submit basic info
  const handleStep1 = async (e) => {
    e.preventDefault()
    const errs = validate1()
    if (Object.keys(errs).length) { setErrors(errs); return }
    setLoading(true)
    try {
      await authAPI.registerStep1({
        fullName: form.fullName, email: form.email,
        password: form.password, phoneNumber: form.phoneNumber
      })
      toast.success('OTP sent to your email!')
      setStep(1)
      startResendTimer()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  // Step 2: verify OTP
  const handleStep2 = async (e) => {
    e.preventDefault()
    if (!form.otp || form.otp.length !== 6) {
      setErrors({ otp: 'Enter the 6-digit OTP' }); return
    }
    setLoading(true)
    try {
      await authAPI.verifyOtp({ email: form.email, otp: form.otp })
      toast.success('Email verified!')
      setStep(2)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Invalid OTP')
    } finally {
      setLoading(false)
    }
  }

  // Step 3: shop details
  const handleStep3 = async (e) => {
    e.preventDefault()
    const errs = validate3()
    if (Object.keys(errs).length) { setErrors(errs); return }
    setLoading(true)
    try {
      await authAPI.registerStep3({
        email: form.email, shopName: form.shopName, shopCategory: form.shopCategory
      })
      toast.success('Registration complete!')
      setStep(3)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to complete registration')
    } finally {
      setLoading(false)
    }
  }

  const handleResend = async () => {
    try {
      await authAPI.resendOtp(form.email)
      toast.success('OTP resent!')
      startResendTimer()
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
        {/* Steps indicator */}
        <div className="steps-bar">
          {STEPS.map((s, i) => (
            <div key={i} className={`step-item ${i <= step ? 'step-item--done' : ''} ${i === step ? 'step-item--active' : ''}`}>
              <div className="step-circle">{i < step ? '✓' : i + 1}</div>
              <span className="step-label">{s}</span>
              {i < STEPS.length - 1 && <div className={`step-line ${i < step ? 'step-line--done' : ''}`} />}
            </div>
          ))}
        </div>

        {/* Step 1 */}
        {step === 0 && (
          <>
            <div className="auth-header">
              <div className="auth-logo">SI</div>
              <h1 className="auth-title">Create Account</h1>
              <p className="auth-subtitle">Enter your basic details</p>
            </div>
            <form className="auth-form" onSubmit={handleStep1}>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Full Name</label>
                  <div className="input-icon-wrap">
                    <User className="input-icon" size={15} strokeWidth={1.75} />
                    <input name="fullName" className={`form-input input-with-icon ${errors.fullName?'error':''}`}
                      placeholder="John Doe" value={form.fullName} onChange={change} />
                  </div>
                  {errors.fullName && <p className="form-error">{errors.fullName}</p>}
                </div>
                <div className="form-group">
                  <label className="form-label">Phone Number</label>
                  <div className="input-icon-wrap">
                    <Phone className="input-icon" size={15} strokeWidth={1.75} />
                    <input name="phoneNumber" className={`form-input input-with-icon ${errors.phoneNumber?'error':''}`}
                      placeholder="+91 9876543210" value={form.phoneNumber} onChange={change} />
                  </div>
                  {errors.phoneNumber && <p className="form-error">{errors.phoneNumber}</p>}
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Email Address</label>
                <div className="input-icon-wrap">
                  <Mail className="input-icon" size={15} strokeWidth={1.75} />
                  <input type="email" name="email" className={`form-input input-with-icon ${errors.email?'error':''}`}
                    placeholder="admin@example.com" value={form.email} onChange={change} />
                </div>
                {errors.email && <p className="form-error">{errors.email}</p>}
              </div>
              <div className="form-group">
                <label className="form-label">Password</label>
                <div className="input-icon-wrap">
                  <Lock className="input-icon" size={15} strokeWidth={1.75} />
                  <input type={showPass?'text':'password'} name="password"
                    className={`form-input input-with-icon input-with-right-icon ${errors.password?'error':''}`}
                    placeholder="Minimum 8 characters" value={form.password} onChange={change} />
                  <button type="button" className="input-eye" onClick={() => setShowPass(!showPass)}>
                  {showPass ? <EyeOff size={15} strokeWidth={1.75} /> : <Eye size={15} strokeWidth={1.75} />}
                  </button>
                </div>
                {errors.password && <p className="form-error">{errors.password}</p>}
              </div>
              <button type="submit" className="btn btn-primary auth-submit" disabled={loading}>
                {loading ? <span className="btn-spinner" /> : 'Send OTP →'}
              </button>
            </form>
            <p className="auth-link-text">Already have an account? <Link to="/login" className="auth-link">Sign In</Link></p>
          </>
        )}

        {/* Step 2: OTP */}
        {step === 1 && (
          <>
            <div className="auth-header">
              <div className="auth-logo otp-logo">📧</div>
              <h1 className="auth-title">Verify Your Email</h1>
              <p className="auth-subtitle">Enter the 6-digit OTP sent to <strong>{form.email}</strong></p>
            </div>
            <form className="auth-form" onSubmit={handleStep2}>
              <div className="form-group">
                <label className="form-label">OTP Code</label>
                <input name="otp" className={`form-input otp-input ${errors.otp?'error':''}`}
                  placeholder="000000" maxLength={6} value={form.otp} onChange={change}
                  style={{ textAlign:'center', letterSpacing:'12px', fontSize:'24px' }} />
                {errors.otp && <p className="form-error">{errors.otp}</p>}
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

        {/* Step 3: Shop */}
        {step === 2 && (
          <>
            <div className="auth-header">
              <div className="auth-logo">🏪</div>
              <h1 className="auth-title">Shop Details</h1>
              <p className="auth-subtitle">Tell us about your shop</p>
            </div>
            <form className="auth-form" onSubmit={handleStep3}>
              <div className="form-group">
                <label className="form-label">Shop Name</label>
                <div className="input-icon-wrap">
                  <ShoppingBag className="input-icon" size={15} strokeWidth={1.75} />
                  <input name="shopName" className={`form-input input-with-icon ${errors.shopName?'error':''}`}
                    placeholder="My Amazing Shop" value={form.shopName} onChange={change} />
                </div>
                {errors.shopName && <p className="form-error">{errors.shopName}</p>}
              </div>
              <div className="form-group">
                <label className="form-label">Shop Category</label>
                <div className="input-icon-wrap">
                  <Tag className="input-icon" size={15} strokeWidth={1.75} />
                  <select name="shopCategory" className={`form-input input-with-icon ${errors.shopCategory?'error':''}`}
                    value={form.shopCategory} onChange={change}>
                    <option value="">Select a category</option>
                    {SHOP_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                {errors.shopCategory && <p className="form-error">{errors.shopCategory}</p>}
              </div>
              <button type="submit" className="btn btn-primary auth-submit" disabled={loading}>
                {loading ? <span className="btn-spinner" /> : 'Complete Registration →'}
              </button>
            </form>
          </>
        )}

        {/* Step 4: Success */}
        {step === 3 && (
          <div className="auth-success">
            <div className="success-icon">🎉</div>
            <h2>Registration Complete!</h2>
            <p>Your Smart Inventory account is ready. You can now log in.</p>
            <button className="btn btn-primary auth-submit" onClick={() => navigate('/login')}>
              Go to Login →
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
