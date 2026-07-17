import React, { useEffect, useState, useRef } from 'react'
import { productAPI, customerAPI, invoiceAPI, discountAPI, barcodeAPI } from '../services/api'
import toast from 'react-hot-toast'
import { useReactToPrint } from 'react-to-print'
import { Plus, Trash2, Search, Printer, X, Eye, Percent, Camera, ScanLine } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import './Billing.css'

export default function Billing() {
  const { role, user, activeBranchId } = useAuth()

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
  const [paymentMethod, setPaymentMethod] = useState('Cash')
  const [amountPaid, setAmountPaid]   = useState('')
  const [saving, setSaving]           = useState(false)
  const [invoice, setInvoice]         = useState(null)
  const [invoices, setInvoices]       = useState([])
  const [tab, setTab]                 = useState('new')
  const [filterStaff, setFilterStaff] = useState('')
  const [filterDate, setFilterDate]   = useState('')
  const [filterPayment, setFilterPayment] = useState('')
  const printRef                      = useRef()

  useEffect(() => {
    if (role === 'STAFF' && !user?.billingPermission) return
    setProducts([])
    setCustomers([])
    setInvoices([])
    setDiscounts([])
    setCart([])
    setSelectedCustomer(null)
    productAPI.getAll().then(r => setProducts(r.data.data)).catch(() => {})
    customerAPI.getAll().then(r => setCustomers(r.data.data)).catch(() => {})
    invoiceAPI.getAll().then(r => setInvoices(r.data.data)).catch(() => {})
    discountAPI.getActive().then(r => setDiscounts(r.data.data)).catch(() => {})
  }, [role, user, activeBranchId])

  if (role === 'STAFF' && !user?.billingPermission) {
    return (
      <div className="card animate-fade-in" style={{ padding: 40, textAlign: 'center', marginTop: 80, maxWidth: 500, marginLeft: 'auto', marginRight: 'auto' }}>
        <h3 style={{ color: 'var(--err)', marginBottom: 12, fontSize: 20, fontWeight: 700 }}>Access Denied</h3>
        <p style={{ color: 'var(--text-2)', fontSize: 15, lineHeight: 1.5 }}>
          You are logged in successfully, but you do not have billing permission. Please contact the Owner.
        </p>
      </div>
    )
  }

  const [scanning, setScanning] = useState(false)
  const [barcodeIndicator, setBarcodeIndicator] = useState('')
  const videoRef = useRef(null)
  const readerRef = useRef(null)
  const controlsRef = useRef(null)
  const lastScannedBarcodeRef = useRef('')
  const lastScanTimeRef = useRef(0)

  // Debug Panel States
  const [debugCamStatus, setDebugCamStatus] = useState('Off')
  const [debugReaderStatus, setDebugReaderStatus] = useState('Idle')
  const [debugFramesCount, setDebugFramesCount] = useState(0)
  const [debugDetected, setDebugDetected] = useState('No')
  const [debugLastBarcode, setDebugLastBarcode] = useState('')
  const [debugLookupStatus, setDebugLookupStatus] = useState('Idle')
  const [debugProductLoaded, setDebugProductLoaded] = useState('None')
  const [debugBillingStatus, setDebugBillingStatus] = useState('Idle')

  const playBeep = () => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1000, ctx.currentTime);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.2);
    } catch (e) {
      console.error('Beep failed', e);
    }
  }

  const startScanning = async () => {
    try {
      const { BrowserMultiFormatReader } = await import('@zxing/browser')
      const { DecodeHintType, BarcodeFormat } = await import('@zxing/library')

      console.log('Scanner Started')
      setDebugCamStatus('Initializing')
      setDebugReaderStatus('Initializing')
      setDebugFramesCount(0)
      setDebugDetected('No')
      setDebugLastBarcode('')
      setDebugLookupStatus('Idle')
      setDebugProductLoaded('None')
      setDebugBillingStatus('Idle')

      const hints = new Map()
      hints.set(DecodeHintType.POSSIBLE_FORMATS, [
        BarcodeFormat.EAN_13,
        BarcodeFormat.EAN_8,
        BarcodeFormat.UPC_A,
        BarcodeFormat.UPC_E,
        BarcodeFormat.CODE_128,
        BarcodeFormat.CODE_39,
        BarcodeFormat.ITF
      ])
      hints.set(DecodeHintType.TRY_HARDER, true)

      const reader = new BrowserMultiFormatReader(hints)
      readerRef.current = reader

      setScanning(true)
      setBarcodeIndicator('🔍 Scanning...')
      toast.success('Camera started — point at a barcode')

      // Wait for the video element to be ready
      await new Promise(resolve => setTimeout(resolve, 300))
      if (!videoRef.current) {
        toast.error('Video element not ready')
        setScanning(false)
        setDebugCamStatus('Error')
        setDebugReaderStatus('Stopped')
        return
      }

      console.log('Camera Ready')
      console.log('Waiting for Barcode')
      setDebugCamStatus('Active')
      setDebugReaderStatus('Scanning')

      const constraints = {
        video: {
          facingMode: 'environment',
          width: { min: 640, ideal: 1280, max: 1920 },
          height: { min: 480, ideal: 720, max: 1080 },
          focusMode: 'continuous'
        },
        audio: false
      }

      // Use ONLY decodeFromConstraints for optimal quality and continuous scan
      const controls = await reader.decodeFromConstraints(
        constraints,
        videoRef.current,
        async (result, error) => {
          console.log('Frame Received')
          setDebugFramesCount(c => {
            const next = c + 1
            if (next % 25 === 0) {
              const warnings = [
                '🔍 Move Closer',
                '🔍 Improve Lighting',
                '🔍 Hold Camera Steady',
                '🔍 Barcode Too Small'
              ]
              const idx = Math.floor((next / 25) % warnings.length)
              setBarcodeIndicator(warnings[idx])
            }
            return next
          })

          if (result) {
            const code = result.getText()
            console.log('Barcode Detected')
            console.log('Decoded Value:', code)
            
            setBarcodeIndicator('✅ Scanned: ' + code)
            setDebugDetected('Yes')
            setDebugLastBarcode(code)

            // Prevent duplicate scans using a simple debounce (ignore same barcode for 2 seconds)
            const now = Date.now()
            if (code && lastScannedBarcodeRef.current === code && now - lastScanTimeRef.current < 2000) {
              return
            }
            lastScannedBarcodeRef.current = code
            lastScanTimeRef.current = now

            playBeep()

            console.log('Lookup Started', { url: `/api/barcode/lookup/${code}?action=BILLING`, barcode: code })
            setDebugLookupStatus('Requesting')

            try {
              const res = await barcodeAPI.lookup(code, 'BILLING')
              console.log('Lookup Success', {
                barcode: code,
                status: res.status,
                responseBody: res.data
              })
              setDebugLookupStatus('Success')

              const data = res.data?.data
              if (res.data?.success && data && data.productFound) {
                // Check expiry
                if (data.expiryStatus === 'EXPIRED') {
                  console.log('Lookup Failed: Barcode is expired.')
                  toast.error('Barcode is expired.')
                  setDebugLookupStatus('Failed (Expired)')
                  return
                }

                const product = {
                  id: data.productId,
                  name: data.productName,
                  category: data.category,
                  currentStock: data.currentStock,
                  sellingPrice: data.sellingPrice,
                  status: data.expiryStatus === 'EXPIRED' ? 'Expired' : 'Active',
                }
                scanAddProduct(product, code)
                console.log('Product Added')
                console.log('Billing Updated')
                setDebugProductLoaded(product.name)
                setDebugBillingStatus('Updated')
              } else {
                const msg = res.data?.message || 'No product with this barcode exists.'
                console.log('Lookup Failed:', msg)
                setDebugLookupStatus('Failed: ' + msg)
                if (msg.includes('branch')) {
                  toast.error('Barcode belongs to another branch.')
                } else if (msg.includes('owner')) {
                  toast.error('Barcode belongs to another owner.')
                } else {
                  toast.error('Product not found in this branch.')
                }
              }
            } catch (err) {
              const status = err.response?.status
              const errMsg = err.response?.data?.message || err.message
              console.error('Lookup Error:', {
                barcode: code,
                status: status,
                error: errMsg
              })
              setDebugLookupStatus('Failed: ' + errMsg)

              if (status === 403 || status === 401) {
                toast.error('User has no permission.')
              } else if (errMsg.includes('branch')) {
                toast.error('Barcode belongs to another branch.')
              } else if (errMsg.includes('owner')) {
                toast.error('Barcode belongs to another owner.')
              } else if (errMsg.includes('expired')) {
                toast.error('Barcode is expired.')
              } else if (errMsg.includes('inactive')) {
                toast.error('Barcode is inactive.')
              } else {
                toast.error(errMsg || 'Lookup failed')
              }
            }
          }
        }
      )

      controlsRef.current = controls

    } catch (err) {
      console.error('[ZXing] Camera error:', err)
      toast.error('Could not access camera: ' + err.message)
      setScanning(false)
      setDebugCamStatus('Error')
      setDebugReaderStatus('Stopped')
    }
  }

  const stopScanning = () => {
    if (controlsRef.current) {
      controlsRef.current.stop()
      controlsRef.current = null
    }
    setScanning(false)
    setBarcodeIndicator('')
    toast.success('Camera stopped')
    console.log('[ZXing] Scanning stopped')
    setDebugCamStatus('Off')
    setDebugReaderStatus('Idle')
  }

  useEffect(() => {
    return () => {
      if (controlsRef.current) {
        controlsRef.current.stop()
      }
    }
  }, [])

  const filteredProducts  = products.filter(p => 
    p.name.toLowerCase().includes(productSearch.toLowerCase()) || 
    p.category.toLowerCase().includes(productSearch.toLowerCase()) ||
    (p.barcode && p.barcode.includes(productSearch))
  )
  const filteredCustomers = customers.filter(c => (c.phoneNumber||'').includes(customerSearch))

  const scanAddProduct = (product, barcode) => {
    // 1. Expired check
    const category = product.category ? product.category.trim().toLowerCase() : "";
    const noDateCats = ["dress", "clothing", "boxes", "plastic products", "stationery", "furniture", "dresses", "box", "plastic"];
    const checkExpiry = !noDateCats.includes(category);
    if (checkExpiry && (product.status || "").toLowerCase() === 'expired') {
      toast.error("This product has expired and cannot be billed.");
      return;
    }

    // 2. Out of stock check
    if (product.currentStock <= 0) {
      toast.error("Product is currently out of stock.");
      return;
    }

    setCart(prev => {
      const existing = prev.find(i => i.productId === product.id)
      if (existing) {
        if (existing.quantity >= product.currentStock) {
          toast.error("Insufficient stock for: " + product.name);
          return prev;
        }
        playBeep();
        toast.success(`Increased quantity of ${product.name}`);
        return prev.map(i => i.productId === product.id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      playBeep();
      toast.success(`Added ${product.name} to cart`);
      return [...prev, {
        productId: product.id,
        name: product.name,
        unitPrice: Number(product.sellingPrice),
        quantity: 1,
        maxQty: product.currentStock
      }];
    });
  }

  const addToCart = (product) => {
    // 1. Expired check
    const category = product.category ? product.category.trim().toLowerCase() : "";
    const noDateCats = ["dress", "clothing", "boxes", "plastic products", "stationery", "furniture", "dresses", "box", "plastic"];
    const checkExpiry = !noDateCats.includes(category);
    if (checkExpiry && (product.status || "").toLowerCase() === 'expired') {
      toast.error("This product has expired and cannot be billed.");
      return;
    }

    // 2. Out of stock check
    if (product.currentStock <= 0) {
      toast.error("Product is currently out of stock.");
      return;
    }

    setCart(prev => {
      const existing = prev.find(i => i.productId === product.id)
      if (existing) {
        if (existing.quantity >= product.currentStock) {
          toast.error("Insufficient stock for: " + product.name);
          return prev;
        }
        return prev.map(i => i.productId === product.id ? { ...i, quantity: i.quantity + 1 } : i)
      }
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
        paymentMethod,
      })
      setInvoice(res.data.data)
      toast.success('Invoice generated!')
      setCart([]); setSelectedCustomer(null)
      setDiscountPercent(''); setSelectedDiscount(null); setNotes(''); setAmountPaid(''); setPaymentMethod('Cash')
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
              <h3 style={{ fontWeight:600, marginBottom:12, fontSize:15 }}>Select Customer <span style={{ color:'var(--text-4)', fontWeight:400, fontSize:13 }}>(Optional)</span></h3>
              <div className="search-bar" style={{ marginBottom:12 }}>
                <Search size={15} strokeWidth={1.75} />
                <input type="tel" placeholder="Search by phone number..." value={customerSearch} onChange={e => setCustomerSearch(e.target.value)} />
                {customerSearch && <button onClick={() => setCustomerSearch('')} style={{ background:'none',border:'none',cursor:'pointer',display:'flex',color:'var(--text-4)' }}><X size={14} /></button>}
              </div>
              {selectedCustomer
                ? <div className="selected-customer">
                    <strong>{selectedCustomer.name}</strong>
                    <span>{selectedCustomer.phoneNumber}</span>
                    <button onClick={() => setSelectedCustomer(null)} style={{ background:'none',border:'none',cursor:'pointer',color:'var(--err)',display:'flex' }}><X size={15} strokeWidth={2} /></button>
                  </div>
                : customerSearch && filteredCustomers.slice(0,5).map(c => (
                    <div key={c.id} className="customer-option" onClick={() => { setSelectedCustomer(c); setCustomerSearch('') }}>
                      <strong>{c.phoneNumber}</strong> <span>{c.name}</span>
                    </div>
                  ))
              }
            </div>

            {/* Barcode Camera Scanner */}
            <div className="card" style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h3 style={{ fontWeight: 600, fontSize: 15, margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <ScanLine size={16} style={{ color: 'var(--accent)' }} />
                  Barcode Scanner
                </h3>
                {scanning ? (
                  <button type="button" className="btn btn-secondary btn-sm" onClick={stopScanning} style={{ borderColor: 'var(--err)', color: 'var(--err)' }}>
                    Stop Scanning
                  </button>
                ) : (
                  <button type="button" className="btn btn-primary btn-sm" onClick={startScanning}>
                    <Camera size={14} /> Scan Products
                  </button>
                )}
              </div>

              {scanning && (
                <div style={{ position: 'relative', borderRadius: 'var(--r-md)', overflow: 'hidden', background: '#000', aspectRatio: '16/9', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
                  <video ref={videoRef} autoPlay playsInline muted style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                  
                  {/* Green scanning rectangle overlay - center 50% */}
                  <div style={{
                    position: 'absolute',
                    top: '25%', left: '25%',
                    width: '50%', height: '50%',
                    border: '2.5px solid #00ff88',
                    borderRadius: 8,
                    boxShadow: '0 0 0 9999px rgba(0,0,0,0.35)',
                    pointerEvents: 'none',
                    zIndex: 2
                  }}>
                    {/* Corner markers */}
                    <div style={{ position:'absolute', top:-1, left:-1, width:20, height:20, borderTop:'3px solid #00ff88', borderLeft:'3px solid #00ff88', borderRadius:'6px 0 0 0' }} />
                    <div style={{ position:'absolute', top:-1, right:-1, width:20, height:20, borderTop:'3px solid #00ff88', borderRight:'3px solid #00ff88', borderRadius:'0 6px 0 0' }} />
                    <div style={{ position:'absolute', bottom:-1, left:-1, width:20, height:20, borderBottom:'3px solid #00ff88', borderLeft:'3px solid #00ff88', borderRadius:'0 0 0 6px' }} />
                    <div style={{ position:'absolute', bottom:-1, right:-1, width:20, height:20, borderBottom:'3px solid #00ff88', borderRight:'3px solid #00ff88', borderRadius:'0 0 6px 0' }} />
                    
                    {/* Animated scan line */}
                    <div style={{
                      position: 'absolute', left: 4, right: 4,
                      height: 2,
                      background: 'linear-gradient(90deg, transparent, #00ff88, transparent)',
                      animation: 'scanline 2s ease-in-out infinite',
                      boxShadow: '0 0 8px #00ff88'
                    }} />
                  </div>

                  {barcodeIndicator && (
                    <div style={{ position: 'absolute', bottom: 10, left: 10, right: 10, padding: '8px 14px', background: 'rgba(0,0,0,0.8)', color: '#fff', fontSize: 13, borderRadius: 6, textAlign: 'center', fontWeight: 600, zIndex: 3, backdropFilter: 'blur(4px)' }}>
                      {barcodeIndicator}
                    </div>
                  )}
                </div>
              )}

              {scanning && (
                <div style={{
                  marginTop: 10,
                  padding: 12,
                  background: 'rgba(0,0,0,0.85)',
                  color: '#00ff88',
                  borderRadius: 8,
                  fontSize: 11,
                  fontFamily: 'monospace',
                  lineHeight: 1.4,
                  border: '1px solid #00ff88',
                  zIndex: 4
                }}>
                  <div style={{ fontWeight: 'bold', borderBottom: '1px solid #333', paddingBottom: 4, marginBottom: 6, display: 'flex', justifyContent: 'space-between' }}>
                    <span>🛠️ ZXING DEBUG PANEL</span>
                    <span style={{ color: '#aaa', fontSize: 9 }}>v1.0.0</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '4px 12px' }}>
                    <div>Camera Status: <span style={{ color: '#fff' }}>{debugCamStatus}</span></div>
                    <div>Reader Status: <span style={{ color: '#fff' }}>{debugReaderStatus}</span></div>
                    <div>Frames Received: <span style={{ color: '#fff' }}>{debugFramesCount}</span></div>
                    <div>Barcode Detected: <span style={{ color: '#fff' }}>{debugDetected}</span></div>
                    <div style={{ gridColumn: '1 / -1' }}>Last Barcode: <span style={{ color: '#fff' }}>{debugLastBarcode || 'None'}</span></div>
                    <div>Lookup Status: <span style={{ color: '#fff' }}>{debugLookupStatus}</span></div>
                    <div>Billing Status: <span style={{ color: '#fff' }}>{debugBillingStatus}</span></div>
                    <div style={{ gridColumn: '1 / -1' }}>Product Loaded: <span style={{ color: '#fff' }}>{debugProductLoaded}</span></div>
                  </div>
                </div>
              )}
              
              {!scanning && (
                <p style={{ fontSize: 12.5, color: 'var(--text-3)', margin: 0 }}>
                  Click "Scan Products" to start scanning barcodes using the camera. Manual search below is always available.
                </p>
              )}
            </div>

            <div className="card">
              <h3 style={{ fontWeight:600, marginBottom:12, fontSize:15 }}>Products</h3>
              <div className="search-bar" style={{ marginBottom:12 }}>
                <Search size={15} strokeWidth={1.75} />
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
                      <button className="btn btn-primary btn-sm" disabled={p.currentStock === 0} onClick={() => addToCart(p)}><Plus size={14} strokeWidth={2} /></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right: Cart + Invoice */}
          <div className="billing-right">
            <div className="card">
              <h3 style={{ fontWeight:600, marginBottom:16, fontSize:15 }}>Cart</h3>
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
                          <button className="btn-icon btn-icon-delete btn-sm" onClick={() => removeItem(item.productId)}><Trash2 size={13} strokeWidth={1.75} /></button>
                        </div>
                      ))}
                    </div>

                    <div className="invoice-summary">
                      <div className="summary-row"><span>Subtotal</span><strong>₹{subtotal.toLocaleString('en-IN')}</strong></div>

                      {autoDiscount && !selectedDiscount && !discountPercent && (
                        <div className="auto-discount-banner">
                          <span>🎉</span>
                          <span>
                            <strong>{autoDiscount.name} ({autoDiscount.percentage}%)</strong> auto-applied!
                            <span style={{ fontSize:11, opacity:0.75, marginLeft:4 }}>
                              (Min ₹{Number(autoDiscount.minimumPurchaseAmount).toLocaleString('en-IN')})
                            </span>
                          </span>
                        </div>
                      )}

                      {!autoDiscount && discounts
                        .filter(d => Number(d.minimumPurchaseAmount) > 0 && subtotal < Number(d.minimumPurchaseAmount))
                        .sort((a, b) => Number(a.minimumPurchaseAmount) - Number(b.minimumPurchaseAmount))
                        .slice(0, 1).map(d => (
                          <div key={d.id} className="discount-hint-banner">
                            <span>💡</span>
                            <span>
                              Add ₹{(Number(d.minimumPurchaseAmount) - subtotal).toLocaleString('en-IN')} more
                              to get <strong>{d.name} ({d.percentage}% off)</strong>
                            </span>
                          </div>
                        ))
                      }

                      {discounts.length > 0 && (
                        <div>
                          <span style={{ fontSize:12, color:'var(--text-3)', fontWeight:600 }}>Available Discounts:</span>
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
                                    display:'inline-flex', alignItems:'center', gap:4,
                                    padding:'4px 12px', borderRadius:'var(--r-pill)', fontSize:12, fontWeight:600,
                                    cursor: eligible ? 'pointer' : 'not-allowed',
                                    fontFamily:'inherit', transition:'all 0.18s ease',
                                    opacity: eligible ? 1 : 0.45,
                                    border: isActive ? '1.5px solid var(--accent)' : '1.5px solid var(--border)',
                                    background: isActive ? 'var(--accent)' : 'var(--surface)',
                                    color: isActive ? '#fff' : 'var(--accent)',
                                  }}
                                >
                                  <Percent size={9} strokeWidth={2.5} />
                                  {d.name} ({d.percentage}%)
                                  {minAmt > 0 && (
                                    <span style={{ fontSize:10, marginLeft:3, opacity:0.8 }}>
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
                          <div className={`balance-row ${balance >= 0 ? 'balance-row--ok' : 'balance-row--err'}`}>
                            <span className="balance-row__label">
                              {balance >= 0 ? '💵 Change to Return' : '⚠ Amount Short'}
                            </span>
                            <strong className="balance-row__amount">
                              ₹{Math.abs(balance).toLocaleString('en-IN')}
                            </strong>
                          </div>
                        )}
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label">Payment Method</label>
                        <select className="form-input" value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}>
                          <option value="Cash">Cash</option>
                          <option value="UPI">UPI</option>
                          <option value="Card">Card</option>
                        </select>
                      </div>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label">Notes</label>
                        <input className="form-input" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional notes" />
                      </div>
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

      {tab === 'history' && (() => {
        const filteredInvoices = invoices.filter(inv => {
          if (filterStaff === 'Owner') {
            if (inv.createdByRole !== 'OWNER') return false
          } else if (filterStaff) {
            if (inv.createdByName !== filterStaff) return false
          }
          if (filterDate) {
            const invDate = new Date(inv.createdAt).toISOString().split('T')[0]
            if (invDate !== filterDate) return false
          }
          if (filterPayment) {
            if ((inv.paymentMethod || 'Cash').toLowerCase() !== filterPayment.toLowerCase()) return false
          }
          return true
        })

        return (
          <div className="card animate-fade-in">
            {role === 'ADMIN' && (
              <div style={{ display:'flex', gap:12, marginBottom:16, flexWrap:'wrap', alignItems:'center', background:'var(--slate-50)', padding:12, borderRadius:'var(--r-md)', border:'1px solid var(--border)' }}>
                <div className="form-group" style={{ margin:0, minWidth:160 }}>
                  <label className="form-label" style={{ fontSize:11, marginBottom:4 }}>Billed By</label>
                  <select className="form-input" style={{ padding: '5px 8px', height: 'auto', fontSize:13 }} value={filterStaff} onChange={e => setFilterStaff(e.target.value)}>
                    <option value="">All Creators</option>
                    <option value="Owner">Owner (Admin)</option>
                    {Array.from(new Set(invoices.map(i => i.createdByName).filter(Boolean))).map(name => (
                      <option key={name} value={name}>{name}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group" style={{ margin:0, minWidth:140 }}>
                  <label className="form-label" style={{ fontSize:11, marginBottom:4 }}>Payment Method</label>
                  <select className="form-input" style={{ padding: '5px 8px', height: 'auto', fontSize:13 }} value={filterPayment} onChange={e => setFilterPayment(e.target.value)}>
                    <option value="">All Payments</option>
                    <option value="Cash">Cash</option>
                    <option value="UPI">UPI</option>
                    <option value="Card">Card</option>
                  </select>
                </div>
                <div className="form-group" style={{ margin:0, minWidth:140 }}>
                  <label className="form-label" style={{ fontSize:11, marginBottom:4 }}>Billing Date</label>
                  <input type="date" className="form-input" style={{ padding: '4px 8px', height: 'auto', fontSize:13 }} value={filterDate} onChange={e => setFilterDate(e.target.value)} />
                </div>
                {(filterStaff || filterPayment || filterDate) && (
                  <button className="btn btn-secondary btn-sm" style={{ marginTop: 16 }} onClick={() => { setFilterStaff(''); setFilterPayment(''); setFilterDate('') }}>
                    Clear Filters
                  </button>
                )}
              </div>
            )}

            {filteredInvoices.length === 0
              ? <div className="empty-state"><h3>No matching invoices found</h3></div>
              : <div className="table-container">
                  <table>
                    <thead>
                      <tr>
                        <th>Invoice No</th>
                        <th>Customer</th>
                        <th>Total</th>
                        <th>Payment</th>
                        <th>Date</th>
                        <th>Created By</th>
                        <th>Role</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredInvoices.map(inv => (
                        <tr key={inv.id}>
                          <td><strong style={{ color:'var(--primary)' }}>{inv.invoiceNumber}</strong></td>
                          <td>{inv.customer?.name || <span className="badge badge-gray">Walk-in</span>}</td>
                          <td><strong>₹{Number(inv.totalAmount).toLocaleString('en-IN')}</strong></td>
                          <td><span className="badge badge-gray">{inv.paymentMethod || 'Cash'}</span></td>
                          <td style={{ fontSize:12 }}>{new Date(inv.createdAt).toLocaleDateString('en-IN')}</td>
                          <td><strong>{inv.createdByName || 'Owner'}</strong></td>
                          <td>
                            <span className={`badge ${inv.createdByRole === 'STAFF' ? 'badge-primary' : 'badge-success'}`}>
                              {inv.createdByRole || 'OWNER'}
                            </span>
                          </td>
                          <td><button className="btn-icon btn-icon-edit" onClick={() => setInvoice(inv)} title="View"><Eye size={14} strokeWidth={1.75} /></button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
            }
          </div>
        )
      })()}

      {/* Invoice Modal */}
      {invoice && (
        <div className="modal-overlay">
          <div className="modal-box" style={{ maxWidth:600 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
              <h3 style={{ fontWeight:700, fontSize:18 }}>Invoice Preview</h3>
              <div style={{ display:'flex', gap:8 }}>
                <button className="btn btn-primary btn-sm" onClick={handlePrint}><Printer size={14} strokeWidth={1.75} /> Print</button>
                <button className="btn-icon" style={{ background:'var(--slate-50)' }} onClick={() => setInvoice(null)}><X size={16} strokeWidth={1.75} /></button>
              </div>
            </div>
            <div ref={printRef} className="invoice-print">
              <div className="invoice-print__header">
                <div className="invoice-print__logo">Smart Inventory</div>
                <div className="invoice-print__meta">
                  <strong>{invoice.invoiceNumber}</strong>
                  <span>{new Date(invoice.createdAt).toLocaleString('en-IN')}</span>
                  <span style={{ fontSize:11, color:'var(--text-3)', display:'block' }}>Billed By: {invoice.createdByName || 'Owner'} ({invoice.createdByRole || 'OWNER'})</span>
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
                <div className="invoice-print__total-row">
                  <span>Payment Method</span>
                  <strong style={{ textTransform: 'uppercase' }}>{invoice.paymentMethod || 'Cash'}</strong>
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
