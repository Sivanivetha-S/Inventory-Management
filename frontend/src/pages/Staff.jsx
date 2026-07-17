import React, { useEffect, useState, useCallback } from 'react'
import { staffAPI, branchAPI } from '../services/api'
import toast from 'react-hot-toast'
import { motion } from 'framer-motion'
import {
  Plus, Edit2, Trash2, Search, X, Users,
  ToggleLeft, ToggleRight, Mail, Phone, ShieldCheck, ShieldOff,
  UserCheck, Calendar, Receipt, User
} from 'lucide-react'

const EMPTY_FORM = { fullName: '', email: '', username: '', password: '', phoneNumber: '', loginPermission: false, billingPermission: false, branchId: '' }

import { useAuth } from '../context/AuthContext'

const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.06 } } }
const item = { hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0, transition: { duration: 0.3 } } }

export default function Staff() {
  const { activeBranchId } = useAuth()
  const [staff, setStaff]         = useState([])
  const [branches, setBranches]   = useState([])
  const [loading, setLoading]     = useState(true)
  const [search, setSearch]       = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing]     = useState(null)
  const [form, setForm]           = useState(EMPTY_FORM)
  const [errors, setErrors]       = useState({})
  const [saving, setSaving]       = useState(false)
  const [deleteId, setDeleteId]   = useState(null)

  const load = useCallback(() => {
    setStaff([])
    setLoading(true)
    staffAPI.getAll()
      .then(r => setStaff(r.data.data))
      .catch(() => toast.error('Failed to load staff'))
      .finally(() => setLoading(false))
    branchAPI.getAll()
      .then(r => setBranches(r.data.data || []))
      .catch(() => {})
  }, [activeBranchId])

  useEffect(() => { load() }, [load])

  const filtered = staff.filter(s =>
    s.fullName.toLowerCase().includes(search.toLowerCase()) ||
    s.email.toLowerCase().includes(search.toLowerCase()) ||
    s.username.toLowerCase().includes(search.toLowerCase()) ||
    (s.phoneNumber || '').includes(search)
  )

  const openAdd  = () => {
    setEditing(null)
    setForm({ ...EMPTY_FORM, branchId: activeBranchId !== 'all' ? activeBranchId : '' })
    setErrors({})
    setModalOpen(true)
  }
  const openEdit = (s) => {
    setEditing(s.id)
    setForm({
      fullName: s.fullName,
      email: s.email,
      username: s.username,
      password: '',
      phoneNumber: s.phoneNumber,
      loginPermission: s.loginPermission,
      billingPermission: s.billingPermission,
      branchId: s.branchId || ''
    })
    setErrors({}); setModalOpen(true)
  }

  const validate = () => {
    const e = {}
    if (!form.fullName.trim()) e.fullName = 'Full name is required'
    if (!form.email.trim()) e.email = 'Email is required'
    if (!form.username.trim()) e.username = 'Username is required'
    if (!editing && !form.password) e.password = 'Password is required'
    if (!editing && form.password && form.password.length < 8) e.password = 'Min 8 characters'
    if (!form.phoneNumber.trim()) e.phoneNumber = 'Phone is required'
    return e
  }

  const handleSave = async (e) => {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length) { setErrors(errs); return }
    setSaving(true)
    try {
      if (editing) {
        await staffAPI.update(editing, form)
        toast.success('Staff updated!')
      } else {
        await staffAPI.add(form)
        toast.success('Staff added!')
      }
      setModalOpen(false); load()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Save failed')
    } finally { setSaving(false) }
  }

  const handleToggle = async (id) => {
    try {
      const r = await staffAPI.toggle(id)
      toast.success(r.data.message)
      load()
    } catch { toast.error('Toggle failed') }
  }

  const handleToggleLogin = async (id) => {
    try {
      const r = await staffAPI.toggleLogin(id)
      toast.success(r.data.message)
      load()
    } catch { toast.error('Toggle login permission failed') }
  }

  const handleToggleBilling = async (id) => {
    try {
      const r = await staffAPI.toggleBilling(id)
      toast.success(r.data.message)
      load()
    } catch { toast.error('Toggle billing failed') }
  }

  const handleDelete = async (id) => {
    try {
      await staffAPI.delete(id)
      toast.success('Staff deleted')
      setDeleteId(null); load()
    } catch (err) { toast.error(err.response?.data?.message || 'Delete failed') }
  }

  const ch = (e) => {
    const val = e.target.type === 'checkbox' ? e.target.checked : e.target.value
    setForm(p => ({ ...p, [e.target.name]: val }))
    setErrors(p => ({ ...p, [e.target.name]: '' }))
  }

  const activeCount   = staff.filter(s => s.active).length
  const inactiveCount = staff.length - activeCount
  const loginPermCount = staff.filter(s => s.loginPermission).length
  const billingPermCount = staff.filter(s => s.billingPermission).length

  return (
    <motion.div className="animate-fade-in" variants={container} initial="hidden" animate="show">
      {/* ── Stats ── */}
      <motion.div variants={item}
        style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))', gap:16, marginBottom:24 }}>
        {[
          { label:'Total Staff', value: staff.length,   color:'var(--accent)',  icon: Users },
          { label:'Active Status', value: activeCount,    color:'var(--ok)',      icon: ShieldCheck },
          { label:'Login Perms', value: loginPermCount, color:'var(--indigo-600)', icon: UserCheck },
          { label:'Billing Perms', value: billingPermCount, color:'var(--warn)', icon: Receipt },
        ].map(s => (
          <div key={s.label} className="card" style={{ display:'flex', alignItems:'center', gap:14, padding:'20px' }}>
            <div style={{ width:44, height:44, borderRadius:'var(--r-sm)', background:'var(--accent-lt)',
              display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
              <s.icon size={20} strokeWidth={1.75} style={{ color: s.color }} />
            </div>
            <div>
              <p style={{ fontSize:11, fontWeight:600, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'.05em' }}>{s.label}</p>
              <h3 style={{ fontSize:24, fontWeight:700, color:'var(--text-h)', letterSpacing:'-.04em', marginTop:2 }}>{s.value}</h3>
            </div>
          </div>
        ))}
      </motion.div>

      {/* ── Header ── */}
      <motion.div variants={item} className="page-header">
        <div>
          <h1 className="page-title">Staff Management</h1>
          <p className="page-subtitle">Configure login permissions, status, and billing rights</p>
        </div>
        <div style={{ display:'flex', gap:12, alignItems:'center' }}>
          <div className="search-bar">
            <Search size={15} strokeWidth={1.75} />
            <input placeholder="Search staff..." value={search} onChange={e => setSearch(e.target.value)} />
            {search && <button onClick={() => setSearch('')} style={{ background:'none', border:'none', cursor:'pointer', display:'flex' }}><X size={14} /></button>}
          </div>
          <button className="btn btn-primary" onClick={openAdd}>
            <Plus size={15} strokeWidth={2} /> Add Staff
          </button>
        </div>
      </motion.div>

      {/* ── Table ── */}
      <motion.div variants={item}>
        {loading
          ? <div className="loading-center"><div className="spinner" /></div>
          : filtered.length === 0
            ? <div className="empty-state"><Users size={48} /><h3>No staff found</h3><p>Add your first staff member to get started</p></div>
            : <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Status</th>
                      <th>Login Permission</th>
                      <th>Billing Permission</th>
                      <th>Last Login</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((s, i) => (
                      <tr key={s.id}>
                        <td>{i + 1}</td>
                        <td>
                          <strong>{s.fullName}</strong>
                          <div style={{ fontSize:11, color:'var(--text-3)' }}>@{s.username}</div>
                          {s.branchName && (
                            <span className="badge badge-secondary" style={{ fontSize: 10, padding: '2px 6px', marginTop: 4, display: 'inline-block', background: 'rgba(var(--primary-rgb), 0.1)', color: 'var(--primary-color)' }}>
                              {s.branchName}
                            </span>
                          )}
                        </td>
                        <td>
                          <span style={{ display:'flex', alignItems:'center', gap:5, color:'var(--text-2)' }}>
                            <Mail size={13} strokeWidth={1.75} style={{ color:'var(--text-4)' }} />{s.email}
                          </span>
                        </td>
                        <td>
                          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                            <button
                              className="btn-icon"
                              onClick={() => handleToggle(s.id)}
                              title={s.active ? 'Deactivate Status' : 'Activate Status'}
                              style={{ color: s.active ? 'var(--ok)' : 'var(--text-4)' }}>
                              {s.active
                                ? <ToggleRight size={20} strokeWidth={1.75} />
                                : <ToggleLeft size={20} strokeWidth={1.75} />}
                            </button>
                            <span style={{ fontSize:12, fontWeight:600 }}>{s.active ? 'Active' : 'Inactive'}</span>
                          </div>
                        </td>
                        <td>
                          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                            <button
                              className="btn-icon"
                              onClick={() => handleToggleLogin(s.id)}
                              title={s.loginPermission ? 'Disable Login' : 'Enable Login'}
                              style={{ color: s.loginPermission ? 'var(--ok)' : 'var(--text-4)' }}>
                              {s.loginPermission ? <ShieldCheck size={18} /> : <ShieldOff size={18} />}
                            </button>
                            <span style={{ fontSize:12, fontWeight:600 }}>{s.loginPermission ? 'Enabled' : 'Disabled'}</span>
                          </div>
                        </td>
                        <td>
                          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                            <button
                              className="btn-icon"
                              onClick={() => handleToggleBilling(s.id)}
                              title={s.billingPermission ? 'Revoke Billing' : 'Grant Billing'}
                              style={{ color: s.billingPermission ? 'var(--ok)' : 'var(--text-4)' }}>
                              {s.billingPermission ? <ShieldCheck size={18} /> : <ShieldOff size={18} />}
                            </button>
                            <span style={{ fontSize:12, fontWeight:600 }}>{s.billingPermission ? 'Yes' : 'No'}</span>
                          </div>
                        </td>
                        <td style={{ fontSize:12, color:'var(--text-3)' }}>
                          {s.lastLoginTime ? new Date(s.lastLoginTime).toLocaleString('en-IN') : 'Never'}
                        </td>
                        <td>
                          <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                            <button className="btn-icon btn-icon-edit" onClick={() => openEdit(s)} title="Edit">
                              <Edit2 size={14} strokeWidth={1.75} />
                            </button>
                            <button className="btn-icon btn-icon-delete" onClick={() => setDeleteId(s.id)} title="Delete">
                              <Trash2 size={14} strokeWidth={1.75} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
        }
      </motion.div>

      {/* ── Add / Edit Modal ── */}
      {modalOpen && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModalOpen(false)}>
          <div className="modal-box">
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
              <h2 style={{ fontSize:20, fontWeight:700 }}>{editing ? 'Edit Staff Details' : 'Add New Staff Member'}</h2>
              <button className="btn-icon" onClick={() => setModalOpen(false)}><X size={16} strokeWidth={1.75} /></button>
            </div>
            <form onSubmit={handleSave}>
              <div className="form-group">
                <label className="form-label">Full Name *</label>
                <input name="fullName" className={`form-input ${errors.fullName ? 'error' : ''}`}
                  value={form.fullName} onChange={ch} placeholder="e.g. John Doe" />
                {errors.fullName && <p className="form-error">{errors.fullName}</p>}
              </div>

              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                <div className="form-group">
                  <label className="form-label">Username *</label>
                  <input name="username" className={`form-input ${errors.username ? 'error' : ''}`}
                    value={form.username} onChange={ch} placeholder="e.g. johndoe" />
                  {errors.username && <p className="form-error">{errors.username}</p>}
                </div>
                <div className="form-group">
                  <label className="form-label">Phone *</label>
                  <input name="phoneNumber" className={`form-input ${errors.phoneNumber ? 'error' : ''}`}
                    value={form.phoneNumber} onChange={ch} placeholder="+91 9876543210" />
                  {errors.phoneNumber && <p className="form-error">{errors.phoneNumber}</p>}
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Email *</label>
                <input type="email" name="email" className={`form-input ${errors.email ? 'error' : ''}`}
                  value={form.email} onChange={ch} placeholder="staff@example.com"
                  disabled={!!editing} />
                {errors.email && <p className="form-error">{errors.email}</p>}
              </div>

              <div className="form-group">
                <label className="form-label">Assign Branch</label>
                <select name="branchId" className="form-input" value={form.branchId} onChange={ch}>
                  <option value="">No Branch (Unassigned)</option>
                  {branches.map(b => (
                    <option key={b.id} value={b.id}>{b.name} ({b.code})</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">{editing ? 'New Password (leave blank to keep)' : 'Password *'}</label>
                <input type="password" name="password" className={`form-input ${errors.password ? 'error' : ''}`}
                  value={form.password} onChange={ch} placeholder="Min 8 characters" />
                {errors.password && <p className="form-error">{errors.password}</p>}
              </div>

              {editing && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 10, marginBottom: 16 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <input type="checkbox" name="loginPermission" id="loginPermission"
                      checked={form.loginPermission} onChange={ch} style={{ width:18, height:18, cursor:'pointer' }} />
                    <label htmlFor="loginPermission" style={{ fontSize:14, fontWeight:600, cursor:'pointer', userSelect: 'none' }}>
                      Enable Login Permission
                    </label>
                  </div>
                  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <input type="checkbox" name="billingPermission" id="billingPermission"
                      checked={form.billingPermission} onChange={ch} style={{ width:18, height:18, cursor:'pointer' }} />
                    <label htmlFor="billingPermission" style={{ fontSize:14, fontWeight:600, cursor:'pointer', userSelect: 'none' }}>
                      Enable Billing Permission
                    </label>
                  </div>
                </div>
              )}

              <div style={{ display:'flex', gap:12, justifyContent:'flex-end', marginTop:8 }}>
                <button type="button" className="btn btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? <span className="btn-spinner" /> : (editing ? 'Update' : 'Add Staff')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Delete Confirm ── */}
      {deleteId && (
        <div className="modal-overlay">
          <div className="modal-box" style={{ maxWidth:400, textAlign:'center' }}>
            <div style={{ width:64, height:64, borderRadius:'var(--r-lg)', background:'var(--err-bg)',
              border:'1px solid var(--err-bdr)', display:'flex', alignItems:'center',
              justifyContent:'center', margin:'0 auto 16px' }}>
              <Trash2 size={28} strokeWidth={1.75} style={{ color:'var(--err)' }} />
            </div>
            <h3 style={{ fontSize:20, fontWeight:700, marginBottom:8 }}>Delete Staff Member?</h3>
            <p style={{ color:'var(--text-3)', marginBottom:24 }}>This action cannot be undone.</p>
            <div style={{ display:'flex', gap:12, justifyContent:'center' }}>
              <button className="btn btn-secondary" onClick={() => setDeleteId(null)}>Cancel</button>
              <button className="btn btn-danger" onClick={() => handleDelete(deleteId)}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  )
}
