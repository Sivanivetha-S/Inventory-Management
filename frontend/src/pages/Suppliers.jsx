import React, { useEffect, useState, useCallback } from 'react'
import { supplierAPI, supplierProductAPI, supplyRequestAPI } from '../services/api'
import toast from 'react-hot-toast'
import { motion } from 'framer-motion'
import {
  Search, X, Building2, MapPin, Phone, Mail,
  CheckCircle, Clock, Plus, Send, Package
} from 'lucide-react'

const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.06 } } }
const item = { hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0, transition: { duration: 0.3 } } }

// ── Supply Request Modal ──────────────────────────────────────────────────────
function RequestModal({ supplier, onClose, onSuccess }) {
  const [form, setForm] = useState({ productName: '', quantity: '', unitPrice: '', notes: '' })
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.productName.trim() || !form.quantity) { toast.error('Product name and quantity are required'); return }
    setSaving(true)
    try {
      await supplyRequestAPI.create({
        supplierId: supplier.id,
        productName: form.productName,
        quantity: parseInt(form.quantity),
        unitPrice: form.unitPrice ? parseFloat(form.unitPrice) : null,
        notes: form.notes,
        direction: 'OWNER_TO_SUPPLIER',
      })
      toast.success('Supply request sent!')
      onSuccess()
      onClose()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to send request')
    } finally { setSaving(false) }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box">
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
          <h2 style={{ fontSize:20, fontWeight:700 }}>Request from {supplier.companyName}</h2>
          <button className="btn-icon" onClick={onClose}><X size={16} strokeWidth={1.75} /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Product Name *</label>
            <input className="form-input" value={form.productName}
              onChange={e => setForm(p => ({...p, productName: e.target.value}))}
              placeholder="e.g. Rice 5kg" />
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <div className="form-group">
              <label className="form-label">Quantity *</label>
              <input type="number" min="1" className="form-input" value={form.quantity}
                onChange={e => setForm(p => ({...p, quantity: e.target.value}))}
                placeholder="e.g. 100" />
            </div>
            <div className="form-group">
              <label className="form-label">Unit Price (₹)</label>
              <input type="number" step="0.01" className="form-input" value={form.unitPrice}
                onChange={e => setForm(p => ({...p, unitPrice: e.target.value}))}
                placeholder="Optional" />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Notes</label>
            <textarea rows={2} className="form-input" value={form.notes}
              onChange={e => setForm(p => ({...p, notes: e.target.value}))}
              placeholder="Additional details..." />
          </div>
          <div style={{ display:'flex', gap:12, justifyContent:'flex-end' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? <span className="btn-spinner" /> : <><Send size={14} /> Send Request</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

import { useAuth } from '../context/AuthContext'

export default function Suppliers() {
  const { activeBranchId } = useAuth()
  const [suppliers, setSuppliers]       = useState([])
  const [loading, setLoading]           = useState(true)
  const [search, setSearch]             = useState('')
  const [selectedSupplier, setSelected] = useState(null)
  const [requestModal, setRequestModal] = useState(null)
  const [tab, setTab]                   = useState('suppliers')
  const [requests, setRequests]         = useState([])
  const [reqLoading, setReqLoading]     = useState(false)
  const [products, setProducts]         = useState([])     // supplier's product catalog
  const [prodLoading, setProdLoading]   = useState(false)
  const [prodSearch, setProdSearch]     = useState('')
  const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080'
  const DEFAULT_IMG = 'https://placehold.co/200x200/e2e8f0/64748b?text=No+Image'

  const loadSuppliers = useCallback(() => {
    setSuppliers([])
    setLoading(true)
    supplierAPI.getAll()
      .then(r => setSuppliers(r.data.data || []))
      .catch(() => toast.error('Failed to load suppliers'))
      .finally(() => setLoading(false))
  }, [activeBranchId])

  const loadRequests = useCallback(() => {
    setRequests([])
    setReqLoading(true)
    supplyRequestAPI.getAll()
      .then(r => setRequests(r.data.data || []))
      .catch(() => {})
      .finally(() => setReqLoading(false))
  }, [activeBranchId])

  useEffect(() => { loadSuppliers(); loadRequests() }, [loadSuppliers, loadRequests])

  // Load product catalog when a supplier is selected
  useEffect(() => {
    if (!selectedSupplier) { setProducts([]); return }
    setProdLoading(true)
    supplierProductAPI.getBySupplierId(selectedSupplier.id)
      .then(r => setProducts(r.data.data || []))
      .catch(() => setProducts([]))
      .finally(() => setProdLoading(false))
  }, [selectedSupplier])

  const filtered = suppliers.filter(s =>
    s.companyName?.toLowerCase().includes(search.toLowerCase()) ||
    s.supplierName?.toLowerCase().includes(search.toLowerCase()) ||
    s.email?.toLowerCase().includes(search.toLowerCase())
  )

  const statusColor = (status) => {
    const map = { PENDING:'badge-warning', ACCEPTED:'badge-success', REJECTED:'badge-danger',
      DISPATCHED:'badge-primary', RECEIVED:'badge-success', CANCELLED:'badge-gray' }
    return map[status] || 'badge-gray'
  }

  return (
    <motion.div className="animate-fade-in" variants={container} initial="hidden" animate="show">

      {/* ── Stats ── */}
      <motion.div variants={item}
        style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))', gap:16, marginBottom:24 }}>
        {[
          { label:'Total Suppliers', value: suppliers.length,                              icon: Building2 },
          { label:'Verified',        value: suppliers.filter(s => s.emailVerified).length, icon: CheckCircle },
          { label:'Supply Requests', value: requests.length,                               icon: Package },
          { label:'Pending',         value: requests.filter(r => r.status === 'PENDING').length, icon: Clock },
        ].map(s => (
          <div key={s.label} className="card" style={{ display:'flex', alignItems:'center', gap:14, padding:'20px' }}>
            <div style={{ width:44, height:44, borderRadius:'var(--r-sm)', background:'var(--accent-lt)',
              display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
              <s.icon size={20} strokeWidth={1.75} style={{ color:'var(--accent)' }} />
            </div>
            <div>
              <p style={{ fontSize:11, fontWeight:600, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'.05em' }}>{s.label}</p>
              <h3 style={{ fontSize:24, fontWeight:700, color:'var(--text-h)', letterSpacing:'-.04em', marginTop:2 }}>{s.value}</h3>
            </div>
          </div>
        ))}
      </motion.div>

      {/* ── Tabs ── */}
      <motion.div variants={item} style={{ marginBottom:24 }}>
        <div style={{ display:'flex', gap:2, background:'var(--slate-100)', border:'1px solid var(--border)',
          padding:4, borderRadius:'var(--r-lg)', width:'fit-content' }}>
          {[
            { id:'suppliers', label:'Suppliers' },
            { id:'requests',  label:`Supply Requests (${requests.length})` },
          ].map(t => (
            <button key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                padding:'8px 20px', border:'none', borderRadius:'var(--r-md)',
                background: tab === t.id ? 'var(--surface)' : 'none',
                color: tab === t.id ? 'var(--accent-dk)' : 'var(--text-3)',
                fontWeight: tab === t.id ? 600 : 500,
                cursor:'pointer', fontSize:13, fontFamily:'inherit',
                boxShadow: tab === t.id ? 'var(--sh-1)' : 'none',
                transition:'all .18s ease',
              }}>
              {t.label}
            </button>
          ))}
        </div>
      </motion.div>

      {/* ── Suppliers Tab ── */}
      {tab === 'suppliers' && (
        <motion.div variants={item}>
          <div className="page-header" style={{ marginBottom:16 }}>
            <div>
              <h1 className="page-title">Suppliers</h1>
              <p className="page-subtitle">Browse and contact your suppliers</p>
            </div>
            <div className="search-bar">
              <Search size={15} strokeWidth={1.75} />
              <input placeholder="Search suppliers..." value={search}
                onChange={e => setSearch(e.target.value)} />
              {search && <button onClick={() => setSearch('')}
                style={{ background:'none', border:'none', cursor:'pointer', display:'flex' }}>
                <X size={14} /></button>}
            </div>
          </div>

          {loading
            ? <div className="loading-center"><div className="spinner" /></div>
            : filtered.length === 0
              ? <div className="empty-state"><Building2 size={48} /><h3>No suppliers yet</h3>
                  <p>Suppliers register independently via the Supplier portal</p></div>
              : <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))', gap:16 }}>
                  {filtered.map(s => (
                    <div key={s.id} className="card"
                      style={{ cursor:'pointer', transition:'all .2s ease' }}
                      onClick={() => setSelected(s)}>
                      {/* Card header */}
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:14 }}>
                        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                          <div style={{ width:44, height:44, borderRadius:'var(--r-md)',
                            background:'var(--gradient-primary)', display:'flex', alignItems:'center',
                            justifyContent:'center', color:'#fff', fontWeight:700, fontSize:16, flexShrink:0 }}>
                            {s.companyName?.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <h3 style={{ fontWeight:700, fontSize:15, color:'var(--text-h)', margin:0 }}>{s.companyName}</h3>
                            <p style={{ fontSize:12, color:'var(--text-3)', margin:0 }}>{s.supplierName}</p>
                          </div>
                        </div>
                        <span className={`badge ${s.emailVerified ? 'badge-success' : 'badge-warning'}`}>
                          {s.emailVerified ? 'Verified' : 'Pending'}
                        </span>
                      </div>
                      {/* Details */}
                      <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                        <span style={{ display:'flex', alignItems:'center', gap:6, fontSize:13, color:'var(--text-2)' }}>
                          <Mail size={13} strokeWidth={1.75} style={{ color:'var(--text-4)' }} />{s.email}
                        </span>
                        {s.phoneNumber && (
                          <span style={{ display:'flex', alignItems:'center', gap:6, fontSize:13, color:'var(--text-2)' }}>
                            <Phone size={13} strokeWidth={1.75} style={{ color:'var(--text-4)' }} />{s.phoneNumber}
                          </span>
                        )}
                        {s.location && (
                          <span style={{ display:'flex', alignItems:'center', gap:6, fontSize:13, color:'var(--text-2)' }}>
                            <MapPin size={13} strokeWidth={1.75} style={{ color:'var(--text-4)' }} />{s.location}
                          </span>
                        )}
                      </div>
                      {/* Actions */}
                      <div style={{ marginTop:14, paddingTop:12, borderTop:'1px solid var(--border)' }}>
                        <button
                          className="btn btn-primary btn-sm"
                          style={{ width:'100%', justifyContent:'center' }}
                          onClick={e => { e.stopPropagation(); setRequestModal(s) }}>
                          <Send size={13} strokeWidth={2} /> Send Supply Request
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
          }
        </motion.div>
      )}

      {/* ── Supply Requests Tab ── */}
      {tab === 'requests' && (
        <motion.div variants={item}>
          <div className="page-header" style={{ marginBottom:16 }}>
            <h1 className="page-title">Supply Requests</h1>
          </div>
          {reqLoading
            ? <div className="loading-center"><div className="spinner" /></div>
            : requests.length === 0
              ? <div className="empty-state"><Package size={48} /><h3>No supply requests</h3>
                  <p>Send requests to suppliers from the Suppliers tab</p></div>
              : <div className="table-container">
                  <table>
                    <thead>
                      <tr><th>#</th><th>Supplier</th><th>Product</th><th>Qty</th>
                          <th>Unit Price</th><th>Status</th><th>Date</th><th>Actions</th></tr>
                    </thead>
                    <tbody>
                      {requests.map((r, i) => (
                        <tr key={r.id}>
                          <td>{i + 1}</td>
                          <td><strong>{r.companyName}</strong><br />
                            <span style={{ fontSize:12, color:'var(--text-3)' }}>{r.supplierName}</span></td>
                          <td>
                             <strong>{r.productName}</strong>
                             {r.unit && (
                               <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 2, fontWeight: 500 }}>
                                 {r.unitSize ? `${r.unitSize}` : r.unit}
                               </div>
                             )}
                           </td>
                          <td><span className="badge badge-primary">{r.quantity}</span></td>
                          <td>{r.unitPrice ? `₹${Number(r.unitPrice).toLocaleString('en-IN')}` : '—'}</td>
                          <td><span className={`badge ${statusColor(r.status)}`}>{r.status}</span></td>
                          <td style={{ fontSize:12, color:'var(--text-3)' }}>
                            {new Date(r.createdAt).toLocaleDateString('en-IN')}
                          </td>
                          <td>
                            {r.status === 'PENDING' && (
                              <button
                                className="btn btn-danger btn-xs"
                                onClick={async () => {
                                  try {
                                    await supplyRequestAPI.updateStatus(r.id, 'CANCELLED', '')
                                    toast.success('Request cancelled')
                                    loadRequests()
                                  } catch { toast.error('Failed to cancel') }
                                }}>
                                Cancel
                              </button>
                            )}
                            {r.status === 'DISPATCHED' && (
                              <button
                                className="btn btn-primary btn-xs"
                                onClick={async () => {
                                  try {
                                    await supplyRequestAPI.updateStatus(r.id, 'RECEIVED', '')
                                    toast.success('Marked as received!')
                                    loadRequests()
                                  } catch { toast.error('Failed to update') }
                                }}>
                                Mark Received
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
          }
        </motion.div>
      )}

      {/* ── Request Modal ── */}
      {requestModal && (
        <RequestModal
          supplier={requestModal}
          onClose={() => setRequestModal(null)}
          onSuccess={loadRequests}
        />
      )}

      {/* ── Supplier Product Drawer ── */}
      {selectedSupplier && (
        <div style={{
          position:'fixed', inset:0, zIndex:1000,
          background:'rgba(0,0,0,0.45)', backdropFilter:'blur(2px)',
          display:'flex', justifyContent:'flex-end',
        }} onClick={e => e.target===e.currentTarget && setSelected(null)}>
          <div style={{
            width: Math.min(560, window.innerWidth-20), height:'100vh',
            background:'var(--surface)', boxShadow:'-8px 0 40px rgba(0,0,0,.18)',
            overflowY:'auto', display:'flex', flexDirection:'column',
          }}>
            {/* Drawer Header */}
            <div style={{ padding:'22px 22px 16px', borderBottom:'1px solid var(--border)',
              background:'var(--surface)', position:'sticky', top:0, zIndex:10 }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                <div>
                  <h2 style={{ fontSize:18, fontWeight:700, color:'var(--text-h)', marginBottom:4 }}>
                    {selectedSupplier.companyName}
                  </h2>
                  <p style={{ fontSize:13, color:'var(--text-3)' }}>{selectedSupplier.supplierName} · {selectedSupplier.email}</p>
                </div>
                <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                  <button className="btn btn-primary btn-sm"
                    onClick={() => setRequestModal(selectedSupplier)}>
                    <Send size={13}/> Request
                  </button>
                  <button className="btn-icon" onClick={() => setSelected(null)}><X size={15}/></button>
                </div>
              </div>
              {/* Product search */}
              <div className="search-bar" style={{ marginTop:12 }}>
                <Search size={13}/>
                <input placeholder="Search products by name, brand, category, barcode…"
                  value={prodSearch} onChange={e=>setProdSearch(e.target.value)}/>
                {prodSearch && <button onClick={()=>setProdSearch('')}
                  style={{background:'none',border:'none',cursor:'pointer',display:'flex'}}><X size={12}/></button>}
              </div>
            </div>

            {/* Drawer Body — product list */}
            <div style={{ padding:'16px 22px', flex:1 }}>
              {prodLoading
                ? <div className="loading-center"><div className="spinner"/></div>
                : (() => {
                    const visible = products.filter(p =>
                      [p.name,p.brand,p.category,p.barcodeNumber].some(f=>
                        f?.toLowerCase().includes(prodSearch.toLowerCase())))
                    if (visible.length === 0) return (
                      <div className="empty-state" style={{padding:'40px 0'}}>
                        <Package size={36}/><h3>No products found</h3>
                        <p>This supplier has no active catalog products yet</p>
                      </div>
                    )
                    return visible.map(p => {
                      const qty = p.quantity ?? p.availableStock
                      return (
                        <div key={p.id} style={{ display:'flex', gap:14, padding:'14px 0',
                          borderBottom:'1px solid var(--border)' }}>
                          {/* Product image */}
                          <img
                            src={p.productImage ? `${API_BASE}${p.productImage}` : DEFAULT_IMG}
                            alt={p.name}
                            style={{ width:72, height:72, borderRadius:10, objectFit:'cover',
                              flexShrink:0, border:'1.5px solid var(--border)',
                              background:'var(--slate-100)' }}
                            onError={e=>{e.target.src=DEFAULT_IMG}}
                          />
                          {/* Product info */}
                          <div style={{ flex:1, minWidth:0 }}>
                            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:8 }}>
                              <div>
                                <h3 style={{ fontSize:14, fontWeight:700, color:'var(--text-h)' }}>{p.name}</h3>
                                {p.unit && (
                                  <p style={{ fontSize: 11.5, color: 'var(--text-3)', fontWeight: 500, marginTop: 2 }}>
                                    {p.unitSize ? p.unitSize : p.unit}
                                  </p>
                                )}
                              </div>
                              <button className="btn btn-secondary btn-xs" style={{ flexShrink:0 }}
                                onClick={() => setRequestModal(selectedSupplier)}>
                                <Send size={11}/> Request
                              </button>
                            </div>
                            {/* Badges */}
                            <div style={{ display:'flex', gap:4, flexWrap:'wrap', marginBottom:6 }}>
                              <span className="badge badge-primary">{p.category}</span>
                              {p.brand && <span className="badge badge-gray">{p.brand}</span>}
                            </div>
                            {/* Detail grid */}
                            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'4px 16px', fontSize:12 }}>
                              {p.barcodeNumber && <span style={{color:'var(--text-3)'}}>🔖 {p.barcodeNumber}</span>}
                              <span style={{color: qty>0?'var(--ok)':'var(--err)', fontWeight:600}}>
                                📦 {qty} {p.unitSize || p.unit || 'units'} available
                              </span>
                              {p.purchasePrice && (
                                <span style={{color:'var(--text-2)'}}>
                                  💰 Buy ₹{Number(p.purchasePrice).toLocaleString('en-IN')}
                                </span>
                              )}
                              <span style={{color:'var(--text-h)', fontWeight:600}}>
                                🏷️ Sell ₹{Number(p.sellingPrice||p.unitPrice||0).toLocaleString('en-IN')}
                              </span>
                              {p.manufacturingDate && (
                                <span style={{color:'var(--text-3)'}}>🗓️ MFD: {p.manufacturingDate}</span>
                              )}
                              {p.expiryDate && (
                                <span style={{color:'var(--text-3)'}}>⏰ Exp: {p.expiryDate}</span>
                              )}
                            </div>
                            {p.description && (
                              <p style={{ fontSize:11.5, color:'var(--text-3)', marginTop:5, lineHeight:1.5 }}>{p.description}</p>
                            )}
                          </div>
                        </div>
                      )
                    })
                  })()
              }
            </div>
          </div>
        </div>
      )}
    </motion.div>
  )
}
