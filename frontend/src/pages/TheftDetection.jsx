import React, { useEffect, useState, useCallback } from 'react'
import { theftAPI, productAPI, damageAPI } from '../services/api'
import toast from 'react-hot-toast'
import {
  FiShield, FiAlertTriangle, FiCheckCircle, FiX,
  FiDownload, FiEdit2, FiCalendar, FiPackage, FiPlus
} from 'react-icons/fi'
import './TheftDetection.css'

const todayStr = () => new Date().toISOString().split('T')[0]

const DAMAGE_REASONS = ['BROKEN', 'EXPIRED', 'DEFECTIVE', 'OTHER']

const TABS = [
  { id: 'damage',   label: '📦 Damage Entry' },
  { id: 'verify',   label: '🔍 Stock Verification' },
  { id: 'history',  label: '🚨 Loss History' },
  { id: 'damages',  label: '🗂️ Damage History' },
]

export default function TheftDetection() {
  const [tab, setTab]           = useState('damage')
  const [products, setProducts] = useState([])
  const [records, setRecords]   = useState([])
  const [damages, setDamages]   = useState([])

  // ── Stock verification state ──
  const [stockEntries, setEntries] = useState([])
  const [submitting, setSubmitting] = useState(false)
  const [verifyResults, setVerifyResults] = useState(null)

  // ── Damage entry state ──
  const [damageForm, setDamageForm] = useState({
    productId: '', quantity: '', reason: 'BROKEN', notes: '', damageDate: todayStr()
  })
  const [damageErrors, setDamageErrors] = useState({})
  const [savingDamage, setSavingDamage] = useState(false)

  // ── History filters ──
  const [filterDate, setFilterDate]   = useState('')
  const [damageFilter, setDamageFilter] = useState('')
  const [loading, setLoading]         = useState(false)

  // ── Notes modal ──
  const [notesModal, setNotesModal] = useState(null)
  const [noteText, setNoteText]     = useState('')
  const [noteStatus, setNoteStatus] = useState('')

  const loadProducts = useCallback(() => {
    productAPI.getAll().then(r => {
      const prods = r.data.data
      setProducts(prods)
      setEntries(prods.map(p => ({
        productId: p.id, name: p.name,
        currentStock: p.currentStock, actualStock: '', adminNotes: ''
      })))
    }).catch(() => toast.error('Failed to load products'))
  }, [])

  const loadRecords = useCallback(() => {
    setLoading(true)
    Promise.all([theftAPI.getAll(), damageAPI.getAll()])
      .then(([tr, dr]) => { setRecords(tr.data.data); setDamages(dr.data.data) })
      .catch(() => toast.error('Failed to load records'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { loadProducts(); loadRecords() }, [loadProducts, loadRecords])

  // ── Damage entry ──────────────────────────────────────────────────────
  const validateDamage = () => {
    const e = {}
    if (!damageForm.productId) e.productId = 'Select a product'
    if (!damageForm.quantity || parseInt(damageForm.quantity) < 1) e.quantity = 'Enter a valid quantity'
    if (!damageForm.reason) e.reason = 'Select a reason'
    return e
  }

  const handleSaveDamage = async (ev) => {
    ev.preventDefault()
    const errs = validateDamage()
    if (Object.keys(errs).length) { setDamageErrors(errs); return }
    setSavingDamage(true)
    try {
      const res = await damageAPI.create({
        productId: parseInt(damageForm.productId),
        quantity: parseInt(damageForm.quantity),
        reason: damageForm.reason,
        notes: damageForm.notes || null,
        damageDate: damageForm.damageDate || todayStr(),
      })
      toast.success(res.data.message)
      setDamageForm({ productId: '', quantity: '', reason: 'BROKEN', notes: '', damageDate: todayStr() })
      setDamageErrors({})
      loadProducts()
      loadRecords()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save damage record')
    } finally { setSavingDamage(false) }
  }

  // ── Stock verification ─────────────────────────────────────────────────
  const updateEntry = (productId, field, value) =>
    setEntries(prev => prev.map(e => e.productId === productId ? { ...e, [field]: value } : e))

  const handleVerify = async () => {
    const incomplete = stockEntries.filter(e => e.actualStock === '' || parseInt(e.actualStock) < 0)
    if (incomplete.length > 0) { toast.error('Enter actual stock for all products'); return }
    setSubmitting(true)
    try {
      const res = await theftAPI.verifyStock({
        entries: stockEntries.map(e => ({
          productId: e.productId,
          actualStock: parseInt(e.actualStock),
          adminNotes: e.adminNotes || null,
        }))
      })
      setVerifyResults(res.data.data)
      toast.success(res.data.message)
      loadProducts()
      loadRecords()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Verification failed')
    } finally { setSubmitting(false) }
  }

  // ── Notes modal ────────────────────────────────────────────────────────
  const handleSaveNotes = async () => {
    try {
      await theftAPI.updateNotes(notesModal.id, { adminNotes: noteText, status: noteStatus })
      toast.success('Notes updated')
      setNotesModal(null)
      loadRecords()
    } catch { toast.error('Failed to update notes') }
  }

  // ── Filters ────────────────────────────────────────────────────────────
  const filteredRecords = filterDate
    ? records.filter(r => r.detectionDate === filterDate) : records
  const filteredDamages = damageFilter
    ? damages.filter(d => d.damageDate === damageFilter) : damages

  const totalLoss = filteredRecords.reduce((s, r) => s + Number(r.lossValue || 0), 0)

  // ── CSV export ─────────────────────────────────────────────────────────
  const exportLossCSV = () => {
    const headers = ['Date','Product','Opening','Sold','Expected','Actual','Damaged','Unexplained','Loss Value','Status']
    const rows = filteredRecords.map(r => [
      r.detectionDate, r.productName, r.openingStock, r.soldQuantity,
      r.expectedStock, r.actualStock, r.damagedQuantity ?? 0,
      r.unexplainedLoss ?? r.missingQuantity, r.lossValue, r.status
    ])
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    a.download = `loss-history-${todayStr()}.csv`
    a.click()
    toast.success('Exported!')
  }

  const exportDamageCSV = () => {
    const headers = ['Date','Product','Quantity','Reason','Notes']
    const rows = filteredDamages.map(d => [d.damageDate, d.productName, d.quantity, d.reason, d.notes || ''])
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    a.download = `damage-history-${todayStr()}.csv`
    a.click()
    toast.success('Exported!')
  }

  return (
    <div className="animate-fade-in">

      {/* ── TABS ── */}
      <div className="billing-tabs" style={{ marginBottom:24, flexWrap:'wrap' }}>
        {TABS.map(t => (
          <button
            key={t.id}
            className={`billing-tab ${tab === t.id ? 'active' : ''}`}
            onClick={() => setTab(t.id)}
          >{t.label}</button>
        ))}
      </div>

      {/* ════════════════════════════════════════════
          TAB 1 — DAMAGE ENTRY
      ════════════════════════════════════════════ */}
      {tab === 'damage' && (
        <div>
          {/* Info banner */}
          <div className="card" style={{ marginBottom:20, borderLeft:'3px solid #f59e0b',
            background:'rgba(245,158,11,0.08)' }}>
            <div style={{ display:'flex', gap:14, alignItems:'flex-start' }}>
              <span style={{ fontSize:32 }}>📦</span>
              <div>
                <h3 style={{ fontWeight:700, marginBottom:6 }}>Damage Entry</h3>
                <p style={{ fontSize:14, lineHeight:1.6, color:'var(--gray)' }}>
                  Record damaged inventory here. The damaged quantity will be
                  <strong> automatically deducted from stock</strong> and will
                  <strong> not</strong> be counted as inventory theft during daily verification.
                </p>
              </div>
            </div>
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20 }}>
            {/* Form */}
            <div className="card">
              <h3 style={{ fontWeight:700, fontSize:16, marginBottom:20 }}>
                <FiPackage style={{ marginRight:8, color:'#f59e0b' }} />
                Record Damaged Stock
              </h3>
              <form onSubmit={handleSaveDamage}>
                <div className="form-group">
                  <label className="form-label">Product Name *</label>
                  <select
                    className={`form-input ${damageErrors.productId ? 'error' : ''}`}
                    value={damageForm.productId}
                    onChange={e => { setDamageForm(p => ({...p, productId: e.target.value})); setDamageErrors(p => ({...p, productId:''})) }}
                  >
                    <option value="">-- Select Product --</option>
                    {products.map(p => (
                      <option key={p.id} value={p.id}>{p.name} (Stock: {p.currentStock})</option>
                    ))}
                  </select>
                  {damageErrors.productId && <p className="form-error">{damageErrors.productId}</p>}
                </div>

                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                  <div className="form-group">
                    <label className="form-label">Damaged Quantity *</label>
                    <input type="number" min="1" className={`form-input ${damageErrors.quantity?'error':''}`}
                      value={damageForm.quantity}
                      onChange={e => { setDamageForm(p => ({...p, quantity: e.target.value})); setDamageErrors(p => ({...p, quantity:''})) }}
                      placeholder="e.g. 5" />
                    {damageErrors.quantity && <p className="form-error">{damageErrors.quantity}</p>}
                  </div>
                  <div className="form-group">
                    <label className="form-label">Date</label>
                    <input type="date" className="form-input"
                      value={damageForm.damageDate}
                      onChange={e => setDamageForm(p => ({...p, damageDate: e.target.value}))} />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Damage Reason *</label>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                    {DAMAGE_REASONS.map(r => (
                      <label key={r} style={{ display:'flex', alignItems:'center', gap:8,
                        padding:'10px 12px', border:`1.5px solid ${damageForm.reason === r ? '#6c63ff' : 'rgba(108,99,255,0.25)'}`,
                        borderRadius:10, cursor:'pointer',
                        background: damageForm.reason === r ? 'rgba(108,99,255,0.15)' : 'transparent',
                        transition:'all 0.18s ease' }}>
                        <input type="radio" name="reason" value={r} checked={damageForm.reason === r}
                          onChange={() => setDamageForm(p => ({...p, reason: r}))}
                          style={{ accentColor:'#6c63ff' }} />
                        <span style={{ fontSize:13, fontWeight:600, color: damageForm.reason === r ? '#a78bfa' : 'var(--gray)' }}>
                          {r === 'BROKEN' ? '💔 Broken' : r === 'EXPIRED' ? '⏳ Expired' : r === 'DEFECTIVE' ? '🔧 Defective' : '📝 Other'}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Notes (Optional)</label>
                  <textarea className="form-input" rows={2}
                    value={damageForm.notes}
                    onChange={e => setDamageForm(p => ({...p, notes: e.target.value}))}
                    placeholder="Additional details about the damage..." />
                </div>

                <button type="submit" className="btn btn-primary" style={{ width:'100%', justifyContent:'center' }}
                  disabled={savingDamage}>
                  {savingDamage ? <span className="btn-spinner" /> : <><FiPlus /> Save Damage Record</>}
                </button>
              </form>
            </div>

            {/* Today's damage summary */}
            <div className="card">
              <h3 style={{ fontWeight:700, fontSize:16, marginBottom:16 }}>
                📋 Today's Damage Records
              </h3>
              {damages.filter(d => d.damageDate === todayStr()).length === 0
                ? <div className="empty-state" style={{ padding:'30px 0' }}>
                    <FiPackage size={36} style={{ opacity:0.3 }} />
                    <p style={{ marginTop:10 }}>No damage recorded today</p>
                  </div>
                : <div style={{ display:'flex', flexDirection:'column', gap:8, maxHeight:420, overflowY:'auto' }}>
                    {damages.filter(d => d.damageDate === todayStr()).map(d => (
                      <div key={d.id} style={{ display:'flex', alignItems:'center', gap:12,
                        padding:'10px 14px', background:'rgba(245,158,11,0.08)',
                        border:'1px solid rgba(245,158,11,0.2)', borderRadius:10 }}>
                        <div style={{ flex:1 }}>
                          <strong style={{ fontSize:13 }}>{d.productName}</strong>
                          <div style={{ fontSize:12, color:'var(--gray)', marginTop:2 }}>{d.notes || '—'}</div>
                        </div>
                        <span className="badge badge-warning">{d.reason}</span>
                        <span style={{ fontWeight:800, color:'#f59e0b', fontSize:15 }}>−{d.quantity}</span>
                      </div>
                    ))}
                  </div>
              }
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════
          TAB 2 — STOCK VERIFICATION
      ════════════════════════════════════════════ */}
      {tab === 'verify' && (
        <div>
          <div className="card theft-info-card" style={{ marginBottom:20 }}>
            <div style={{ display:'flex', gap:16, alignItems:'flex-start' }}>
              <span style={{ fontSize:36 }}>⏰</span>
              <div>
                <h3 style={{ fontWeight:700, marginBottom:6 }}>Daily Stock Verification</h3>
                <p style={{ fontSize:14, lineHeight:1.6, color:'var(--gray)' }}>
                  Enter the physical stock count for each product. The system calculates:<br />
                  <strong>Unexplained Loss = Expected Stock − Actual Stock − Recorded Damage</strong><br />
                  If unexplained loss &gt; 0 → <strong>"Possible Inventory Loss Detected"</strong> + email alert sent.
                </p>
              </div>
            </div>
          </div>

          {products.length === 0
            ? <div className="empty-state"><FiShield size={48} /><h3>No products to verify</h3></div>
            : <>
                <div className="card" style={{ marginBottom:16 }}>
                  {/* Header row */}
                  <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr 1fr 1fr 1fr 2fr',
                    gap:8, padding:'10px 14px',
                    background:'var(--gradient-primary)', borderRadius:10,
                    color:'white', fontWeight:700, fontSize:12 }}>
                    <span>Product</span>
                    <span>Expected</span>
                    <span>Damaged Today</span>
                    <span>Actual Stock *</span>
                    <span>Difference</span>
                    <span>Notes</span>
                  </div>

                  <div className="verify-list">
                    {stockEntries.map(entry => {
                      const todayDmg = damages
                        .filter(d => d.productId === entry.productId && d.damageDate === todayStr())
                        .reduce((s, d) => s + d.quantity, 0)
                      const actual = entry.actualStock !== '' ? parseInt(entry.actualStock) : null
                      const product = products.find(p => p.id === entry.productId)
                      const soldQty = product ? (product.openingStock || 0) - entry.currentStock : 0
                      const expected = actual !== null ? entry.currentStock : entry.currentStock
                      const diff = actual !== null ? entry.currentStock - actual : null
                      const unexplained = diff !== null ? Math.max(0, diff - todayDmg) : null
                      const isLoss = unexplained !== null && unexplained > 0

                      return (
                        <div key={entry.productId}
                          className={`verify-row ${isLoss ? 'verify-row--alert' : ''}`}>
                          <div className="verify-row__name">
                            <strong>{entry.name}</strong>
                            {isLoss && <span className="badge badge-danger" style={{ marginLeft:8 }}>
                              ⚠ Loss: {unexplained}
                            </span>}
                            {diff !== null && diff > 0 && !isLoss && <span className="badge badge-warning" style={{ marginLeft:8 }}>
                              Damaged: {todayDmg}
                            </span>}
                          </div>
                          <div style={{ fontSize:14 }}>{entry.currentStock}</div>
                          <div>
                            <span style={{ fontSize:13, color: todayDmg > 0 ? '#f59e0b' : 'var(--gray)', fontWeight: todayDmg > 0 ? 700 : 400 }}>
                              {todayDmg > 0 ? `−${todayDmg}` : '0'}
                            </span>
                          </div>
                          <div>
                            <input type="number" min="0"
                              className={`form-input ${isLoss ? 'error' : ''}`}
                              style={{ width:90, padding:'6px 10px', fontSize:14 }}
                              value={entry.actualStock}
                              onChange={e => updateEntry(entry.productId, 'actualStock', e.target.value)}
                              placeholder="0" />
                          </div>
                          <div style={{ fontWeight:700,
                            color: diff === null ? 'var(--gray)' : diff === 0 ? '#22c55e' : isLoss ? '#ef4444' : '#f59e0b' }}>
                            {diff !== null ? (diff === 0 ? '✓ 0' : diff > 0 ? `−${diff}` : `+${Math.abs(diff)}`) : '—'}
                          </div>
                          <div>
                            <input type="text" className="form-input"
                              style={{ fontSize:13, padding:'6px 10px' }}
                              value={entry.adminNotes}
                              onChange={e => updateEntry(entry.productId, 'adminNotes', e.target.value)}
                              placeholder="Optional note..." />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                <div style={{ display:'flex', justifyContent:'flex-end' }}>
                  <button className="btn btn-primary" style={{ padding:'14px 32px', fontSize:15 }}
                    onClick={handleVerify} disabled={submitting}>
                    {submitting ? <><span className="btn-spinner" /> Verifying...</> : '✅ Submit Verification'}
                  </button>
                </div>
              </>
          }

          {/* Verification results */}
          {verifyResults !== null && (
            <div className="card" style={{ marginTop:24,
              border:`2px solid ${verifyResults.filter(r => (r.unexplainedLoss || 0) > 0).length === 0 ? '#22c55e' : '#ef4444'}` }}>
              {verifyResults.filter(r => (r.unexplainedLoss || 0) > 0).length === 0
                ? <div style={{ textAlign:'center', padding:'30px 0' }}>
                    <div style={{ fontSize:48, marginBottom:12 }}>🎉</div>
                    <h3 style={{ fontWeight:700, color:'#22c55e' }}>No Unexplained Loss!</h3>
                    <p style={{ color:'var(--gray)' }}>
                      {verifyResults.length > 0 && verifyResults.some(r => (r.damagedQuantity || 0) > 0)
                        ? 'All missing stock is explained by recorded damage records.'
                        : 'All stock counts match perfectly. Inventory is secure.'}
                    </p>
                  </div>
                : <div>
                    <h3 style={{ fontWeight:700, color:'#ef4444', marginBottom:16 }}>
                      🚨 Possible Inventory Loss Detected
                    </h3>
                    <div className="table-container">
                      <table>
                        <thead><tr>
                          <th>Product</th><th>Expected</th><th>Actual</th>
                          <th>Damaged</th><th>Unexplained</th><th>Loss Value</th><th>Status</th>
                        </tr></thead>
                        <tbody>
                          {verifyResults.map(r => (
                            <tr key={r.id}>
                              <td><strong>{r.productName}</strong></td>
                              <td>{r.expectedStock}</td>
                              <td>{r.actualStock}</td>
                              <td><span className="badge badge-warning">{r.damagedQuantity ?? 0}</span></td>
                              <td>
                                <span className={`badge ${(r.unexplainedLoss||0) > 0 ? 'badge-danger' : 'badge-success'}`}>
                                  {(r.unexplainedLoss||0) > 0 ? `−${r.unexplainedLoss}` : '✓ 0'}
                                </span>
                              </td>
                              <td><span className="badge badge-warning">₹{Number(r.lossValue).toLocaleString('en-IN')}</span></td>
                              <td>
                                <span className={`badge ${r.status === 'DETECTED' ? 'badge-danger' : 'badge-success'}`}>
                                  {r.status === 'DETECTED' ? '⚠ Possible Loss' : '✓ Normal'}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
              }
            </div>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════
          TAB 3 — LOSS HISTORY
      ════════════════════════════════════════════ */}
      {tab === 'history' && (
        <div>
          {/* Summary cards */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))', gap:16, marginBottom:20 }}>
            {[
              { label:'Total Records', value:records.length,                                          bg:'#FFA384', icon:'📋' },
              { label:'Total Loss',    value:`₹${totalLoss.toLocaleString('en-IN')}`,                 bg:'#7A3C3A', icon:'💸' },
              { label:'Loss Detected', value:records.filter(r=>r.status==='DETECTED').length,         bg:'#c0392b', icon:'🚨' },
              { label:'Normal',        value:records.filter(r=>r.status==='NORMAL').length,           bg:'#2e7d5a', icon:'✅' },
              { label:'Resolved',      value:records.filter(r=>r.status==='RESOLVED').length,         bg:'#4a7a9a', icon:'🔒' },
            ].map(s => (
              <div key={s.label} style={{
                background: s.bg, borderRadius:'var(--r-lg)',
                padding:'18px 16px', boxShadow:'0 4px 16px rgba(122,60,58,.18)',
                display:'flex', alignItems:'center', gap:14,
                position:'relative', overflow:'hidden',
                transition:'transform .2s ease, box-shadow .2s ease',
              }}
                onMouseEnter={e => { e.currentTarget.style.transform='translateY(-4px)'; e.currentTarget.style.boxShadow='0 8px 24px rgba(0,0,0,.22)'; }}
                onMouseLeave={e => { e.currentTarget.style.transform='translateY(0)';   e.currentTarget.style.boxShadow='0 4px 16px rgba(122,60,58,.18)'; }}
              >
                <div style={{ position:'absolute', bottom:-14, right:-14, width:60, height:60, borderRadius:'50%', background:'rgba(255,255,255,.12)', pointerEvents:'none' }} />
                <div style={{ width:42, height:42, flexShrink:0, borderRadius:10, background:'rgba(255,255,255,.22)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:20 }}>{s.icon}</div>
                <div>
                  <p style={{ fontSize:10.5, color:'rgba(255,255,255,.78)', fontWeight:700, textTransform:'uppercase', letterSpacing:'.6px', marginBottom:3 }}>{s.label}</p>
                  <h3 style={{ fontSize:20, fontWeight:900, color:'#fff', lineHeight:1 }}>{s.value}</h3>
                </div>
              </div>
            ))}
          </div>

          {/* Filter + export */}
          <div className="card" style={{ marginBottom:16, display:'flex', gap:16, alignItems:'flex-end', flexWrap:'wrap' }}>
            <div>
              <label className="form-label"><FiCalendar style={{ marginRight:4 }} />Filter by Date</label>
              <input type="date" className="form-input" style={{ width:180 }}
                value={filterDate} onChange={e => setFilterDate(e.target.value)} />
            </div>
            {filterDate && <button className="btn btn-secondary" onClick={() => setFilterDate('')}><FiX /> Clear</button>}
            <div style={{ marginLeft:'auto' }}>
              <button className="btn btn-primary" onClick={exportLossCSV} disabled={filteredRecords.length === 0}>
                <FiDownload /> Export CSV
              </button>
            </div>
          </div>

          {loading
            ? <div className="loading-center"><div className="spinner" /></div>
            : filteredRecords.length === 0
              ? <div className="empty-state"><FiCheckCircle size={48} /><h3>No loss records</h3><p>Your inventory is clean!</p></div>
              : <div className="table-container">
                  <table>
                    <thead><tr>
                      <th>Date</th><th>Product</th><th>Expected</th><th>Actual</th>
                      <th>Damaged</th><th>Unexplained</th><th>Loss (₹)</th><th>Status</th><th>Notes</th><th>Action</th>
                    </tr></thead>
                    <tbody>
                      {filteredRecords.map(r => (
                        <tr key={r.id}>
                          <td style={{ fontSize:12 }}>{r.detectionDate}</td>
                          <td><strong>{r.productName}</strong></td>
                          <td>{r.expectedStock}</td>
                          <td>{r.actualStock}</td>
                          <td><span className="badge badge-warning">{r.damagedQuantity ?? 0}</span></td>
                          <td>
                            <span className={`badge ${(r.unexplainedLoss ?? r.missingQuantity) > 0 ? 'badge-danger' : 'badge-success'}`}>
                              {(r.unexplainedLoss ?? r.missingQuantity) > 0
                                ? `−${r.unexplainedLoss ?? r.missingQuantity}` : '✓ 0'}
                            </span>
                          </td>
                          <td><span className="badge badge-warning">₹{Number(r.lossValue).toLocaleString('en-IN')}</span></td>
                          <td>
                            <span className={`badge ${
                              r.status==='RESOLVED'?'badge-success':
                              r.status==='INVESTIGATED'?'badge-primary':
                              r.status==='NORMAL'?'badge-success':'badge-danger'}`}>
                              {r.status === 'DETECTED' ? '⚠ Possible Loss'
                               : r.status === 'NORMAL'  ? '✓ Normal'
                               : r.status}
                            </span>
                          </td>
                          <td style={{ maxWidth:120, fontSize:12, color:'var(--gray)' }}>
                            {r.adminNotes || <span style={{ opacity:0.4 }}>—</span>}
                          </td>
                          <td>
                            <button className="btn-icon btn-icon-edit"
                              onClick={() => { setNotesModal(r); setNoteText(r.adminNotes||''); setNoteStatus(r.status) }}>
                              <FiEdit2 />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
          }
        </div>
      )}

      {/* ════════════════════════════════════════════
          TAB 4 — DAMAGE HISTORY
      ════════════════════════════════════════════ */}
      {tab === 'damages' && (
        <div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))', gap:16, marginBottom:20 }}>
            {[
              { label:'Total Records', value:damages.length,                                                     color:'linear-gradient(135deg,#a07840,#c8a870)', icon:'📋' },
              { label:'Total Damaged', value:damages.reduce((s,d)=>s+d.quantity,0),                             color:'linear-gradient(135deg,#8b6030,#d4a843)', icon:'📦' },
              { label:'Broken',        value:damages.filter(d=>d.reason==='BROKEN').length,                      color:'linear-gradient(135deg,#6b4820,#b08050)', icon:'💔' },
              { label:'Expired',       value:damages.filter(d=>d.reason==='EXPIRED').length,                     color:'linear-gradient(135deg,#7a5c2e,#c8a870)', icon:'⏳' },
            ].map(s => (
              <div key={s.label} style={{ background:s.color, borderRadius:'var(--radius-lg)',
                padding:'16px', boxShadow:'var(--shadow-md)', display:'flex', alignItems:'center', gap:12 }}>
                <span style={{ fontSize:24 }}>{s.icon}</span>
                <div>
                  <p style={{ fontSize:11, color:'rgba(255,255,255,0.8)', fontWeight:600 }}>{s.label}</p>
                  <h3 style={{ fontSize:20, fontWeight:800, color:'white' }}>{s.value}</h3>
                </div>
              </div>
            ))}
          </div>

          <div className="card" style={{ marginBottom:16, display:'flex', gap:16, alignItems:'flex-end', flexWrap:'wrap' }}>
            <div>
              <label className="form-label"><FiCalendar style={{ marginRight:4 }} />Filter by Date</label>
              <input type="date" className="form-input" style={{ width:180 }}
                value={damageFilter} onChange={e => setDamageFilter(e.target.value)} />
            </div>
            {damageFilter && <button className="btn btn-secondary" onClick={() => setDamageFilter('')}><FiX /> Clear</button>}
            <div style={{ marginLeft:'auto' }}>
              <button className="btn btn-primary" onClick={exportDamageCSV} disabled={filteredDamages.length === 0}>
                <FiDownload /> Export CSV
              </button>
            </div>
          </div>

          {loading
            ? <div className="loading-center"><div className="spinner" /></div>
            : filteredDamages.length === 0
              ? <div className="empty-state"><FiPackage size={48} /><h3>No damage records</h3></div>
              : <div className="table-container">
                  <table>
                    <thead><tr><th>Date</th><th>Product</th><th>Quantity</th><th>Reason</th><th>Notes</th></tr></thead>
                    <tbody>
                      {filteredDamages.map(d => (
                        <tr key={d.id}>
                          <td style={{ fontSize:12 }}>{d.damageDate}</td>
                          <td><strong>{d.productName}</strong></td>
                          <td><span className="badge badge-warning">−{d.quantity}</span></td>
                          <td>
                            <span className="badge badge-primary">
                              {d.reason==='BROKEN'?'💔 Broken':d.reason==='EXPIRED'?'⏳ Expired':d.reason==='DEFECTIVE'?'🔧 Defective':'📝 Other'}
                            </span>
                          </td>
                          <td style={{ fontSize:12, color:'var(--gray)' }}>{d.notes || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
          }
        </div>
      )}

      {/* ── NOTES MODAL ── */}
      {notesModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setNotesModal(null)}>
          <div className="modal-box" style={{ maxWidth:480 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
              <h3 style={{ fontWeight:700, fontSize:18 }}>Update Loss Record</h3>
              <button className="btn-icon" onClick={() => setNotesModal(null)}><FiX /></button>
            </div>
            <div style={{ background:'rgba(239,68,68,0.12)', border:'1px solid rgba(239,68,68,0.3)',
              borderRadius:10, padding:'12px 16px', marginBottom:16, fontSize:14 }}>
              <strong>🚨 {notesModal.productName}</strong>
              <p style={{ marginTop:4, color:'#fca5a5' }}>
                Unexplained Loss: {notesModal.unexplainedLoss ?? notesModal.missingQuantity} units |
                Loss Value: ₹{Number(notesModal.lossValue).toLocaleString('en-IN')}
              </p>
            </div>
            <div className="form-group">
              <label className="form-label">Status</label>
              <select className="form-input" value={noteStatus} onChange={e => setNoteStatus(e.target.value)}>
                <option value="DETECTED">DETECTED</option>
                <option value="INVESTIGATED">INVESTIGATED</option>
                <option value="RESOLVED">RESOLVED</option>
                <option value="NORMAL">NORMAL</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Admin Notes</label>
              <textarea className="form-input" rows={4} value={noteText}
                onChange={e => setNoteText(e.target.value)}
                placeholder="Investigation notes, actions taken..." />
            </div>
            <div style={{ display:'flex', gap:12, justifyContent:'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setNotesModal(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSaveNotes}>Save Notes</button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
