import React, { useEffect, useState, useCallback, useRef } from 'react'
import { batchAPI, productAPI, barcodeAPI } from '../services/api'
import toast from 'react-hot-toast'
import { motion } from 'framer-motion'
import {
  Plus, Search, X, Package, Camera, Hash,
  CalendarDays, Layers, ScanLine
} from 'lucide-react'

const EMPTY_FORM = {
  productId: '', barcode: '', productName: '', category: '',
  batchNumber: '', manufacturingDate: '', expiryDate: '',
  purchasePrice: '', sellingPrice: '', quantity: ''
}

import { useAuth } from '../context/AuthContext'

const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.06 } } }
const item = { hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0, transition: { duration: 0.3 } } }

export default function BatchInventory() {
  const { activeBranchId } = useAuth()
  const [batches, setBatches]         = useState([])
  const [products, setProducts]       = useState([])
  const [loading, setLoading]         = useState(true)
  const [search, setSearch]           = useState('')
  const [modalOpen, setModalOpen]     = useState(false)
  const [form, setForm]               = useState(EMPTY_FORM)
  const [errors, setErrors]           = useState({})
  const [saving, setSaving]           = useState(false)
  const [barcodeInput, setBarcodeInput] = useState('')
  const [lookingUp, setLookingUp]     = useState(false)
  const [productFound, setProductFound] = useState(null)  // null | true | false
  const fileRef                       = useRef()

  const load = useCallback(() => {
    setBatches([])
    setProducts([])
    setLoading(true)
    Promise.all([batchAPI.getAll(), productAPI.getAll()])
      .then(([br, pr]) => { setBatches(br.data.data || []); setProducts(pr.data.data || []) })
      .catch(() => toast.error('Failed to load data'))
      .finally(() => setLoading(false))
  }, [activeBranchId])

  useEffect(() => { load() }, [load])

  const filtered = batches.filter(b =>
    b.productName?.toLowerCase().includes(search.toLowerCase()) ||
    b.batchNumber?.toLowerCase().includes(search.toLowerCase()) ||
    b.barcode?.includes(search)
  )

  // ── Barcode text lookup ───────────────────────────────────────────────────
  const handleBarcodeLookup = async () => {
    if (!barcodeInput.trim()) return
    setLookingUp(true)
    try {
      const r = await barcodeAPI.lookup(barcodeInput.trim())
      const data = r.data.data
      if (data?.productFound) {
        setProductFound(true)
        setForm(p => ({
          ...p,
          barcode: barcodeInput.trim(),
          productId: data.productId,
          productName: data.productName,
          category: data.category,
          sellingPrice: data.sellingPrice || '',
        }))
        toast.success(`Product found: ${data.productName}`)
      } else {
        setProductFound(false)
        setForm(p => ({ ...p, barcode: barcodeInput.trim(), productId: '' }))
        toast('New product — please fill in the details', { icon: '📦' })
      }
    } catch { toast.error('Lookup failed') }
    finally { setLookingUp(false) }
  }

  // ── Camera decode: upload image to /api/barcode/decode ────────────────────
  const handleImageScan = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const formData = new FormData()
    formData.append('image', file)
    setLookingUp(true)
    try {
      const r = await barcodeAPI.decode(formData)
      const data = r.data.data
      if (!data) { toast.error('No barcode detected in image'); return }
      setBarcodeInput(data.barcode)
      if (data.productFound) {
        setProductFound(true)
        setForm(p => ({
          ...p, barcode: data.barcode, productId: data.productId,
          productName: data.productName, category: data.category,
          sellingPrice: data.sellingPrice || '',
        }))
        toast.success(`Barcode decoded: ${data.barcode} — ${data.productName}`)
      } else {
        setProductFound(false)
        setForm(p => ({ ...p, barcode: data.barcode, productId: '' }))
        toast(`Barcode: ${data.barcode} — New product, fill in details`, { icon: '📦' })
      }
    } catch { toast.error('Image decode failed') }
    finally { setLookingUp(false); e.target.value = '' }
  }

  const validate = () => {
    const e = {}
    if (!form.batchNumber.trim()) e.batchNumber = 'Batch number is required'
    if (!form.purchasePrice || parseFloat(form.purchasePrice) <= 0) e.purchasePrice = 'Valid purchase price required'
    if (!form.sellingPrice || parseFloat(form.sellingPrice) <= 0) e.sellingPrice = 'Valid selling price required'
    if (!form.quantity || parseInt(form.quantity) < 1) e.quantity = 'Quantity must be ≥ 1'
    if (!form.productId && !form.barcode && !form.productName.trim()) {
      e.productName = 'Product name is required for new products'
    }

    const cat = form.category ? form.category.trim().toLowerCase() : "";
    const requiredDateCats = ["medicines", "medicine", "food", "beverages", "beverage", "cosmetics", "cosmetic", "dairy products", "dairy", "bakery products", "bakery"];
    const noDateCats = ["dress", "clothing", "boxes", "plastic products", "stationery", "furniture", "dresses", "box", "plastic"];

    if (!noDateCats.includes(cat)) {
      if (requiredDateCats.includes(cat)) {
        if (!form.manufacturingDate || !form.expiryDate) {
          toast.error(`Manufacturing Date and Expiry Date are mandatory for category: ${form.category}`);
          e.expiryDate = 'Required dates missing'
        }
      }
      if (form.manufacturingDate && form.expiryDate && form.expiryDate <= form.manufacturingDate) {
        toast.error('Expiry Date must be later than Manufacturing Date.');
        e.expiryDate = 'Expiry Date must be later than Manufacturing Date.'
      }
    }

    return e
  }

  const handleSave = async (ev) => {
    ev.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length) { setErrors(errs); return }
    setSaving(true)
    
    const cat = form.category ? form.category.trim().toLowerCase() : "";
    const noDateCats = ["dress", "clothing", "boxes", "plastic products", "stationery", "furniture", "dresses", "box", "plastic"];
    
    let finalMfd = form.manufacturingDate || null;
    let finalExp = form.expiryDate || null;

    if (noDateCats.includes(cat)) {
      finalMfd = null;
      finalExp = null;
    }

    try {
      const payload = {
        productId: form.productId ? parseInt(form.productId) : null,
        barcode: form.barcode || null,
        productName: form.productName || null,
        category: form.category || null,
        batchNumber: form.batchNumber,
        manufacturingDate: finalMfd,
        expiryDate: finalExp,
        purchasePrice: parseFloat(form.purchasePrice),
        sellingPrice: parseFloat(form.sellingPrice),
        quantity: parseInt(form.quantity),
      }
      await batchAPI.addBatch(payload)
      toast.success('Batch added! Stock updated.')
      setModalOpen(false)
      setForm(EMPTY_FORM); setBarcodeInput(''); setProductFound(null)
      load()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to add batch')
    } finally { setSaving(false) }
  }

  const openModal = () => {
    setForm(EMPTY_FORM); setBarcodeInput(''); setProductFound(null)
    setErrors({}); setModalOpen(true)
  }

  const ch = (e) => {
    setForm(p => ({ ...p, [e.target.name]: e.target.value }))
    setErrors(p => ({ ...p, [e.target.name]: '' }))
  }

  return (
    <motion.div className="animate-fade-in" variants={container} initial="hidden" animate="show">

      {/* ── Stats ── */}
      <motion.div variants={item}
        style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))', gap:16, marginBottom:24 }}>
        {[
          { label:'Total Batches',    value: batches.length },
          { label:'Active Batches',   value: batches.filter(b => b.active).length },
          { label:'Total Received',   value: batches.reduce((s, b) => s + (b.quantityReceived || 0), 0) },
          { label:'Total Remaining',  value: batches.reduce((s, b) => s + (b.quantityRemaining || 0), 0) },
        ].map(s => (
          <div key={s.label} className="card" style={{ display:'flex', alignItems:'center', gap:14, padding:'20px' }}>
            <div style={{ width:44, height:44, borderRadius:'var(--r-sm)', background:'var(--accent-lt)',
              display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
              <Layers size={20} strokeWidth={1.75} style={{ color:'var(--accent)' }} />
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
          <h1 className="page-title">Batch Inventory</h1>
          <p className="page-subtitle">Receive stock by scanning manufacturer barcodes</p>
        </div>
        <div style={{ display:'flex', gap:12, alignItems:'center' }}>
          <div className="search-bar">
            <Search size={15} strokeWidth={1.75} />
            <input placeholder="Search batches..." value={search} onChange={e => setSearch(e.target.value)} />
            {search && <button onClick={() => setSearch('')} style={{ background:'none', border:'none', cursor:'pointer', display:'flex' }}><X size={14} /></button>}
          </div>
          <button className="btn btn-primary" onClick={openModal}><Plus size={15} strokeWidth={2} /> Receive Stock</button>
        </div>
      </motion.div>

      {/* ── Table ── */}
      <motion.div variants={item}>
        {loading
          ? <div className="loading-center"><div className="spinner" /></div>
          : filtered.length === 0
            ? <div className="empty-state"><Package size={48} /><h3>No Batch Inventory Found</h3><p>Click "Receive Stock" to add your first batch</p></div>
            : <div className="table-container">
                <table>
                  <thead>
                    <tr><th>#</th><th>Product</th><th>Barcode</th><th>Batch #</th>
                        <th>MFD</th><th>Expiry</th><th>Status</th><th>Available Stock</th>
                        <th>Received</th><th>Received By</th><th>Date</th></tr>
                  </thead>
                  <tbody>
                    {filtered.map((b, i) => (
                      <tr key={b.id}>
                        <td>{i + 1}</td>
                        <td><strong>{b.productName}</strong><br />
                          <span style={{ fontSize:11, color:'var(--text-3)' }}>{b.category}</span></td>
                        <td style={{ fontFamily:'monospace', fontSize:12 }}>{b.barcode || '—'}</td>
                        <td><span className="badge badge-primary">{b.batchNumber}</span></td>
                        <td style={{ fontSize:12 }}>{b.manufacturingDate ? new Date(b.manufacturingDate).toLocaleDateString('en-IN') : '-'}</td>
                        <td style={{ fontSize:12 }}>
                          {b.expiryDate
                            ? <span style={{ color: new Date(b.expiryDate) < new Date() ? 'var(--err)' : 'var(--text-2)' }}>
                                {new Date(b.expiryDate).toLocaleDateString('en-IN')}
                              </span>
                            : '—'}
                        </td>
                        <td>
                          <span className={`badge ${b.active && b.quantityRemaining > 0 ? 'badge-success' : 'badge-danger'}`}>
                            {b.active && b.quantityRemaining > 0 ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td><span className={`badge ${b.quantityRemaining > 0 ? 'badge-success' : 'badge-danger'}`}>{b.quantityRemaining}</span></td>
                        <td><span className="badge badge-info">{b.quantityReceived}</span></td>
                        <td style={{ fontSize:12 }}>{b.receivedByStaffName || '—'}</td>
                        <td style={{ fontSize:12, color:'var(--text-3)' }}>
                          {new Date(b.createdAt).toLocaleDateString('en-IN')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
        }
      </motion.div>

      {/* ── Add Batch Modal ── */}
      {modalOpen && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModalOpen(false)}>
          <div className="modal-box" style={{ maxWidth:580 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
              <h2 style={{ fontSize:20, fontWeight:700 }}>Receive New Stock</h2>
              <button className="btn-icon" onClick={() => setModalOpen(false)}><X size={16} strokeWidth={1.75} /></button>
            </div>

            {/* ── Barcode scan section ── */}
            <div className="card" style={{ marginBottom:20, background:'var(--slate-50)', padding:'16px' }}>
              <p style={{ fontSize:13, fontWeight:600, color:'var(--text-2)', marginBottom:10 }}>
                <ScanLine size={14} style={{ verticalAlign:'middle', marginRight:6 }} />
                Step 1 — Identify Product via Barcode
              </p>
              <div style={{ display:'flex', gap:8, marginBottom:10 }}>
                <input
                  className="form-input"
                  placeholder="Type or scan barcode number..."
                  value={barcodeInput}
                  onChange={e => setBarcodeInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleBarcodeLookup()}
                  style={{ flex:1 }}
                />
                <button className="btn btn-primary" onClick={handleBarcodeLookup} disabled={lookingUp || !barcodeInput.trim()}>
                  {lookingUp ? <span className="btn-spinner" /> : <><Hash size={14} /> Lookup</>}
                </button>
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <input ref={fileRef} type="file" accept="image/*" capture="environment"
                  style={{ display:'none' }} onChange={handleImageScan} />
                <button className="btn btn-secondary btn-sm" onClick={() => fileRef.current?.click()}>
                  <Camera size={14} /> Scan from Camera
                </button>
                {productFound === true && (
                  <span style={{ color:'var(--ok)', fontSize:13, fontWeight:600 }}>
                    ✓ Product found — details auto-filled
                  </span>
                )}
                {productFound === false && (
                  <span style={{ color:'var(--warn)', fontSize:13, fontWeight:600 }}>
                    New product — fill in details below
                  </span>
                )}
              </div>
            </div>

            <form onSubmit={handleSave}>
              {/* ── Product fields (shown when barcode not found or no barcode) ── */}
              {(productFound === false || (!form.productId && !productFound)) && (
                <>
                  <div className="form-group">
                    <label className="form-label">Product Name *</label>
                    <input name="productName" className={`form-input ${errors.productName ? 'error' : ''}`}
                      value={form.productName} onChange={ch} placeholder="e.g. Rice 5kg"
                      disabled={productFound === true} />
                    {errors.productName && <p className="form-error">{errors.productName}</p>}
                  </div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                    <div className="form-group">
                      <label className="form-label">Category</label>
                      <input name="category" className="form-input" value={form.category} onChange={ch} placeholder="e.g. Grocery" />
                    </div>
                  </div>
                </>
              )}

              {/* If product found, show readonly summary */}
              {productFound === true && form.productName && (
                <div style={{ background:'var(--ok-bg)', border:'1px solid var(--ok-bdr)',
                  borderRadius:'var(--r-md)', padding:'10px 14px', marginBottom:16,
                  fontSize:13, color:'var(--text-2)' }}>
                  <strong style={{ color:'var(--text-h)' }}>{form.productName}</strong>
                  {form.category && <span style={{ marginLeft:8, color:'var(--text-3)' }}>· {form.category}</span>}
                </div>
              )}

              {/* ── Batch-specific fields ── */}
              <p style={{ fontSize:12, fontWeight:700, color:'var(--text-3)', textTransform:'uppercase',
                letterSpacing:'.05em', marginBottom:12, marginTop:4 }}>
                Step 2 — Batch Details
              </p>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                <div className="form-group">
                  <label className="form-label">Batch Number *</label>
                  <input name="batchNumber" className={`form-input ${errors.batchNumber ? 'error' : ''}`}
                    value={form.batchNumber} onChange={ch} placeholder="e.g. BT-2024-001" />
                  {errors.batchNumber && <p className="form-error">{errors.batchNumber}</p>}
                </div>
                <div className="form-group">
                  <label className="form-label">Quantity *</label>
                  <input type="number" min="1" name="quantity"
                    className={`form-input ${errors.quantity ? 'error' : ''}`}
                    value={form.quantity} onChange={ch} placeholder="e.g. 50" />
                  {errors.quantity && <p className="form-error">{errors.quantity}</p>}
                </div>
                {(() => {
                  const cat = form.category ? form.category.trim().toLowerCase() : "";
                  const noDateCats = ["dress", "clothing", "boxes", "plastic products", "stationery", "furniture", "dresses", "box", "plastic"];
                  const requiredDateCats = ["medicines", "medicine", "food", "beverages", "beverage", "cosmetics", "cosmetic", "dairy products", "dairy", "bakery products", "bakery"];

                  if (noDateCats.includes(cat)) return null;

                  const isMandatory = requiredDateCats.includes(cat);

                  return (
                    <>
                      <div className="form-group">
                        <label className="form-label">Manufacturing Date {isMandatory && "*"}</label>
                        <input type="date" name="manufacturingDate" className="form-input"
                          value={form.manufacturingDate} onChange={ch} required={isMandatory} />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Expiry Date {isMandatory && "*"}</label>
                        <input type="date" name="expiryDate" className="form-input"
                          value={form.expiryDate} onChange={ch} min={form.manufacturingDate || undefined} required={isMandatory} />
                        {form.manufacturingDate && form.expiryDate && form.expiryDate <= form.manufacturingDate && (
                          <p style={{ fontSize:11, color:'var(--err)', marginTop:3 }}>
                            ⚠️ Expiry Date must be later than Manufacturing Date.
                          </p>
                        )}
                      </div>
                    </>
                  );
                })()}
                <div className="form-group">
                  <label className="form-label">Purchase Price (₹) *</label>
                  <input type="number" step="0.01" name="purchasePrice"
                    className={`form-input ${errors.purchasePrice ? 'error' : ''}`}
                    value={form.purchasePrice} onChange={ch} placeholder="0.00" />
                  {errors.purchasePrice && <p className="form-error">{errors.purchasePrice}</p>}
                </div>
                <div className="form-group">
                  <label className="form-label">Selling Price (₹) *</label>
                  <input type="number" step="0.01" name="sellingPrice"
                    className={`form-input ${errors.sellingPrice ? 'error' : ''}`}
                    value={form.sellingPrice} onChange={ch} placeholder="0.00" />
                  {errors.sellingPrice && <p className="form-error">{errors.sellingPrice}</p>}
                </div>
              </div>
              <div style={{ display:'flex', gap:12, justifyContent:'flex-end', marginTop:8 }}>
                <button type="button" className="btn btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? <span className="btn-spinner" /> : <><Plus size={14} /> Add Batch</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </motion.div>
  )
}
