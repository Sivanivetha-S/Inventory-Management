import React, { useEffect, useState, useRef } from 'react'
import { productAPI, customerAPI, invoiceAPI, discountAPI } from '../services/api'
import toast from 'react-hot-toast'
import { useReactToPrint } from 'react-to-print'
import { FiPlus, FiTrash2, FiSearch, FiPrinter, FiX, FiEye, FiPercent } from 'react-icons/fi'
import './Billing.css'

export default function Billing() {
  const [products, setProducts]       = useState([])
  const [customers, setCustomers]     = useState([])
  const [discounts, setDiscounts]     = useState([])
  const [cart, setCart]               = useState([])
  const [selectedCustomer, setSelectedCustomer] = useState(null)
  const [customerSearch, setCustomerSearch]     = useState('')
  const [productSearch, setProductSearch]       = useState('')
  const [discountPercent, setDiscountPercent]   = useState('')
  const [selectedDiscount, setSelectedDiscount] = useState(null)
  const [notes, setNotes]             = useState('')
  const [amountPaid, setAmountPaid]   = useState('')
  const [saving, setSaving]           = useState(false)
  const [invoice, setInvoice]         = useState(null)
  const [invoices, setInvoices]       = useState([])
  const [tab, setTab]                 = useState('new')
  const printRef                      = useRef()

  useEffect(() => {
    productAPI.getAll().then(r => setProducts(r.data.data)).catch(() => {})
    customerAPI.getAll().then(r => setCustomers(r.data.data)).catch(() => {})
    invoiceAPI.getAll().then(r => setInvoices(r.data.data)).catch(() => {})
    discountAPI.getActive().then(r => setDiscounts(r.data.data)).catch(() => {})
  }, [])

  const filteredProducts  = products.filter(p => p.name.toLowerCase().includes(productSearch.toLowerCase()) || p.category.toLowerCase().includes(productSearch.toLowerCase()))
  const filteredCustomers = customers.filter(c => (c.phoneNumber||'').includes(customerSearch))

  const addToCart = (product) => {
    setCart(prev => {
      const existing = prev.find(i => i.productId === product.id)
      if (existing) return prev.map(i => i.productId === product.id ? { ...i, quantity: i.quantity + 1 } : i)
      return [...prev, { productId: product.id, name: product.name, unitPrice: Number(product.sellingPrice), quantity: 1, maxQty: product.currentStock }]
    })
  }

  const updateQty = (productId, qty) => {
    if (qty < 1) return
    setCart(prev => prev.map(i => i.productId === productId ? { ...i, quantity: Math.min(qty, i.maxQty) } : i))
  }

  const removeItem = (productId) => setCart(prev => prev.filter(i => i.productId !== productId))

  const subtotal = cart.reduce((s, i) => s + Number(i.unitPrice) * i.quantity, 0)

  // Auto-apply: ONLY discounts that have a minimum amount set AND subtotal meets it
  // Discounts with minimumPurchaseAmount = 0 are manual-only (shown as chips)
  const autoDiscount = subtotal > 0
    ? discounts
        .filter(d => Number(d.minimumPurchaseAmount) > 0 && subtotal >= Number(d.minimumPurchaseAmount))
        .sort((a, b) => parseFloat(b.percentage) - parseFloat(a.percentage))[0] || null
    : null

  // Priority: manual selection > typed % > auto-applied
  const activeDiscountPct = selectedDiscount
    ? parseFloat(selectedDiscount.percentage)
    : discountPercent
      ? parseFloat(discountPercent) || 0
      : autoDiscount ? parseFloat(autoDiscount.percentage) : 0

  const discountAmount = parseFloat((subtotal * activeDiscountPct / 100).toFixed(2))
  const total          = parseFloat((subtotal - discountAmount).toFixed(2))
  const paidNum        = parseFloat(amountPaid) || 0
  const balance        = parseFloat((paidNum - total).toFixed(2))

  const applyPreset = (d) => {
    if (selectedDiscount?.id === d.id) {
      setSelectedDiscount(null)
    } else {
      setSelectedDiscount(d)
      setDiscountPercent('')
    }
  }

  const handleGenerate = async () => {
    if (cart.length === 0) { toast.error('Add at least one product'); return }
    setSaving(true)
    try {
      const res = await invoiceAPI.create({
        customerId: selectedCustomer?.id || null,
        items: cart.map(i => ({ productId: i.productId, quantity: i.quantity })),
        discountPercentage: activeDiscountPct,
        notes,
      })
      setInvoice(res.data.data)
      toast.success('Invoice generated!')
      setCart([]); setSelectedCustomer(null)
      setDiscountPercent(''); setSelectedDiscount(null); setNotes(''); setAmountPaid('')
      invoiceAPI.getAll().then(r => setInvoices(r.data.data)).catch(() => {})
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to generate invoice')
    } finally { setSaving(false) }
  }

  const handlePrint = useReactToPrint({ content: () => printRef.current })

  return (
    <div className="billing animate-fade-in">
      {/* Tabs */}
      <div className="billing-tabs">
        <button className={`billing-tab ${tab==='new'?'active':''}`} onClick={() => setTab('new')}>New Invoice</button>
        <button className={`billing-tab ${tab==='history'?'active':''}`} onClick={() => setTab('history')}>Invoice History ({invoices.length})</button>
      </div>

      {tab === 'new' && (
        <div className="billing-grid">
          {/* Left: Product selection */}
          <div className="billing-left">
            <div className="card" style={{ marginBottom:16 }}>
              <h3 style={{ fontWeight:700, marginBottom:12 }}>🔍 Select Customer (Optional)</h3>
              <div className="search-bar" style={{ marginBottom:12 }}>
                <FiSearch style={{ color:'var(--gray)' }} />
                <input type="tel" placeholder="Search by phone number..." value={customerSearch} onChange={e => setCustomerSearch(e.target.value)} />
                {customerSearch && <button onClick={() => setCustomerSearch('')} style={{ background:'none',border:'none',cursor:'pointer' }}><FiX /></button>}
              </div>
              {selectedCustomer
                ? <div className="selected-customer">
                    <strong>{selectedCustomer.name}</strong>
                    <span>{selectedCustomer.phoneNumber}</span>
                    <button onClick={() => setSelectedCustomer(null)} style={{ background:'none',border:'none',cursor:'pointer',color:'var(--danger)' }}><FiX /></button>
                  </div>
                : customerSearch && filteredCustomers.slice(0,5).map(c => (
                    <div key={c.id} className="customer-option" onClick={() => { setSelectedCustomer(c); setCustomerSearch('') }}>
                      <strong>{c.phoneNumber}</strong> <span>{c.name}</span>
                    </div>
                  ))
              }
            </div>

            <div className="card">
              <h3 style={{ fontWeight:700, marginBottom:12 }}>📦 Products</h3>
              <div className="search-bar" style={{ marginBottom:12 }}>
                <FiSearch style={{ color:'var(--gray)' }} />
                <input placeholder="Search products..." value={productSearch} onChange={e => setProductSearch(e.target.value)} />
              </div>
              <div className="products-list">
                {filteredProducts.map(p => (
                  <div key={p.id} className={`product-item ${p.currentStock === 0 ? 'product-item--oos' : ''}`}>
                    <div className="product-item__info">
                      <strong>{p.name}</strong>
                      <span className="badge badge-primary">{p.category}</span>
                    </div>
                    <div className="product-item__right">
                      <span className="product-item__price">₹{Number(p.sellingPrice).toLocaleString('en-IN')}</span>
                      <span className={`badge ${p.currentStock > 0 ? 'badge-success' : 'badge-danger'}`}>{p.currentStock} left</span>
                      <button className="btn btn-primary btn-sm" disabled={p.currentStock === 0} onClick={() => addToCart(p)}><FiPlus /></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right: Cart + Invoice */}
          <div className="billing-right">
            <div className="card">
              <h3 style={{ fontWeight:700, marginBottom:16 }}>🛒 Cart</h3>
              {cart.length === 0
                ? <div className="empty-state" style={{ padding:'30px 0' }}><p>Add products to cart</p></div>
                : <>
                    <div className="cart-items">
                      {cart.map(item => (
                        <div key={item.productId} className="cart-item">
                          <div className="cart-item__name"><strong>{item.name}</strong><small>₹{item.unitPrice} each</small></div>
                          <div className="cart-item__controls">
                            <button className="qty-btn" onClick={() => updateQty(item.productId, item.quantity-1)} disabled={item.quantity<=1}>−</button>
                            <input type="number" className="qty-input" value={item.quantity} min={1} max={item.maxQty}
                              onChange={e => updateQty(item.productId, parseInt(e.target.value)||1)} />
                            <button className="qty-btn" onClick={() => updateQty(item.productId, item.quantity+1)} disabled={item.quantity>=item.maxQty}>+</button>
                          </div>
                          <div className="cart-item__total">₹{(item.unitPrice * item.quantity).toLocaleString('en-IN')}</div>
                          <button className="btn-icon btn-icon-delete btn-sm" onClick={() => removeItem(item.productId)}><FiTrash2 /></button>
                        </div>
                      ))}
                    </div>

                    <div className="invoice-summary">
                      <div className="summary-row"><span>Subtotal</span><strong>₹{subtotal.toLocaleString('en-IN')}</strong></div>

                      {/* Auto-applied discount banner */}
                      {autoDiscount && !selectedDiscount && !discountPercent && (
                        <div style={{ background:'#f0fdf4', border:'1px solid #bbf7d0', borderRadius:10,
                          padding:'8px 12px', fontSize:13, color:'#166534',
                          display:'flex', alignItems:'center', gap:8 }}>
                          <span>🎉</span>
                          <span>
                            <strong>{autoDiscount.name} ({autoDiscount.percentage}%)</strong> auto-applied!
                            <span style={{ fontSize:11, color:'#166534', opacity:0.7, marginLeft:4 }}>
                              (Min ₹{Number(autoDiscount.minimumPurchaseAmount).toLocaleString('en-IN')})
                            </span>
                          </span>
                        </div>
                      )}

                      {/* Hint — closest unmet discount */}
                      {!autoDiscount && discounts
                        .filter(d => Number(d.minimumPurchaseAmount) > 0 && subtotal < Number(d.minimumPurchaseAmount))
                        .sort((a, b) => Number(a.minimumPurchaseAmount) - Number(b.minimumPurchaseAmount))
                        .slice(0, 1).map(d => (
                          <div key={d.id} style={{ background:'#fefce8', border:'1px solid #fde68a',
                            borderRadius:10, padding:'8px 12px', fontSize:12, color:'#854d0e',
                            display:'flex', alignItems:'center', gap:8 }}>
                            <span>💡</span>
                            <span>
                              Add ₹{(Number(d.minimumPurchaseAmount) - subtotal).toLocaleString('en-IN')} more
                              to get <strong>{d.name} ({d.percentage}% off)</strong>
                            </span>
                          </div>
                        ))
                      }

                      {/* Discount chips — show ALL active discounts */}
                      {discounts.length > 0 && (
                        <div>
                          <span style={{ fontSize:12, color:'var(--gray)', fontWeight:600 }}>Available Discounts:</span>
                          <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginTop:6 }}>
                            {discounts.map(d => {
                              const minAmt   = Number(d.minimumPurchaseAmount)
                              const eligible = minAmt === 0 || subtotal >= minAmt
                              const isActive = selectedDiscount?.id === d.id ||
                                (autoDiscount?.id === d.id && !selectedDiscount && !discountPercent)
                              return (
                                <button
                                  key={d.id}
                                  onClick={() => eligible ? applyPreset(d) : null}
                                  title={!eligible ? `Min purchase ₹${minAmt.toLocaleString('en-IN')} required` : ''}
                                  style={{
                                    padding:'4px 12px', borderRadius:20, fontSize:12, fontWeight:700,
                                    cursor: eligible ? 'pointer' : 'not-allowed',
                                    fontFamily:'inherit', transition:'all 0.2s',
                                    opacity: eligible ? 1 : 0.45,
                                    border: isActive ? '2px solid var(--primary)' : '2px solid var(--border)',
                                    background: isActive ? 'var(--primary)' : 'white',
                                    color: isActive ? 'white' : 'var(--primary)',
                                  }}
                                >
                                  <FiPercent size={10} style={{ marginRight:3 }} />
                                  {d.name} ({d.percentage}%)
                                  {minAmt > 0 && (
                                    <span style={{ fontSize:10, marginLeft:4, opacity:0.8 }}>
                                      {eligible ? '✓' : `min ₹${minAmt.toLocaleString('en-IN')}`}
                                    </span>
                                  )}
                                </button>
                              )
                            })}
                          </div>
                        </div>
                      )}

                      {/* Manual discount input */}
                      <div className="summary-row">
                        <span>Discount (%)</span>
                        <input
                          type="number"
                          className="discount-input"
                          min={0} max={100} step={0.1}
                          value={selectedDiscount
                            ? selectedDiscount.percentage
                            : autoDiscount && !discountPercent
                              ? autoDiscount.percentage
                              : discountPercent}
                          disabled={!!selectedDiscount || (!!autoDiscount && !discountPercent)}
                          onChange={e => {
                            setSelectedDiscount(null)
                            const v = parseFloat(e.target.value)
                            setDiscountPercent(isNaN(v) ? '' : Math.min(100, Math.max(0, v)))
                          }}
                          placeholder="0"
                          style={{ opacity: (selectedDiscount || (autoDiscount && !discountPercent)) ? 0.6 : 1 }}
                        />
                      </div>

                      {activeDiscountPct > 0 && (
                        <div className="summary-row" style={{ color:'var(--danger)' }}>
                          <span>Discount ({activeDiscountPct}%)</span>
                          <strong>−₹{discountAmount.toLocaleString('en-IN')}</strong>
                        </div>
                      )}

                      <div className="summary-row summary-total">
                        <span>Bill Total</span>
                        <strong>₹{total.toLocaleString('en-IN')}</strong>
                      </div>

                      {/* ── Amount Paid & Balance ── */}
                      <div style={{ borderTop:'2px dashed var(--border)', paddingTop:12, marginTop:4 }}>
                        <div className="summary-row">
                          <span style={{ fontWeight:700, color:'var(--dark)' }}>Amount Paid (₹)</span>
                          <input
                            type="number"
                            className="discount-input"
                            min={0} step={0.01}
                            value={amountPaid}
                            onChange={e => setAmountPaid(e.target.value)}
                            placeholder="0.00"
                            style={{ width:110, fontSize:15, fontWeight:700,
                              borderColor: paidNum > 0 && paidNum < total ? 'var(--danger)' : 'var(--border)' }}
                          />
                        </div>

                        {paidNum > 0 && (
                          <div style={{
                            display:'flex', justifyContent:'space-between', alignItems:'center',
                            background: balance >= 0 ? '#f0fdf4' : '#fff1f2',
                            border: `1px solid ${balance >= 0 ? '#bbf7d0' : '#fecdd3'}`,
                            borderRadius:10, padding:'10px 14px', marginTop:8
                          }}>
                            <span style={{ fontWeight:700, fontSize:14,
                              color: balance >= 0 ? '#166534' : '#9f1239' }}>
                              {balance >= 0 ? '💵 Change to Return' : '⚠ Amount Short'}
                            </span>
                            <strong style={{ fontSize:18,
                              color: balance >= 0 ? '#166534' : '#9f1239' }}>
                              ₹{Math.abs(balance).toLocaleString('en-IN')}
                            </strong>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="form-group" style={{ marginTop:12 }}>
                      <label className="form-label">Notes</label>
                      <textarea className="form-input" rows={2} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional notes..." />
                    </div>

                    <button className="btn btn-primary" style={{ width:'100%', justifyContent:'center' }} onClick={handleGenerate} disabled={saving}>
                      {saving ? <span className="btn-spinner" /> : '📄 Generate Invoice'}
                    </button>
                  </>
              }
            </div>
          </div>
        </div>
      )}

      {tab === 'history' && (
        <div className="card animate-fade-in">
          {invoices.length === 0
            ? <div className="empty-state"><h3>No invoices yet</h3></div>
            : <div className="table-container">
                <table>
                  <thead><tr><th>Invoice #</th><th>Customer</th><th>Items</th><th>Subtotal</th><th>Discount</th><th>Total</th><th>Date</th><th>Action</th></tr></thead>
                  <tbody>
                    {invoices.map(inv => (
                      <tr key={inv.id}>
                        <td><strong style={{ color:'var(--primary)' }}>{inv.invoiceNumber}</strong></td>
                        <td>{inv.customer?.name || <span className="badge badge-gray">Walk-in</span>}</td>
                        <td>{inv.items?.length} item(s)</td>
                        <td>₹{Number(inv.subtotal).toLocaleString('en-IN')}</td>
                        <td>{inv.discountPercentage > 0 ? <span className="badge badge-warning">{inv.discountPercentage}%</span> : '—'}</td>
                        <td><strong>₹{Number(inv.totalAmount).toLocaleString('en-IN')}</strong></td>
                        <td style={{ fontSize:12 }}>{new Date(inv.createdAt).toLocaleString('en-IN')}</td>
                        <td><button className="btn-icon btn-icon-edit" onClick={() => setInvoice(inv)} title="View"><FiEye /></button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
          }
        </div>
      )}

      {/* Invoice Modal */}
      {invoice && (
        <div className="modal-overlay">
          <div className="modal-box" style={{ maxWidth:600 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
              <h3 style={{ fontWeight:700, fontSize:18 }}>Invoice Preview</h3>
              <div style={{ display:'flex', gap:8 }}>
                <button className="btn btn-primary btn-sm" onClick={handlePrint}><FiPrinter /> Print</button>
                <button className="btn-icon" style={{ background:'#f3f4f6' }} onClick={() => setInvoice(null)}><FiX /></button>
              </div>
            </div>
            <div ref={printRef} className="invoice-print">
              <div className="invoice-print__header">
                <div className="invoice-print__logo">Smart Inventory</div>
                <div className="invoice-print__meta">
                  <strong>{invoice.invoiceNumber}</strong>
                  <span>{new Date(invoice.createdAt).toLocaleString('en-IN')}</span>
                </div>
              </div>
              {invoice.customer && (
                <div className="invoice-print__customer">
                  <strong>Bill To:</strong>
                  <span>{invoice.customer.name}</span>
                  {invoice.customer.phoneNumber && <span>{invoice.customer.phoneNumber}</span>}
                  {invoice.customer.address && <span>{invoice.customer.address}</span>}
                </div>
              )}
              <table className="invoice-print__table">
                <thead><tr><th>Product</th><th>Qty</th><th>Unit Price</th><th>Total</th></tr></thead>
                <tbody>
                  {invoice.items?.map((item, i) => (
                    <tr key={i}>
                      <td>{item.productName}</td>
                      <td>{item.quantity}</td>
                      <td>₹{Number(item.unitPrice).toLocaleString('en-IN')}</td>
                      <td>₹{Number(item.totalPrice).toLocaleString('en-IN')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="invoice-print__totals">
                <div className="invoice-print__total-row"><span>Subtotal</span><strong>₹{Number(invoice.subtotal).toLocaleString('en-IN')}</strong></div>
                {invoice.discountPercentage > 0 && (
                  <div className="invoice-print__total-row">
                    <span>Discount ({Number(invoice.discountPercentage).toFixed(2)}%)</span>
                    <strong style={{ color:'red' }}>−₹{Number(invoice.discountAmount).toLocaleString('en-IN')}</strong>
                  </div>
                )}
                <div className="invoice-print__total-row invoice-print__total-row--final">
                  <span>Total Amount</span>
                  <strong>₹{Number(invoice.totalAmount).toLocaleString('en-IN')}</strong>
                </div>
                {paidNum > 0 && (
                  <>
                    <div className="invoice-print__total-row">
                      <span>Amount Paid</span>
                      <strong>₹{paidNum.toLocaleString('en-IN')}</strong>
                    </div>
                    <div className="invoice-print__total-row" style={{ color: balance >= 0 ? 'green' : 'red' }}>
                      <span>{balance >= 0 ? 'Change Returned' : 'Balance Due'}</span>
                      <strong>₹{Math.abs(balance).toLocaleString('en-IN')}</strong>
                    </div>
                  </>
                )}
              </div>
              {invoice.notes && <p style={{ marginTop:12, fontSize:13, color:'#666' }}>Notes: {invoice.notes}</p>}
              <p style={{ textAlign:'center', marginTop:16, fontSize:12, color:'#999' }}>Thank you for your business!</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
