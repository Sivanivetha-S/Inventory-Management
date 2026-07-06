import React, { useEffect, useState, useCallback } from 'react'
import { discountAPI } from '../services/api'
import toast from 'react-hot-toast'
import { FiPlus, FiEdit2, FiTrash2, FiPercent, FiX, FiToggleLeft, FiToggleRight } from 'react-icons/fi'

const EMPTY_FORM = { name: '', percentage: '', minimumPurchaseAmount: '', description: '', active: true }

export default function Discounts() {
  const [discounts, setDiscounts] = useState([])
  const [loading, setLoading]     = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing]     = useState(null)
  const [form, setForm]           = useState(EMPTY_FORM)
  const [errors, setErrors]       = useState({})
  const [saving, setSaving]       = useState(false)
  const [deleteId, setDeleteId]   = useState(null)

  const load = useCallback(() => {
    setLoading(true)
    discountAPI.getAll()
      .then(r => setDiscounts(r.data.data))
      .catch(() => toast.error('Failed to load discounts'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  const openAdd = () => { setEditing(null); setForm(EMPTY_FORM); setErrors({}); setModalOpen(true) }
  const openEdit = (d) => {
    setEditing(d.id)
    setForm({
      name: d.name,
      percentage: d.percentage,
      minimumPurchaseAmount: d.minimumPurchaseAmount ?? '',
      description: d.description || '',
      active: d.active
    })
    setErrors({})
    setModalOpen(true)
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
        name: form.name,
        percentage: parseFloat(form.percentage),
        minimumPurchaseAmount: parseFloat(form.minimumPurchaseAmount) || 0,
        description: form.description,
        active: form.active
      }
      if (editing) {
        await discountAPI.update(editing, payload)
        toast.success('Discount updated!')
      } else {
        await discountAPI.create(payload)
        toast.success('Discount created!')
      }
      setModalOpen(false); load()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Save failed')
    } finally { setSaving(false) }
  }

  const handleDelete = async (id) => {
    try {
      await discountAPI.delete(id)
      toast.success('Discount deleted')
      setDeleteId(null); load()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Delete failed')
    }
  }

  const toggleActive = async (d) => {
    try {
      await discountAPI.update(d.id, {
        name: d.name,
        percentage: d.percentage,
        minimumPurchaseAmount: parseFloat(d.minimumPurchaseAmount) || 0,
        description: d.description,
        active: !d.active
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
      {/* Summary */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))', gap:16, marginBottom:24 }}>
        {[
          { label:'Total Discounts',  value:discounts.length, color:'linear-gradient(135deg,#a07840,#c8a870)', icon:'🏷️' },
          { label:'Active',           value:activeCount,       color:'linear-gradient(135deg,#7a5c2e,#b08050)', icon:'✅' },
          { label:'Inactive',         value:inactiveCount,     color:'linear-gradient(135deg,#8b6030,#c8a870)', icon:'⏸️' },
        ].map(s => (
          <div key={s.label} style={{ background:s.color, borderRadius:'var(--radius-lg)', padding:'20px 18px', boxShadow:'var(--shadow-md)', display:'flex', alignItems:'center', gap:14 }}>
            <span style={{ fontSize:28 }}>{s.icon}</span>
            <div>
              <p style={{ fontSize:12, color:'rgba(255,255,255,0.8)', fontWeight:600 }}>{s.label}</p>
              <h3 style={{ fontSize:26, fontWeight:800, color:'white' }}>{s.value}</h3>
            </div>
          </div>
        ))}
      </div>

      <div className="page-header" style={{ marginBottom:20 }}>
        <div>
          <h1 className="page-title">Discounts</h1>
          <p className="page-subtitle">Admin-controlled discount management</p>
        </div>
        <button className="btn btn-primary" onClick={openAdd}><FiPlus /> Create Discount</button>
      </div>

      {loading
        ? <div className="loading-center"><div className="spinner" /></div>
        : discounts.length === 0
          ? <div className="empty-state"><FiPercent size={48} /><h3>No discounts yet</h3><p>Create your first discount</p></div>
          : <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))', gap:16 }}>
              {discounts.map(d => (
                <div key={d.id} className="card discount-card" style={{ borderLeft:`4px solid ${d.active ? 'var(--primary)' : '#d1d5db'}`, opacity: d.active ? 1 : 0.7 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:12 }}>
                    <div>
                      <h3 style={{ fontWeight:700, fontSize:16, color:'var(--dark)' }}>{d.name}</h3>
                      {d.description && <p style={{ fontSize:13, color:'var(--gray)', marginTop:4 }}>{d.description}</p>}
                    </div>
                    <div style={{ display:'flex', gap:6 }}>
                      <button className="btn-icon btn-icon-edit" onClick={() => openEdit(d)} title="Edit"><FiEdit2 /></button>
                      <button className="btn-icon btn-icon-delete" onClick={() => setDeleteId(d.id)} title="Delete"><FiTrash2 /></button>
                    </div>
                  </div>

                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                    <div style={{ background:'var(--gradient-primary)', padding:'8px 18px', borderRadius:30, display:'inline-flex', alignItems:'center', gap:6 }}>
                      <FiPercent style={{ color:'white', fontSize:14 }} />
                      <span style={{ color:'white', fontWeight:800, fontSize:20 }}>{d.percentage}%</span>
                    </div>
                    <button
                      onClick={() => toggleActive(d)}
                      style={{ background:'none', border:'none', cursor:'pointer', display:'flex', alignItems:'center', gap:6, fontSize:13, fontWeight:600, color: d.active ? '#22c55e' : '#9ca3af', fontFamily:'inherit' }}
                    >
                      {d.active ? <FiToggleRight size={22} /> : <FiToggleLeft size={22} />}
                      {d.active ? 'Active' : 'Inactive'}
                    </button>
                  </div>

                  <div style={{ marginTop:10, fontSize:12 }}>
                    {Number(d.minimumPurchaseAmount) > 0
                      ? <span style={{ color:'#5b21b6', background:'#ede9fe', borderRadius:20, padding:'3px 10px', fontWeight:700 }}>
                          🛒 Min ₹{Number(d.minimumPurchaseAmount).toLocaleString('en-IN')} for auto-apply
                        </span>
                      : <span style={{ color:'#166534', background:'#dcfce7', borderRadius:20, padding:'3px 10px', fontWeight:700 }}>
                          ✓ No minimum
                        </span>
                    }
                  </div>
                  <div style={{ marginTop:8, fontSize:12, color:'var(--gray)' }}>
                    Created {new Date(d.createdAt).toLocaleDateString('en-IN')}
                  </div>
                </div>
              ))}
            </div>
      }

      {/* Modal */}
      {modalOpen && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModalOpen(false)}>
          <div className="modal-box">
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
              <h2 style={{ fontSize:20, fontWeight:700 }}>{editing ? 'Edit Discount' : 'Create Discount'}</h2>
              <button className="btn-icon" style={{ background:'#f3f4f6' }} onClick={() => setModalOpen(false)}><FiX /></button>
            </div>
            <form onSubmit={handleSave}>
              <div className="form-group">
                <label className="form-label">Discount Name *</label>
                <input name="name" className={`form-input ${errors.name?'error':''}`} value={form.name} onChange={ch} placeholder="e.g. Festive Sale 10%" />
                {errors.name && <p className="form-error">{errors.name}</p>}
              </div>
              <div className="form-group">
                <label className="form-label">Percentage (%) *</label>
                <input type="number" name="percentage" step="0.01" min="0.01" max="100" className={`form-input ${errors.percentage?'error':''}`}
                  value={form.percentage} onChange={ch} placeholder="e.g. 10.00" />
                {errors.percentage && <p className="form-error">{errors.percentage}</p>}
              </div>
              <div className="form-group">
                <label className="form-label">Minimum Purchase Amount (₹)</label>
                <input type="number" name="minimumPurchaseAmount" step="0.01" min="0"
                  className="form-input" value={form.minimumPurchaseAmount} onChange={ch}
                  placeholder="e.g. 500 — leave 0 for no minimum" />
                <p style={{ fontSize:12, color:'var(--gray)', marginTop:4 }}>
                  Discount auto-applies in billing when bill ≥ this amount. Set 0 for no condition.
                </p>
              </div>
              <div className="form-group">
                <label className="form-label">Description (Optional)</label>
                <textarea name="description" className="form-input" rows={2} value={form.description} onChange={ch} placeholder="Optional description..." />
              </div>
              <div className="form-group" style={{ display:'flex', alignItems:'center', gap:10 }}>
                <input type="checkbox" id="active" name="active" checked={form.active} onChange={ch} style={{ width:16, height:16, accentColor:'var(--primary)' }} />
                <label htmlFor="active" style={{ fontSize:14, color:'#374151', cursor:'pointer', fontWeight:600 }}>Active (available for billing)</label>
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

      {/* Delete confirm */}
      {deleteId && (
        <div className="modal-overlay">
          <div className="modal-box" style={{ maxWidth:400, textAlign:'center' }}>
            <div style={{ fontSize:48, marginBottom:16 }}>🏷️</div>
            <h3 style={{ fontSize:20, fontWeight:700, marginBottom:8 }}>Delete Discount?</h3>
            <p style={{ color:'var(--gray)', marginBottom:24 }}>Existing invoices with this discount remain unchanged.</p>
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
