import React, { useEffect, useState, useCallback } from 'react'
import { supplyRequestAPI, supplierAPI, productAPI, supplierDispatchAPI, supplierProductAPI } from '../services/api'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'
import { motion } from 'framer-motion'
import {
  Plus, Package, Clock, CheckCircle, XCircle,
  Truck, Search, X, Send, AlertCircle,
} from 'lucide-react'

// ACCEPTED shown as "Pending Receipt" to make the workflow clear to the owner
const STATUS = {
  PENDING:    { cls:'badge-warning', label:'Pending',         Icon:Clock },
  ACCEPTED:   { cls:'badge-info',    label:'Pending Receipt', Icon:AlertCircle },
  REJECTED:   { cls:'badge-danger',  label:'Rejected',        Icon:XCircle },
  DISPATCHED: { cls:'badge-primary', label:'Dispatched',      Icon:Truck },
  RECEIVED:   { cls:'badge-success', label:'Received',        Icon:CheckCircle },
  CANCELLED:  { cls:'badge-gray',    label:'Cancelled',       Icon:XCircle },
}

const anim = { hidden:{opacity:0}, show:{opacity:1,transition:{staggerChildren:.06}} }
const row  = { hidden:{opacity:0,y:12}, show:{opacity:1,y:0,transition:{duration:.26}} }

/* ── New Request Modal (Owner) ───────────────────────────────────────────── */
function NewRequestModal({ onClose, onSuccess, activeBranchId }) {
  const [suppliers, setSuppliers] = useState([])
  const [supplierProducts, setSupplierProducts] = useState([])
  const [form, setForm] = useState({
    supplierId: '',
    supplierProductId: '',
    productName: '',
    quantity: '100',
    unit: '',
    unitSize: '',
    notes: ''
  })
  const [saving, setSaving] = useState(false)

  const ch = e => setForm(p => ({ ...p, [e.target.name]: e.target.value }))

  const pickProduct = e => {
    const spId = e.target.value
    if (!spId) {
      setForm(p => ({
        ...p,
        supplierProductId: '',
        productName: '',
        unit: '',
        unitSize: ''
      }))
      return
    }
    const sp = supplierProducts.find(x => String(x.id) === spId)
    if (sp) {
      let cleanSize = '';
      if (sp.unitSize) {
        cleanSize = String(sp.unitSize).replace(new RegExp(`\\s*${sp.unit === 'Gram (g)' ? 'g' : sp.unit === 'Litre' ? 'L' : sp.unit}$`, 'i'), '').trim();
      }
      setForm(p => ({
        ...p,
        supplierProductId: spId,
        productName: sp.name,
        unit: sp.unit || '',
        unitSize: cleanSize
      }))
    }
  }

  useEffect(() => {
    supplierAPI.getAll().then(r => setSuppliers(r.data.data || [])).catch(() => {})
  }, [])

  useEffect(() => {
    if (form.supplierId) {
      supplierProductAPI.getBySupplierId(form.supplierId)
        .then(r => {
          setSupplierProducts(r.data.data || [])
          setForm(p => ({
            ...p,
            supplierProductId: '',
            productName: '',
            unit: '',
            unitSize: ''
          }))
        })
        .catch(() => {
          setSupplierProducts([])
        })
    } else {
      setSupplierProducts([])
      setForm(p => ({
        ...p,
        supplierProductId: '',
        productName: '',
        unit: '',
        unitSize: ''
      }))
    }
  }, [form.supplierId])

  const getUnitSizeOptions = (unit) => {
    switch (unit) {
      case 'Kg':
        return ['1', '2', '5', '10', '25', '50']
      case 'Gram (g)':
      case 'Gram':
        return ['50', '100', '200', '250', '500', '1000']
      case 'Litre':
        return ['1', '2', '5', '10', '20']
      case 'ml':
        return ['100', '250', '500', '750', '1000']
      default:
        return []
    }
  }

  const unitSizeOptions = getUnitSizeOptions(form.unit)
  const isSizeRequired = unitSizeOptions.length > 0

  const handleSubmit = async e => {
    e.preventDefault()
    if (!form.supplierId) { toast.error('Select a supplier'); return }
    if (!form.productName.trim()) { toast.error('Product name is required'); return }
    if (!form.unit) { toast.error('Unit is required'); return }
    if (isSizeRequired && !form.unitSize) {
      toast.error(`${form.unit === 'Kg' || form.unit === 'Gram (g)' || form.unit === 'Gram' ? 'Weight' : 'Volume'} size is required`);
      return
    }
    if (!form.quantity || parseInt(form.quantity) < 1) { toast.error('Enter valid quantity'); return }

    setSaving(true)
    try {
      await supplyRequestAPI.create({
        supplierId: parseInt(form.supplierId),
        supplierProductId: form.supplierProductId ? parseInt(form.supplierProductId) : null,
        productName: form.productName,
        quantity: parseInt(form.quantity),
        notes: form.notes,
        direction: 'OWNER_TO_SUPPLIER',
        unit: form.unit,
        unitSize: form.unitSize ? `${form.unitSize} ${form.unit === 'Gram (g)' ? 'g' : form.unit === 'Litre' ? 'L' : form.unit}` : null,
        branchId: activeBranchId && activeBranchId !== 'all' ? parseInt(activeBranchId) : null
      })
      toast.success('Supply request sent to supplier!')
      onSuccess(); onClose()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to send')
    } finally {
      setSaving(false)
    }
  }

  const selectedSupplier = suppliers.find(s => String(s.id) === String(form.supplierId))

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: 500 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <h2 style={{ fontSize: 19, fontWeight: 700 }}>New Supply Request</h2>
          <button className="btn-icon" onClick={onClose}><X size={15} /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Supplier *</label>
            <select name="supplierId" className="form-input" value={form.supplierId} onChange={ch}>
              <option value="">-- Select Supplier --</option>
              {suppliers.map(s => (
                <option key={s.id} value={s.id}>
                  {s.companyName} ({s.supplierName})
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 11 }}>
            <div className="form-group">
              <label className="form-label">From Existing Product</label>
              <select
                className="form-input"
                value={form.supplierProductId}
                onChange={pickProduct}
                disabled={!form.supplierId}
              >
                {!form.supplierId ? (
                  <option value="">-- Select Supplier First --</option>
                ) : supplierProducts.length === 0 ? (
                  <option value="">No products available for this supplier.</option>
                ) : (
                  <>
                    <option value="">-- Optional --</option>
                    {supplierProducts.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name} {p.unitSize ? `(${p.unitSize})` : p.unit ? `(${p.unit})` : ''} ({p.category}{p.brand ? ` - ${p.brand}` : ''})
                      </option>
                    ))}
                  </>
                )}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Product Name *</label>
              <input
                name="productName"
                className="form-input"
                value={form.productName}
                onChange={ch}
                placeholder="e.g. Rice"
                disabled={!!form.supplierProductId}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Unit *</label>
              <select name="unit" className="form-input" value={form.unit} onChange={ch} disabled={!!form.supplierProductId}>
                <option value="">-- Select Unit --</option>
                {[
                  'Piece', 'Pack', 'Box', 'Bottle', 'Kg', 'Gram (g)', 'Litre',
                  'ml', 'Dozen', 'Bundle', 'Meter', 'Roll', 'Custom'
                ].map(u => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
            </div>

            {isSizeRequired && (
              <div className="form-group">
                <label className="form-label">
                  {form.unit === 'Kg' || form.unit === 'Gram (g)' || form.unit === 'Gram' ? 'Weight *' : 'Volume *'}
                </label>
                <select name="unitSize" className="form-input" value={form.unitSize} onChange={ch} disabled={!!form.supplierProductId}>
                  <option value="">-- Select Option --</option>
                  {unitSizeOptions.map(opt => (
                    <option key={opt} value={opt}>
                      {opt} {form.unit === 'Gram (g)' ? 'g' : form.unit === 'Litre' ? 'L' : form.unit}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Quantity *</label>
              <input
                type="number"
                min="1"
                name="quantity"
                className="form-input"
                value={form.quantity}
                onChange={ch}
                placeholder="100"
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Notes</label>
            <textarea
              rows={2}
              name="notes"
              className="form-input"
              value={form.notes}
              onChange={ch}
              placeholder="Any details..."
            />
          </div>

          {/* Request Preview Summary Card */}
          {form.supplierId && form.productName && (
            <div className="card" style={{ background: 'var(--bg-2, #f9fafb)', padding: 12, marginBottom: 16, border: '1px solid var(--border)' }}>
              <h4 style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, color: 'var(--text-h)' }}>
                📋 Request Summary Preview
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 12px', fontSize: 12, color: 'var(--text-2)' }}>
                <div><strong>Supplier:</strong> {selectedSupplier?.companyName || '—'}</div>
                <div><strong>Product:</strong> {form.productName}</div>
                <div><strong>Unit:</strong> {form.unit || '—'}</div>
                {isSizeRequired && (
                  <div>
                    <strong>{form.unit === 'Kg' || form.unit === 'Gram' ? 'Weight:' : 'Volume:'}</strong>{' '}
                    {form.unitSize ? `${form.unitSize} ${form.unit}` : 'Not Selected'}
                  </div>
                )}
                <div><strong>Quantity:</strong> {form.quantity || '0'}</div>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: 11, justifyContent: 'flex-end' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? <span className="btn-spinner" /> : <><Send size={13} /> Send Request</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

/* ── Main Page ───────────────────────────────────────────────────────────── */
export default function SupplyRequests() {
  const { isAdmin, isSupplier, activeBranchId } = useAuth()
  const [requests, setRequests]     = useState([])
  const [loading, setLoading]       = useState(true)
  const [search, setSearch]         = useState('')
  const [statusFilter, setStatus]   = useState('ALL')
  const [modal, setModal]           = useState(false)
  const [busy, setBusy]             = useState(false)

  // Dispatches state for Owner
  const [ownerDispatches, setOwnerDispatches] = useState([])

  const load = useCallback(() => {
    setRequests([])
    setOwnerDispatches([])
    setLoading(true)
    const promises = [supplyRequestAPI.getAll()]
    if (isAdmin) {
      promises.push(supplierDispatchAPI.getOwnerDispatches().catch(() => ({ data: { data: [] } })))
    }
    Promise.all(promises)
      .then(([reqRes, dispRes]) => {
        setRequests(reqRes.data.data || [])
        if (dispRes) setOwnerDispatches(dispRes.data.data || [])
      })
      .catch(() => toast.error('Failed to load requests'))
      .finally(() => setLoading(false))
  }, [isAdmin, activeBranchId])

  useEffect(() => { load() }, [load])

  const handleAcceptDispatch = async (id) => {
    setBusy(true)
    try {
      await supplierDispatchAPI.accept(id)
      toast.success('Delivery accepted! Stock added to your product inventory.')
      load()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Accept failed')
    } finally {
      setBusy(false)
    }
  }

  const handleRejectDispatch = async (id) => {
    const reason = window.prompt('Please enter the reason for rejection:')
    if (reason === null) return
    if (!reason.trim()) {
      toast.error('Rejection reason is required')
      return;
    }
    setBusy(true)
    try {
      await supplierDispatchAPI.reject(id, reason)
      toast.success('Delivery rejected. Quantity returned to Supplier.')
      load()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Rejection failed')
    } finally {
      setBusy(false)
    }
  }

  // "Pending Receipt" = ACCEPTED requests awaiting owner confirmation
  const filtered = requests.filter(r => {
    const q = search.toLowerCase()
    const matchQ = r.productName?.toLowerCase().includes(q) ||
      r.companyName?.toLowerCase().includes(q) ||
      r.adminName?.toLowerCase().includes(q)
    const matchS = statusFilter === 'ALL' || r.status === statusFilter
    return matchQ && matchS
  })

  const pendingReceiptCount = requests.filter(r =>
    r.status === 'ACCEPTED' || r.status === 'DISPATCHED'
  ).length

  const counts = {
    ALL:      requests.length,
    PENDING:  requests.filter(r => r.status === 'PENDING').length,
    ACCEPTED: requests.filter(r => r.status === 'ACCEPTED').length,
    DISPATCHED:requests.filter(r => r.status === 'DISPATCHED').length,
    RECEIVED: requests.filter(r => r.status === 'RECEIVED').length,
  }

  const updateStatus = async (id, status) => {
    setBusy(true)
    try {
      await supplyRequestAPI.updateStatus(id, status, '')
      const msgs = {
        ACCEPTED:   'Request accepted — product now pending receipt in your inventory',
        REJECTED:   'Request rejected',
        DISPATCHED: 'Marked as dispatched',
        RECEIVED:   'Stock received! Product inventory updated automatically.',
        CANCELLED:  'Request cancelled',
      }
      toast.success(msgs[status] || 'Status updated')
      load()
    } catch(e) { toast.error(e.response?.data?.message || 'Failed') }
    finally { setBusy(false) }
  }

  return (
    <motion.div className="animate-fade-in" variants={anim} initial="hidden" animate="show">

      {/* Pending Receipt Alert Banner — shown to owner when stock is awaiting */}
      {isAdmin && pendingReceiptCount > 0 && (
        <motion.div variants={row}
          style={{background:'var(--info-bg)', border:'1px solid var(--info-bdr)',
            borderLeft:'4px solid var(--info)', borderRadius:'var(--r-lg)',
            padding:'14px 18px', marginBottom:20,
            display:'flex', alignItems:'center', gap:12, fontSize:14}}>
          <AlertCircle size={18} strokeWidth={1.75} style={{color:'var(--info)', flexShrink:0}}/>
          <span style={{color:'var(--text-2)'}}>
            <strong style={{color:'var(--text-h)'}}>{pendingReceiptCount} request(s)</strong> are
            waiting to be received. Once you receive the stock, click{' '}
            <strong>"Mark Received"</strong> — it will automatically add to your product inventory.
          </span>
        </motion.div>
      )}

      {/* Incoming Supplier Deliveries (from dispatches) */}
      {isAdmin && ownerDispatches.filter(d => d.status === 'PENDING').length > 0 && (
        <motion.div variants={row} className="card" style={{ marginBottom: 20, padding: 18, borderLeft: '4px solid var(--accent)' }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Truck size={16} style={{ color: 'var(--accent)' }} />
            Incoming Supplier Deliveries ({ownerDispatches.filter(d => d.status === 'PENDING').length})
          </h3>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Supplier</th>
                  <th>Product</th>
                  <th>Quantity</th>
                  <th>Dispatch Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {ownerDispatches.filter(d => d.status === 'PENDING').map(d => (
                  <tr key={d.id}>
                    <td>
                      <strong>{d.supplierCompanyName}</strong>
                      <br/>
                      <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{d.supplierName}</span>
                      {d.branchName && (
                        <span style={{ display: 'block', fontSize: '10px', color: 'var(--accent)', marginTop: 2, fontWeight: 600 }}>
                          Target Branch: {d.branchName}
                        </span>
                      )}
                    </td>
                    <td><strong>{d.productName}</strong></td>
                    <td><span className="badge badge-primary">{d.quantity}</span></td>
                    <td style={{ fontSize: 12 }}>{new Date(d.dispatchDate).toLocaleDateString('en-IN')}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn btn-primary btn-xs" onClick={() => handleAcceptDispatch(d.id)} disabled={busy}>Accept Delivery</button>
                        <button className="btn btn-danger btn-xs" onClick={() => handleRejectDispatch(d.id)} disabled={busy}>Reject Delivery</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}

      {/* Stat filter chips */}
      <motion.div variants={row}
        style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(130px,1fr))',gap:11,marginBottom:20}}>
        {Object.entries(counts).map(([s, v]) => {
          const cfg = STATUS[s] || { cls:'badge-gray', label:s, Icon:Package }
          const Ic = cfg.Icon
          return (
            <div key={s} className="card"
              style={{padding:'13px 15px', cursor:'pointer',
                border: statusFilter===s ? '2px solid var(--accent)' : '1px solid var(--border)'}}
              onClick={() => setStatus(s)}>
              <div style={{display:'flex',alignItems:'center',gap:9}}>
                <Ic size={15} strokeWidth={1.75} style={{color:'var(--accent)',flexShrink:0}}/>
                <div>
                  <p style={{fontSize:9.5,fontWeight:700,color:'var(--text-3)',textTransform:'uppercase',letterSpacing:'.05em'}}>
                    {s==='ALL' ? 'All' : s==='ACCEPTED' ? 'Pending Receipt' : cfg.label}
                  </p>
                  <h3 style={{fontSize:19,fontWeight:700,color:'var(--text-h)',letterSpacing:'-.04em'}}>{v}</h3>
                </div>
              </div>
            </div>
          )
        })}
      </motion.div>

      {/* Header */}
      <motion.div variants={row} className="page-header">
        <div>
          <h1 className="page-title">Supply Requests</h1>
          <p className="page-subtitle">
            {isAdmin
              ? 'Accepted requests show as Pending Receipt — mark as Received to update inventory'
              : 'View and respond to supply requests from shop owners'}
          </p>
        </div>
        <div style={{display:'flex',gap:10,alignItems:'center'}}>
          <div className="search-bar">
            <Search size={14} strokeWidth={1.75}/>
            <input placeholder="Search product or company..." value={search}
              onChange={e => setSearch(e.target.value)}/>
            {search && <button onClick={() => setSearch('')}
              style={{background:'none',border:'none',cursor:'pointer',display:'flex'}}>
              <X size={13}/>
            </button>}
          </div>
          {isAdmin && (
            <button className="btn btn-primary btn-sm" onClick={() => setModal(true)}>
              <Plus size={13}/> New Request
            </button>
          )}
        </div>
      </motion.div>

      {/* Table */}
      <motion.div variants={row}>
        {loading
          ? <div className="loading-center"><div className="spinner"/></div>
          : filtered.length === 0
            ? <div className="empty-state">
                <Package size={44}/>
                <h3>No {statusFilter !== 'ALL' ? STATUS[statusFilter]?.label || statusFilter : ''} requests</h3>
              </div>
            : <div className="table-container">
                <table>
                  <thead><tr>
                    <th>#</th>
                    <th>{isAdmin ? 'Supplier' : 'Shop / Owner'}</th>
                    <th>Product</th>
                    <th>Qty</th>
                    <th>Unit Price</th>
                    <th>Direction</th>
                    <th>Status</th>
                    <th>Date</th>
                    <th>Actions</th>
                  </tr></thead>
                  <tbody>
                    {filtered.map((r, i) => {
                      const s = STATUS[r.status] || { cls:'badge-gray', label:r.status }
                      const fromOwner = r.direction === 'OWNER_TO_SUPPLIER'

                      return (
                        <tr key={r.id} style={{
                          background: (r.status === 'ACCEPTED' || r.status === 'DISPATCHED')
                            ? 'rgba(59,130,246,.03)' : undefined,
                        }}>
                          <td>{i + 1}</td>
                          <td>
                            {isAdmin
                              ? <><strong>{r.companyName}</strong>
                                  <br/><span style={{fontSize:11,color:'var(--text-3)'}}>{r.supplierName}</span>
                                </>
                              : <strong>{r.adminName}</strong>
                            }
                          </td>
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
                          <td>
                            <span className="badge badge-gray" style={{fontSize:10}}>
                              {fromOwner ? 'Owner → Supplier' : 'Supplier → Owner'}
                            </span>
                          </td>
                          <td>
                            <span className={`badge ${s.cls}`}>
                              {r.status === 'ACCEPTED' ? '⏳ Pending Receipt' : s.label}
                            </span>
                          </td>
                          <td style={{fontSize:11.5,color:'var(--text-3)'}}>
                            {new Date(r.createdAt).toLocaleDateString('en-IN')}
                          </td>
                          <td>
                            <div style={{display:'flex',gap:4,flexWrap:'wrap'}}>

                              {/* ── OWNER actions ── */}
                              {isAdmin && fromOwner && r.status === 'PENDING' && (
                                <button className="btn btn-danger btn-xs" disabled={busy}
                                  onClick={() => updateStatus(r.id, 'CANCELLED')}>Cancel</button>
                              )}
                              {/* Owner accepts/rejects supplier's offer */}
                              {isAdmin && !fromOwner && r.status === 'PENDING' && (<>
                                <button className="btn btn-primary btn-xs" disabled={busy}
                                  onClick={() => updateStatus(r.id, 'ACCEPTED')}>Accept</button>
                                <button className="btn btn-danger btn-xs" disabled={busy}
                                  onClick={() => updateStatus(r.id, 'REJECTED')}>Reject</button>
                              </>)}
                              {/* Owner marks as RECEIVED — only Owner can do this */}
                              {isAdmin && (r.status === 'DISPATCHED' ||
                                (r.status === 'ACCEPTED' && !fromOwner)) && (
                                <button className="btn btn-primary btn-xs" disabled={busy}
                                  onClick={() => updateStatus(r.id, 'RECEIVED')}
                                  style={{background:'var(--ok)', border:'none'}}>
                                  <CheckCircle size={11}/> Mark Received
                                </button>
                              )}

                              {/* ── SUPPLIER actions ── */}
                              {isSupplier && fromOwner && r.status === 'PENDING' && (<>
                                <button className="btn btn-primary btn-xs" disabled={busy}
                                  onClick={() => updateStatus(r.id, 'ACCEPTED')}>Accept</button>
                                <button className="btn btn-danger btn-xs" disabled={busy}
                                  onClick={() => updateStatus(r.id, 'REJECTED')}>Reject</button>
                              </>)}
                              {isSupplier && fromOwner && r.status === 'ACCEPTED' && (
                                <button className="btn btn-secondary btn-xs" disabled={busy}
                                  onClick={() => updateStatus(r.id, 'DISPATCHED')}>
                                  <Truck size={11}/> Dispatch
                                </button>
                              )}
                              {isSupplier && !fromOwner && r.status === 'PENDING' && (
                                <button className="btn btn-secondary btn-xs" disabled={busy}
                                  onClick={() => updateStatus(r.id, 'CANCELLED')}>Cancel</button>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
        }
      </motion.div>

      {modal && <NewRequestModal onClose={() => setModal(false)} onSuccess={load} activeBranchId={activeBranchId}/>}
    </motion.div>
  )
}
