import React, { useEffect, useState, useCallback, useRef } from 'react'
import { customerAPI } from '../services/api'
import toast from 'react-hot-toast'
import {
  Plus, Edit2, Trash2, Search, Users,
  X, Mail, Phone, MapPin, CheckCircle, Clock, AlertTriangle
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import './Customers.css'

const EMPTY_FORM = { name: '', email: '', phoneNumber: '', address: '' }

export default function Customers() {
  const { activeBranchId } = useAuth()
  const [customers, setCustomers]   = useState([])
  const [loading, setLoading]       = useState(true)
  const [search, setSearch]         = useState('')
  const [modalOpen, setModalOpen]   = useState(false)
  const [editing, setEditing]       = useState(null)
  const [form, setForm]             = useState(EMPTY_FORM)
  const [errors, setErrors]         = useState({})
  const [saving, setSaving]         = useState(false)
  const [deleteId, setDeleteId]     = useState(null)

  const [otpModal, setOtpModal]     = useState(null)
  const [otp, setOtp]               = useState('')
  const [otpError, setOtpError]     = useState('')
  const [verifying, setVerifying]   = useState(false)
  const [resendTimer, setTimer]     = useState(0)
  const timerRef                    = useRef(null)

  const load = useCallback(() => {
    setCustomers([])
    setLoading(true)
    customerAPI.getAll()
      .then(r => setCustomers(r.data.data))
      .catch(() => toast.error('Failed to load customers'))
      .finally(() => setLoading(false))
  }, [activeBranchId])

  useEffect(() => { load() }, [load])

  const filtered = customers.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.email || '').toLowerCase().includes(search.toLowerCase()) ||
    (c.phoneNumber || '').includes(search)
  )

  const startTimer = () => {
    setTimer(60)
    clearInterval(timerRef.current)
    timerRef.current = setInterval(() => {
      setTimer(t => { if (t <= 1) { clearInterval(timerRef.current); return 0 } return t - 1 })
    }, 1000)
  }

  const openAdd  = () => { setEditing(null); setForm(EMPTY_FORM); setErrors({}); setModalOpen(true) }
  const openEdit = (c) => {
    setEditing(c.id)
    setForm({ name: c.name, email: c.email || '', phoneNumber: c.phoneNumber || '', address: c.address || '' })
    setErrors({})
    setModalOpen(true)
  }

  const validate = () => {
    const e = {}
    if (!form.name.trim()) e.name = 'Name is required'
    if (form.email && !/\S+@\S+\.\S+/.test(form.email)) e.email = 'Invalid email format'
    return e
  }

  const handleSave = async (ev) => {
    ev.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length) { setErrors(errs); return }
    setSaving(true)
    try {
      if (editing) {
        await customerAPI.update(editing, form)
        toast.success('Customer updated!')
        setModalOpen(false); load()
      } else {
        await customerAPI.create(form)
        const hasEmail = form.email && form.email.trim() !== ''
        setModalOpen(false); load()
        if (hasEmail) {
          toast.success('OTP sent to customer email!')
          setOtp(''); setOtpError('')
          setOtpModal({ email: form.email, name: form.name })
          startTimer()
        } else {
          toast.success('Customer added!')
        }
      }
    } catch (err) {
      const errMsg = err.response?.data?.message
      if (errMsg === 'Customer already exists in another branch.') {
        if (window.confirm('Customer already exists in another branch. Do you want to add this existing customer to this branch?')) {
          try {
            const searchRes = await customerAPI.searchByEmail(form.email)
            if (searchRes.data?.success) {
              const cust = searchRes.data.data
              const linkRes = await customerAPI.linkBranch(cust.id)
              if (linkRes.data?.success) {
                toast.success('Customer added to this branch successfully!')
                setModalOpen(false); load()
              }
            }
          } catch (linkErr) {
            toast.error(linkErr.response?.data?.message || 'Failed to link customer')
          }
        }
      } else {
        toast.error(errMsg || 'Save failed')
      }
    } finally { setSaving(false) }
  }

  const handleVerifyOtp = async () => {
    if (!otp || otp.length !== 6) { setOtpError('Enter the 6-digit OTP'); return }
    setVerifying(true)
    try {
      await customerAPI.verifyOtp({ email: otpModal.email, otp })
      toast.success('Customer verified and activated!')
      setOtpModal(null); load()
    } catch (err) {
      setOtpError(err.response?.data?.message || 'Invalid OTP')
    } finally { setVerifying(false) }
  }

  const handleResendOtp = async () => {
    try {
      await customerAPI.resendOtp(otpModal.email)
      toast.success('OTP resent!'); startTimer()
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to resend OTP') }
  }

  const openOtpForPending = (c) => {
    setOtp(''); setOtpError('')
    setOtpModal({ email: c.email, name: c.name })
    startTimer()
  }

  const handleDelete = async (id) => {
    try {
      await customerAPI.delete(id)
      toast.success('Customer deleted')
      setDeleteId(null); load()
    } catch (err) { toast.error(err.response?.data?.message || 'Delete failed') }
  }

  const ch = (e) => {
    setForm(p => ({ ...p, [e.target.name]: e.target.value }))
    setErrors(p => ({ ...p, [e.target.name]: '' }))
  }

  const pendingCount = customers.filter(c => !c.emailVerified && c.email).length

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Customers</h1>
          <p className="page-subtitle">
            {customers.length} total &nbsp;·&nbsp;
            <span style={{ color:'var(--ok)', fontWeight:600 }}>{customers.filter(c => c.emailVerified).length} verified</span>
            &nbsp;·&nbsp;
            <span style={{ color:'var(--warn)', fontWeight:600 }}>{pendingCount} pending</span>
          </p>
        </div>
        <div style={{ display:'flex', gap:12, alignItems:'center' }}>
          <div className="search-bar">
            <Search size={15} strokeWidth={1.75} />
            <input placeholder="Search customers..." value={search} onChange={e => setSearch(e.target.value)} />
            {search && <button onClick={() => setSearch('')} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-4)', display:'flex' }}><X size={14} /></button>}
          </div>
          <button className="btn btn-primary" onClick={openAdd}><Plus size={15} strokeWidth={2} /> Add Customer</button>
        </div>
      </div>

      {/* OTP pending banner */}
      {pendingCount > 0 && (
        <div className="customers-otp-banner">
          <AlertTriangle size={18} strokeWidth={1.75} style={{ flexShrink:0 }} />
          <span>
            <strong>{pendingCount} customer(s)</strong> pending OTP verification.
            Click the <strong>Verify OTP</strong> button next to them.
          </span>
        </div>
      )}

      {loading
        ? <div className="loading-center"><div className="spinner" /></div>
        : filtered.length === 0
          ? <div className="empty-state"><Users size={48} /><h3>No customers found</h3></div>
          : <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>#</th><th>Name</th><th>Email</th><th>Phone</th>
                    <th>Address</th><th>Status</th><th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((c, i) => (
                    <tr key={c.id}>
                      <td>{i + 1}</td>
                      <td><strong>{c.name}</strong></td>
                      <td>
                        {c.email
                          ? <span style={{ display:'flex', alignItems:'center', gap:5, color:'var(--text-2)' }}>
                              <Mail size={13} strokeWidth={1.75} style={{ color:'var(--text-4)', flexShrink:0 }} />{c.email}
                            </span>
                          : <span style={{ color:'var(--text-4)' }}>—</span>}
                      </td>
                      <td>
                        {c.phoneNumber
                          ? <span style={{ display:'flex', alignItems:'center', gap:5, color:'var(--text-2)' }}>
                              <Phone size={13} strokeWidth={1.75} style={{ color:'var(--text-4)', flexShrink:0 }} />{c.phoneNumber}
                            </span>
                          : <span style={{ color:'var(--text-4)' }}>—</span>}
                      </td>
                      <td>
                        {c.address
                          ? <span style={{ display:'flex', alignItems:'center', gap:5, color:'var(--text-2)' }}>
                              <MapPin size={13} strokeWidth={1.75} style={{ color:'var(--text-4)', flexShrink:0 }} />{c.address}
                            </span>
                          : <span style={{ color:'var(--text-4)' }}>—</span>}
                      </td>
                      <td>
                        {!c.email
                          ? <span className="badge badge-gray">Walk-in</span>
                          : c.emailVerified
                            ? <span className="badge badge-success"><CheckCircle size={11} strokeWidth={2} /> Verified</span>
                            : <span className="badge badge-warning"><Clock size={11} strokeWidth={2} /> Pending OTP</span>}
                      </td>
                      <td>
                        <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                          {c.email && !c.emailVerified && (
                            <button className="btn btn-primary btn-sm" onClick={() => openOtpForPending(c)}>Verify OTP</button>
                          )}
                          <button className="btn-icon btn-icon-edit" onClick={() => openEdit(c)} title="Edit"><Edit2 size={14} strokeWidth={1.75} /></button>
                          <button className="btn-icon btn-icon-delete" onClick={() => setDeleteId(c.id)} title="Delete"><Trash2 size={14} strokeWidth={1.75} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
      }

      {/* Add / Edit Modal */}
      {modalOpen && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModalOpen(false)}>
          <div className="modal-box">
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
              <h2 style={{ fontSize:20, fontWeight:700 }}>{editing ? 'Edit Customer' : 'Add Customer'}</h2>
              <button className="btn-icon" onClick={() => setModalOpen(false)}><X size={16} strokeWidth={1.75} /></button>
            </div>

            {!editing && (
              <div className="customers-info-banner">
                💡 If you provide an email, an <strong>OTP will be sent to the customer</strong>.
                Walk-in customers without email are added instantly.
              </div>
            )}

            <form onSubmit={handleSave}>
              <div className="form-group">
                <label className="form-label">Full Name *</label>
                <input name="name" className={`form-input ${errors.name ? 'error' : ''}`}
                  value={form.name} onChange={ch} placeholder="Customer name" />
                {errors.name && <p className="form-error">{errors.name}</p>}
              </div>
              <div className="form-group">
                <label className="form-label">
                  Email Address
                  <span style={{ color:'var(--text-4)', fontWeight:400, marginLeft:6, fontSize:12 }}>(OTP will be sent here)</span>
                </label>
                <input type="email" name="email" className={`form-input ${errors.email ? 'error' : ''}`}
                  value={form.email} onChange={ch} placeholder="customer@example.com" />
                {errors.email && <p className="form-error">{errors.email}</p>}
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                <div className="form-group">
                  <label className="form-label">Phone Number</label>
                  <input name="phoneNumber" className="form-input" value={form.phoneNumber} onChange={ch} placeholder="+91 9876543210" />
                </div>
                <div className="form-group">
                  <label className="form-label">Address</label>
                  <input name="address" className="form-input" value={form.address} onChange={ch} placeholder="Customer address" />
                </div>
              </div>
              <div style={{ display:'flex', gap:12, justifyContent:'flex-end', marginTop:8 }}>
                <button type="button" className="btn btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? <span className="btn-spinner" /> : (editing ? 'Update' : 'Add & Send OTP')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* OTP Verification Modal */}
      {otpModal && (
        <div className="modal-overlay">
          <div className="modal-box" style={{ maxWidth:440 }}>
            <div style={{ textAlign:'center', marginBottom:24 }}>
              <div className="otp-modal-icon">
                <Mail size={28} strokeWidth={1.75} style={{ color:'#fff' }} />
              </div>
              <h2 style={{ fontSize:22, fontWeight:700, marginBottom:8 }}>Verify Customer Email</h2>
              <p style={{ color:'var(--text-3)', fontSize:14, lineHeight:1.6 }}>
                OTP sent to <strong style={{ color:'var(--text-h)' }}>{otpModal.email}</strong>.<br />
                Enter the 6-digit code to activate <strong style={{ color:'var(--text-h)' }}>{otpModal.name}</strong>.
              </p>
            </div>
            <div className="form-group">
              <label className="form-label" style={{ textAlign:'center', display:'block' }}>Enter OTP</label>
              <input className={`form-input otp-big-input ${otpError ? 'error' : ''}`}
                maxLength={6} value={otp}
                onChange={e => { setOtp(e.target.value); setOtpError('') }}
                placeholder="000000" autoFocus />
              {otpError && <p className="form-error" style={{ textAlign:'center' }}>{otpError}</p>}
            </div>
            <button className="btn btn-primary"
              style={{ width:'100%', justifyContent:'center', padding:'13px', fontSize:15, marginBottom:12 }}
              onClick={handleVerifyOtp} disabled={verifying}>
              {verifying ? <span className="btn-spinner" /> : <><CheckCircle size={16} strokeWidth={2} /> Verify &amp; Activate Customer</>}
            </button>
            <div className="resend-row">
              {resendTimer > 0
                ? <span className="resend-timer">Resend OTP in {resendTimer}s</span>
                : <button className="resend-btn" onClick={handleResendOtp}>Resend OTP</button>}
            </div>
            <button className="close-later-btn" onClick={() => setOtpModal(null)}>Close (verify later)</button>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {deleteId && (
        <div className="modal-overlay">
          <div className="modal-box" style={{ maxWidth:400, textAlign:'center' }}>
            <div style={{ width:64, height:64, borderRadius:'var(--r-lg)', background:'var(--err-bg)', border:'1px solid var(--err-bdr)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 16px' }}>
              <Trash2 size={28} strokeWidth={1.75} style={{ color:'var(--err)' }} />
            </div>
            <h3 style={{ fontSize:20, fontWeight:700, marginBottom:8 }}>Delete Customer?</h3>
            <p style={{ color:'var(--text-3)', marginBottom:24 }}>This will remove the customer and all their invoices.</p>
            <div style={{ display:'flex', gap:12, justifyContent:'center' }}>
              <button className="btn btn-secondary" onClick={() => setDeleteId(null)}>Cancel</button>
              <button className="btn btn-danger" onClick={() => handleDelete(deleteId)}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
