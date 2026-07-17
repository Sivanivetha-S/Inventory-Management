import React, { useState, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { authAPI } from '../../services/api'
import toast from 'react-hot-toast'
import { Mail, Lock, Eye, EyeOff, ArrowLeft } from 'lucide-react'
import './Auth.css'

export default function ForgotPasswordPage() {
  const [step, setStep]         = useState(0)  // 0=email  1=otp  2=newpass  3=done
  const [email, setEmail]       = useState('')
  const [otp, setOtp]           = useState('')
  const [otpError, setOtpError] = useState('')
  const [newPass, setNewPass]   = useState('')
  const [confirmPass, setConfirmPass] = useState('')
  const [showNew, setShowNew]   = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [loading, setLoading]   = useState(false)
  const [resendTimer, setTimer] = useState(0)
  const timerRef                = useRef(null)
  const navigate                = useNavigate()

  /* ── Resend timer ── */
  const startTimer = () => {
    setTimer(60)
    clearInterval(timerRef.current)
    timerRef.current = setInterval(() => {
      setTimer(t => { if (t <= 1) { clearInterval(timerRef.current); return 0 } return t - 1 })
    }, 1000)
  }

  /* ── Step 0: Send OTP to email ── */
  const handleSendOtp = async (e) => {
    e.preventDefault()
    if (!email.trim()) { toast.error('Please enter your email'); return }
    setLoading(true)
    try {
      await authAPI.forgotPassword(email.trim())
      toast.success('OTP sent to your email!')
      setStep(1)
      startTimer()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Email not found')
    } finally { setLoading(false) }
  }

  /* ── Step 1: Verify OTP ── */
  const handleVerifyOtp = async (e) => {
    e.preventDefault()
    if (!otp || otp.length !== 6) { setOtpError('Enter the 6-digit OTP'); return }
    setLoading(true)
    try {
      await authAPI.verifyResetOtp(email.trim(), otp)
      toast.success('OTP verified!')
      setStep(2)
    } catch (err) {
      setOtpError(err.response?.data?.message || 'Invalid or expired OTP')
    } finally { setLoading(false) }
  }

  /* ── Resend OTP ── */
  const handleResend = async () => {
    try {
      await authAPI.forgotPassword(email.trim())
      toast.success('OTP resent!')
      startTimer()
    } catch { toast.error('Failed to resend OTP') }
  }

  /* ── Step 2: Reset Password ── */
  const handleReset = async (e) => {
    e.preventDefault()
    if (newPass.length < 8) { toast.error('Password must be at least 8 characters'); return }
    if (newPass !== confirmPass) { toast.error('Passwords do not match'); return }
    setLoading(true)
    try {
      await authAPI.resetPassword(email.trim(), otp, newPass)
      toast.success('Password reset successfully!')
      setStep(3)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to reset password')
    } finally { setLoading(false) }
  }

  return (
    <div className="auth-page">
      <div className="auth-bg">
        <div className="auth-bg-circle auth-bg-circle--1" />
        <div className="auth-bg-circle auth-bg-circle--2" />
        <div className="auth-bg-circle auth-bg-circle--3" />
      </div>

      <div className="auth-card">

        {/* ════════════════════════
            STEP 0 — Enter Email
        ════════════════════════ */}
        {step === 0 && (
          <>
            <div className="auth-header">
              <div className="auth-logo">SI</div>
              <h1 className="auth-title">Forgot Password</h1>
              <p className="auth-subtitle">
                Enter your registered email address.<br />
                We'll send you a 6-digit OTP to reset your password.
              </p>
            </div>

            <form className="auth-form" onSubmit={handleSendOtp}>
              <div className="form-group">
                <label className="form-label">Email Address</label>
                <div className="input-icon-wrap">
                  <Mail className="input-icon" size={15} strokeWidth={1.75} />
                  <input
                    type="email"
                    className="form-input input-with-icon"
                    placeholder="admin@example.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    autoComplete="email"
                    autoFocus
                  />
                </div>
              </div>

              <button type="submit" className="btn btn-primary auth-submit" disabled={loading}>
                {loading ? <span className="btn-spinner" /> : 'Send OTP →'}
              </button>
            </form>

            <div className="auth-fp-links">
              <Link to="/login" className="auth-fp-back">
                <ArrowLeft size={14} strokeWidth={2} /> Back to Sign In
              </Link>
              <Link to="/" className="auth-fp-home">Back to Home</Link>
            </div>
          </>
        )}

        {/* ════════════════════════
            STEP 1 — Enter OTP
        ════════════════════════ */}
        {step === 1 && (
          <>
            <div className="auth-header">
              <div className="auth-logo" style={{ fontSize:26 }}>📧</div>
              <h1 className="auth-title">Check Your Email</h1>
              <p className="auth-subtitle">
                We sent a 6-digit OTP to<br />
                <strong style={{ color:'var(--text-h)' }}>{email}</strong>
              </p>
            </div>

            <form className="auth-form" onSubmit={handleVerifyOtp}>
              <div className="form-group">
                <label className="form-label">Enter OTP</label>
                <input
                  className={`form-input otp-input ${otpError ? 'error' : ''}`}
                  placeholder="000000"
                  maxLength={6}
                  value={otp}
                  onChange={e => { setOtp(e.target.value); setOtpError('') }}
                  autoFocus
                />
                {otpError && <p className="form-error" style={{ textAlign:'center' }}>{otpError}</p>}
              </div>

              <button type="submit" className="btn btn-primary auth-submit" disabled={loading}>
                {loading ? <span className="btn-spinner" /> : 'Verify OTP →'}
              </button>
            </form>

            <div className="resend-row" style={{ marginTop:12 }}>
              {resendTimer > 0
                ? <span className="resend-timer">Resend OTP in {resendTimer}s</span>
                : <button className="resend-btn" onClick={handleResend}>Resend OTP</button>
              }
            </div>

            <div className="auth-fp-links">
              <button className="auth-fp-back btn-reset" onClick={() => setStep(0)}>
                <ArrowLeft size={14} strokeWidth={2} /> Change Email
              </button>
              <Link to="/" className="auth-fp-home">Back to Home</Link>
            </div>
          </>
        )}

        {/* ════════════════════════
            STEP 2 — New Password
        ════════════════════════ */}
        {step === 2 && (
          <>
            <div className="auth-header">
              <div className="auth-logo" style={{ fontSize:26 }}>🔒</div>
              <h1 className="auth-title">Set New Password</h1>
              <p className="auth-subtitle">Choose a strong password with at least 8 characters.</p>
            </div>

            <form className="auth-form" onSubmit={handleReset}>
              <div className="form-group">
                <label className="form-label">New Password</label>
                <div className="input-icon-wrap">
                  <Lock className="input-icon" size={15} strokeWidth={1.75} />
                  <input
                    type={showNew ? 'text' : 'password'}
                    className="form-input input-with-icon input-with-right-icon"
                    placeholder="Minimum 8 characters"
                    value={newPass}
                    onChange={e => setNewPass(e.target.value)}
                    autoFocus
                  />
                  <button type="button" className="input-eye" onClick={() => setShowNew(v => !v)}>
                    {showNew ? <EyeOff size={15} strokeWidth={1.75} /> : <Eye size={15} strokeWidth={1.75} />}
                  </button>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Confirm Password</label>
                <div className="input-icon-wrap">
                  <Lock className="input-icon" size={15} strokeWidth={1.75} />
                  <input
                    type={showConfirm ? 'text' : 'password'}
                    className="form-input input-with-icon input-with-right-icon"
                    placeholder="Repeat your new password"
                    value={confirmPass}
                    onChange={e => setConfirmPass(e.target.value)}
                  />
                  <button type="button" className="input-eye" onClick={() => setShowConfirm(v => !v)}>
                    {showConfirm ? <EyeOff size={15} strokeWidth={1.75} /> : <Eye size={15} strokeWidth={1.75} />}
                  </button>
                </div>
                {/* live match indicator */}
                {confirmPass && (
                  <p style={{ fontSize:12, marginTop:4, color: newPass === confirmPass ? 'var(--ok)' : 'var(--err)' }}>
                    {newPass === confirmPass ? '✓ Passwords match' : '✗ Passwords do not match'}
                  </p>
                )}
              </div>

              <button
                type="submit"
                className="btn btn-primary auth-submit"
                disabled={loading || newPass !== confirmPass || newPass.length < 8}
              >
                {loading ? <span className="btn-spinner" /> : 'Reset Password'}
              </button>
            </form>

            <div className="auth-fp-links">
              <Link to="/" className="auth-fp-home">Back to Home</Link>
            </div>
          </>
        )}

        {/* ════════════════════════
            STEP 3 — Success
        ════════════════════════ */}
        {step === 3 && (
          <div className="auth-success">
            <div className="success-icon">🎉</div>
            <h2>Password Reset!</h2>
            <p>Your password has been updated successfully.<br />You can now sign in with your new password.</p>
            <button
              className="btn btn-primary auth-submit"
              onClick={() => navigate('/login')}
            >
              Go to Sign In →
            </button>
            <div className="auth-fp-links" style={{ marginTop:12 }}>
              <Link to="/" className="auth-fp-home">Back to Home</Link>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
