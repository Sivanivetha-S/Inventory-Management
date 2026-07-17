import React, { useEffect, useState, useCallback } from 'react'
import { discountAPI } from '../services/api'
import toast from 'react-hot-toast'
import { Plus, Edit2, Trash2, Percent, X, ToggleLeft, ToggleRight, Tag, CheckSquare, PauseCircle } from 'lucide-react'
import './Discounts.css'

const EMPTY_FORM = { name: '', percentage: '', minimumPurchaseAmount: '', description: '', active: true }

import { useAuth } from '../context/AuthContext'

export default function Discounts() {
  const { activeBranchId } = useAuth()
  const [discounts, setDiscounts] = useState([])
  const [loading, setLoading]     = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing]     = useState(null)
  const [form, setForm]           = useState(EMPTY_FORM)
  const [errors, setErrors]       = useState({})
  const [saving, setSaving]       = useState(false)
  const [deleteId, setDeleteId]   = useState(null)

  const load = useCallback(() => {
    setDiscounts([])
    setLoading(true)
    discountAPI.getAll()
      .then(r => setDiscounts(r.data.data))
      .catch(() => toast.error('Failed to load discounts'))
      .finally(() => setLoading(false))
  }, [activeBranchId])

  useEffect(() => { load() }, [load])

  const openAdd  = () => { setEditing(null); setForm(EMPTY_FORM); setErrors({}); setModalOpen(true) }
  const openEdit = (d) => {
    setEditing(d.id)
    setForm({
      name: d.name, percentage: d.percentage,
      minimumPurchaseAmount: d.minimumPurchaseAmount ?? '',
      description: d.description || '', active: d.active
    })
    setErrors({}); setModalOpen(true)
  }

  const validate = () => {
    const e = {}
    if (!form.name.trim()) e.name = 'Name is required'
    if (!form.percentage || form.percentage <= 0 || form.percentage > 100) e.percentage = 'Enter a valid percentage (0.01–100)'
    return e
  }

  const handleSave = async (ev) => {
    ev.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length) { setErrors(errs); return }
    setSaving(true)
    try {
      const payload = {
        name: form.name, percentage: parseFloat(form.percentage),
        minimumPurchaseAmount: parseFloat(form.minimumPurchaseAmount) || 0,
        description: form.description, active: form.active
      }
      if (editing) {
        await discountAPI.update(editing, payload); toast.success('Discount updated!')
      } else {
        await discountAPI.create(payload); toast.success('Discount created!')
      }
      setModalOpen(false); load()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Save failed')
    } finally { setSaving(false) }
  }

  const handleDelete = async (id) => {
    try {
      await discountAPI.delete(id); toast.success('Discount deleted')
      setDeleteId(null); load()
    } catch (err) { toast.error(err.response?.data?.message || 'Delete failed') }
  }

  const toggleActive = async (d) => {
    try {
      await discountAPI.update(d.id, {
        name: d.name, percentage: d.percentage,
        minimumPurchaseAmount: parseFloat(d.minimumPurchaseAmount) || 0,
        description: d.description, active: !d.active
      })
      toast.success(`Discount ${!d.active ? 'activated' : 'deactivated'}`)
      load()
    } catch { toast.error('Failed to toggle') }
  }

  const ch = (e) => {
    const val = e.target.type === 'checkbox' ? e.target.checked : e.target.value
    setForm(p => ({ ...p, [e.target.name]: val }))
    setErrors(p => ({ ...p, [e.target.name]: '' }))
  }

  const activeCount   = discounts.filter(d => d.active).length
  const inactiveCount = discounts.length - activeCount

  return (
    <div className="animate-fade-in">

      {/* ── Summary stat cards ── */}
      <div className="discounts-stats-grid">
        <div className="discounts-stat-card">
          <div className="discounts-stat-icon discounts-stat-icon--all"><Tag size={20} strokeWidth={1.75} /></div>
          <div><p className="discounts-stat-label">Total</p><h3 className="discounts-stat-value">{discounts.length}</h3></div>
        </div>
        <div className="discounts-stat-card">
          <div className="discounts-stat-icon discounts-stat-icon--active"><CheckSquare size={20} strokeWidth={1.75} /></div>
          <div><p className="discounts-stat-label">Active</p><h3 className="discounts-stat-value">{activeCount}</h3></div>
        </div>
        <div className="discounts-stat-card">
          <div className="discounts-stat-icon discounts-stat-icon--off"><PauseCircle size={20} strokeWidth={1.75} /></div>
          <div><p className="discounts-stat-label">Inactive</p><h3 className="discounts-stat-value">{inactiveCount}</h3></div>
        </div>
      </div>

      <div className="page-header" style={{ marginBottom:20 }}>
        <div>
          <h1 className="page-title">Discounts</h1>
          <p className="page-subtitle">Admin-controlled discount management</p>
        </div>
        <button className="btn btn-primary" onClick={openAdd}><Plus size={15} strokeWidth={2} /> Create Discount</button>
      </div>

      {loading
        ? <div className="loading-center"><div className="spinner" /></div>
        : discounts.length === 0
          ? <div className="empty-state"><Percent size={48} /><h3>No discounts yet</h3><p>Create your first discount</p></div>
          : <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))', gap:16 }}>
              {discounts.map(d => (
                <div key={d.id} className={`card discount-card ${d.active ? 'discount-card--active' : 'discount-card--inactive'}`}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:12 }}>
                    <div style={{ flex:1, minWidth:0 }}>
                      <h3 style={{ fontWeight:700, fontSize:15, color:'var(--text-h)', marginBottom:2 }}>{d.name}</h3>
                      {d.description && <p style={{ fontSize:13, color:'var(--text-3)', marginTop:3 }}>{d.description}</p>}
                    </div>
                    <div style={{ display:'flex', gap:6, flexShrink:0, marginLeft:8 }}>
                      <button className="btn-icon btn-icon-edit" onClick={() => openEdit(d)} title="Edit"><Edit2 size={14} strokeWidth={1.75} /></button>
                      <button className="btn-icon btn-icon-delete" onClick={() => setDeleteId(d.id)} title="Delete"><Trash2 size={14} strokeWidth={1.75} /></button>
                    </div>
                  </div>

                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
                    <div className="discount-pct-pill">
                      <Percent size={13} strokeWidth={2.5} style={{ color:'rgba(255,255,255,.85)' }} />
                      <span>{d.percentage}%</span>
                    </div>
                    <button className={`discount-toggle-btn ${d.active ? 'discount-toggle-btn--on' : 'discount-toggle-btn--off'}`} onClick={() => toggleActive(d)}>
                      {d.active ? <ToggleRight size={22} strokeWidth={1.75} /> : <ToggleLeft size={22} strokeWidth={1.75} />}
                      {d.active ? 'Active' : 'Inactive'}
                    </button>
                  </div>

                  <div style={{ marginBottom:8 }}>
                    {Number(d.minimumPurchaseAmount) > 0
                      ? <span className="discount-min-chip discount-min-chip--has">
                          Min ₹{Number(d.minimumPurchaseAmount).toLocaleString('en-IN')} for auto-apply
                        </span>
                      : <span className="discount-min-chip discount-min-chip--none">
                          No minimum purchase
                        </span>
                    }
                  </div>
                  <div style={{ fontSize:12, color:'var(--text-4)' }}>
                    Created {new Date(d.createdAt).toLocaleDateString('en-IN')}
                  </div>
                </div>
              ))}
            </div>
      }

      {/* ── Modal ── */}
      {modalOpen && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModalOpen(false)}>
          <div className="modal-box">
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
              <h2 style={{ fontSize:20, fontWeight:700 }}>{editing ? 'Edit Discount' : 'Create Discount'}</h2>
              <button className="btn-icon" onClick={() => setModalOpen(false)}><X size={16} strokeWidth={1.75} /></button>
            </div>
            <form onSubmit={handleSave}>
              <div className="form-group">
                <label className="form-label">Discount Name *</label>
                <input name="name" className={`form-input ${errors.name ? 'error' : ''}`} value={form.name} onChange={ch} placeholder="e.g. Festive Sale 10%" />
                {errors.name && <p className="form-error">{errors.name}</p>}
              </div>
              <div className="form-group">
                <label className="form-label">Percentage (%) *</label>
                <input type="number" name="percentage" step="0.01" min="0.01" max="100"
                  className={`form-input ${errors.percentage ? 'error' : ''}`}
                  value={form.percentage} onChange={ch} placeholder="e.g. 10.00" />
                {errors.percentage && <p className="form-error">{errors.percentage}</p>}
              </div>
              <div className="form-group">
                <label className="form-label">Minimum Purchase Amount (₹)</label>
                <input type="number" name="minimumPurchaseAmount" step="0.01" min="0"
                  className="form-input" value={form.minimumPurchaseAmount} onChange={ch}
                  placeholder="e.g. 500 — leave 0 for no minimum" />
                <p style={{ fontSize:12, color:'var(--text-3)', marginTop:4 }}>
                  Auto-applies in billing when bill ≥ this amount. Set 0 for no condition.
                </p>
              </div>
              <div className="form-group">
                <label className="form-label">Description (Optional)</label>
                <textarea name="description" className="form-input" rows={2} value={form.description} onChange={ch} placeholder="Optional description..." />
              </div>
              <div className="form-group" style={{ display:'flex', alignItems:'center', gap:10 }}>
                <input type="checkbox" id="active" name="active" checked={form.active} onChange={ch}
                  style={{ width:16, height:16, accentColor:'var(--accent)', cursor:'pointer' }} />
                <label htmlFor="active" style={{ fontSize:14, color:'var(--text-2)', cursor:'pointer', fontWeight:500 }}>
                  Active (available for billing)
                </label>
              </div>
              <div style={{ display:'flex', gap:12, justifyContent:'flex-end' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? <span className="btn-spinner" /> : (editing ? 'Update' : 'Create')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Delete confirm ── */}
      {deleteId && (
        <div className="modal-overlay">
          <div className="modal-box" style={{ maxWidth:400, textAlign:'center' }}>
            <div style={{ width:64, height:64, borderRadius:'var(--r-lg)', background:'var(--err-bg)', border:'1px solid var(--err-bdr)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 16px' }}>
              <Trash2 size={28} strokeWidth={1.75} style={{ color:'var(--err)' }} />
            </div>
            <h3 style={{ fontSize:20, fontWeight:700, marginBottom:8 }}>Delete Discount?</h3>
            <p style={{ color:'var(--text-3)', marginBottom:24 }}>Existing invoices with this discount remain unchanged.</p>
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
