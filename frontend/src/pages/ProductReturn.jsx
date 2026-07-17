import React, { useState, useEffect, useRef } from 'react'
import { barcodeAPI } from '../services/api'
import BarcodeScanner from '../components/BarcodeScanner'
import toast from 'react-hot-toast'
import { Receipt, RefreshCcw, User, Truck, Camera, Trash2, Maximize2, X, Eye, Check, AlertTriangle, ArrowRight } from 'lucide-react'

export default function ProductReturn() {
  const [activeTab, setActiveTab] = useState('customer') // 'customer' or 'supplier'
  const [invoiceNumber, setInvoiceNumber] = useState('')
  const [barcode, setBarcode] = useState('')
  const [quantity, setQuantity] = useState(1)
  const [condition, setCondition] = useState('GOOD') // 'GOOD' or 'DAMAGED'
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [scannedProduct, setScannedProduct] = useState(null)
  const [invoiceProducts, setInvoiceProducts] = useState([])
  const [selectedProductBarcode, setSelectedProductBarcode] = useState('')
  const [loadingInvoice, setLoadingInvoice] = useState(false)

  // Damage Evidence States
  const [selectedFiles, setSelectedFiles] = useState([]) // Array of File objects
  const [isCameraOpen, setIsCameraOpen] = useState(false)
  const [cameraStream, setCameraStream] = useState(null)
  const videoRef = useRef(null)
  const fileInputRef = useRef(null)

  // Zoom Modal
  const [zoomedImage, setZoomedImage] = useState(null)

  // Return History
  const [returnsHistory, setReturnsHistory] = useState([])
  const [loadingHistory, setLoadingHistory] = useState(false)

  // Resolution States per request ID
  const [rejectionReasons, setRejectionReasons] = useState({}) // { id: String }
  const [activeResolutions, setActiveResolutions] = useState({}) // { id: 'REFUND' | 'EXCHANGE' }
  const [refundMethods, setRefundMethods] = useState({}) // { id: String }
  const [exchangeBarcodes, setExchangeBarcodes] = useState({}) // { id: String }
  const [exchangeQuantities, setExchangeQuantities] = useState({}) // { id: Number }
  const [showRejectForm, setShowRejectForm] = useState({}) // { id: Boolean }

  useEffect(() => {
    loadReturnsHistory()
  }, [])

  const loadReturnsHistory = async () => {
    setLoadingHistory(true)
    try {
      const res = await barcodeAPI.getOwnerReturns()
      setReturnsHistory(res.data?.data || [])
    } catch (error) {
      console.error('Failed to load return history:', error)
    } finally {
      setLoadingHistory(false)
    }
  }

  const loadInvoiceProducts = async () => {
    if (!invoiceNumber.trim()) return
    setLoadingInvoice(true)
    setInvoiceProducts([])
    setSelectedProductBarcode('')
    setScannedProduct(null)
    setBarcode('')
    try {
      const response = await barcodeAPI.getCustomerReturnProducts(invoiceNumber.trim())
      setInvoiceProducts(response.data?.data || [])
    } catch (error) {
      toast.error(error.response?.data?.message || 'Invoice not found.')
    } finally {
      setLoadingInvoice(false)
    }
  }

  const selectInvoiceProduct = (selectedBarcode) => {
    setSelectedProductBarcode(selectedBarcode)
    const product = invoiceProducts.find(item => item.barcode === selectedBarcode)
    if (!product) return
    setBarcode(selectedBarcode)
    setScannedProduct({
      ...product,
      currentStock: undefined,
      sellingPrice: undefined,
      expiryStatus: undefined,
    })
  }

  const handleBarcodeScan = async (code) => {
    const trimmedCode = code ? code.trim() : ''
    setBarcode(trimmedCode)
    try {
      const res = await barcodeAPI.lookup(trimmedCode, activeTab === 'customer' ? 'CUSTOMER_RETURN' : 'SUPPLIER_RETURN')
      const data = res.data.data
      if (data && data.productFound) {
        if (activeTab === 'customer' && !invoiceProducts.some(item => item.barcode === trimmedCode)) {
          toast.error('Product not found in invoice.')
          setScannedProduct(null)
          return
        }
        setSelectedProductBarcode(trimmedCode)
        setScannedProduct(data)
        toast.success(`Scanned: ${data.productName}`)
      } else {
        toast.error('Scanned product not found in database')
        setScannedProduct(null)
      }
    } catch (e) {
      toast.error('Failed to look up scanned product')
      setScannedProduct(null)
    }
  }

  const handleManualLookup = async (e) => {
    e.preventDefault()
    if (!barcode.trim()) return
    handleBarcodeScan(barcode.trim())
  }

  // Camera Handlers
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
      setCameraStream(stream)
      setIsCameraOpen(true)
      setTimeout(() => {
        if (videoRef.current) videoRef.current.srcObject = stream
      }, 100)
    } catch (err) {
      toast.error('Could not access laptop camera. Check permissions.')
    }
  }

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop())
    }
    setCameraStream(null)
    setIsCameraOpen(false)
  }

  const capturePhoto = () => {
    if (!videoRef.current) return
    if (selectedFiles.length >= 5) {
      toast.error('Maximum 5 images allowed')
      return
    }

    const canvas = document.createElement('canvas')
    canvas.width = videoRef.current.videoWidth || 640
    canvas.height = videoRef.current.videoHeight || 480
    const ctx = canvas.getContext('2d')
    ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height)

    canvas.toBlob((blob) => {
      if (blob) {
        const file = new File([blob], `captured-${Date.now()}.png`, { type: 'image/png' })
        setSelectedFiles(prev => [...prev, file])
        toast.success('Photo captured successfully!')
      }
    }, 'image/png')
  }

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files || [])
    const validFiles = []
    
    for (let file of files) {
      if (!['image/jpeg', 'image/jpg', 'image/png'].includes(file.type)) {
        toast.error(`${file.name} is not a valid image. Only JPG, JPEG, and PNG are allowed.`)
        continue
      }
      if (file.size > 5 * 1024 * 1024) {
        toast.error(`${file.name} exceeds the 5 MB size limit.`)
        continue
      }
      validFiles.push(file)
    }

    if (selectedFiles.length + validFiles.length > 5) {
      toast.error('Maximum 5 images allowed')
      return
    }

    setSelectedFiles(prev => [...prev, ...validFiles])
  }

  const removeFile = (index) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!barcode.trim()) {
      toast.error('Please scan or enter a barcode')
      return
    }
    if (quantity <= 0) {
      toast.error('Please enter a valid quantity')
      return
    }
    if (activeTab === 'customer' && !invoiceNumber.trim()) {
      toast.error('Invoice Number is required for customer returns')
      return
    }
    if (activeTab === 'customer' && !selectedProductBarcode) {
      toast.error('Select a product from the invoice')
      return
    }

    // Evidence image check: At least 1 is required for DAMAGED
    const isDamaged = (activeTab === 'supplier') || (activeTab === 'customer' && condition === 'DAMAGED')
    if (isDamaged) {
      if (selectedFiles.length === 0) {
        toast.error('At least one damage evidence image is required.')
        return
      }
      if (selectedFiles.length > 5) {
        toast.error('A maximum of 5 images can be uploaded.')
        return
      }
    }

    setLoading(true)
    try {
      if (activeTab === 'customer') {
        const formData = new FormData()
        formData.append('invoiceNumber', invoiceNumber.trim())
        formData.append('barcode', barcode.trim())
        formData.append('quantity', quantity)
        formData.append('condition', condition)
        formData.append('notes', notes)
        selectedFiles.forEach(file => {
          formData.append('files', file)
        })
        const res = await barcodeAPI.submitCustomerReturnRequest(formData)
        toast.success(res.data.message || 'Customer return request submitted!')
      } else {
        const formData = new FormData()
        formData.append('barcode', barcode.trim())
        formData.append('quantity', quantity)
        formData.append('notes', notes)
        selectedFiles.forEach(file => {
          formData.append('files', file)
        })
        const res = await barcodeAPI.processSupplierReturn(formData)
        toast.success(res.data.message || 'Supplier return request created and pending approval!')
      }
      // Reset form on success
      setBarcode('')
      setQuantity(1)
      setNotes('')
      setScannedProduct(null)
      setSelectedProductBarcode('')
      setSelectedFiles([])
      setCondition('GOOD')
      stopCamera()
      if (activeTab === 'customer') loadInvoiceProducts()
      loadReturnsHistory()
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || 'Processing return failed')
    } finally {
      setLoading(false)
    }
  }

  // Owner Action Handlers
  const handleApproveCustomerReturn = async (id) => {
    try {
      const res = await barcodeAPI.approveCustomerReturn(id)
      toast.success(res.data.message || 'Return request approved!')
      loadReturnsHistory()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Approval failed')
    }
  }

  const handleRejectCustomerReturn = async (id) => {
    const reason = rejectionReasons[id]
    if (!reason || !reason.trim()) {
      toast.error('Please specify a rejection reason.')
      return
    }
    try {
      const res = await barcodeAPI.rejectCustomerReturn(id, reason.trim())
      toast.success(res.data.message || 'Return request rejected.')
      loadReturnsHistory()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Rejection failed')
    }
  }

  const handleProcessRefund = async (id) => {
    const method = refundMethods[id] || 'CASH'
    try {
      const res = await barcodeAPI.processCustomerRefund(id, method)
      toast.success(res.data.message || 'Refund processed successfully!')
      loadReturnsHistory()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Refund processing failed')
    }
  }

  const handleProcessExchange = async (id) => {
    const exBarcode = exchangeBarcodes[id]
    const exQty = exchangeQuantities[id] || 1
    if (!exBarcode || !exBarcode.trim()) {
      toast.error('Please scan or specify exchange barcode.')
      return
    }
    try {
      const res = await barcodeAPI.processCustomerExchange(id, exBarcode.trim(), exQty)
      toast.success(res.data.message || 'Exchange processed successfully!')
      loadReturnsHistory()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Exchange processing failed')
    }
  }

  return (
    <div className="animate-fade-in" style={{ padding: '24px' }}>
      {/* Title */}
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-h)', margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
          <RefreshCcw style={{ color: 'var(--accent)' }} size={28} />
          Returns & Replacements Hub
        </h2>
        <p style={{ color: 'var(--text-3)', margin: '4px 0 0 0', fontSize: 14 }}>
          Manage customer and supplier return workflows with barcode verification, damage photo upload, and stock synchronization.
        </p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24, borderBottom: '1px solid var(--border)', paddingBottom: 8 }}>
        <button
          className={`btn ${activeTab === 'customer' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => { setActiveTab('customer'); setScannedProduct(null); setBarcode(''); setSelectedFiles([]); stopCamera(); }}
          style={{ display: 'flex', alignItems: 'center', gap: 8 }}
        >
          <User size={16} /> Customer Return
        </button>
        <button
          className={`btn ${activeTab === 'supplier' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => { setActiveTab('supplier'); setScannedProduct(null); setBarcode(''); setInvoiceProducts([]); setSelectedProductBarcode(''); setSelectedFiles([]); }}
          style={{ display: 'flex', alignItems: 'center', gap: 8 }}
        >
          <Truck size={16} /> Supplier Return (Damage/Refund)
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {/* Left Side: Scanner */}
        <div>
          <BarcodeScanner onScan={handleBarcodeScan} action={activeTab === 'customer' ? 'CUSTOMER_RETURN' : 'SUPPLIER_RETURN'} />

          <div className="card" style={{ marginTop: 16 }}>
            <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>
              ⌨ Manual Barcode Entry
            </h3>
            <form onSubmit={handleManualLookup} style={{ display: 'flex', gap: 10 }}>
              <input
                type="text"
                className="form-input"
                placeholder="Enter barcode..."
                value={barcode}
                onChange={e => setBarcode(e.target.value)}
                style={{ flex: 1 }}
              />
              <button type="submit" className="btn btn-secondary">
                Lookup
              </button>
            </form>
          </div>
        </div>

        {/* Right Side: Return Form */}
        <div className="card">
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Receipt size={18} style={{ color: 'var(--accent)' }} />
            {activeTab === 'customer' ? 'Customer Return Form' : 'Supplier Return Form'}
          </h3>

          <form onSubmit={handleSubmit}>
            {activeTab === 'customer' && (
              <div className="form-group" style={{ marginBottom: 16 }}>
                <label className="form-label">Invoice Number *</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="E.g., INV-10293"
                  value={invoiceNumber}
                  onChange={e => setInvoiceNumber(e.target.value)}
                  onBlur={loadInvoiceProducts}
                  required
                />
              </div>
            )}

            {activeTab === 'customer' && invoiceProducts.length > 0 && (
              <div className="form-group" style={{ marginBottom: 16 }}>
                <label className="form-label">Invoice Product *</label>
                <select className="form-input" value={selectedProductBarcode} onChange={e => selectInvoiceProduct(e.target.value)} required>
                  <option value="">-- Select Product --</option>
                  {invoiceProducts.map(product => (
                    <option key={product.productId} value={product.barcode} disabled={product.availableReturnQuantity <= 0}>
                      {product.productName} (Available to return: {product.availableReturnQuantity})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="form-group" style={{ marginBottom: 16 }}>
              <label className="form-label">Barcode</label>
              <input
                type="text"
                className="form-input"
                value={barcode}
                readOnly
                placeholder="Scan or lookup barcode to auto-fill"
                style={{ background: 'var(--bg)' }}
              />
            </div>

            {scannedProduct && (
              <div style={{ padding: 12, background: 'var(--accent-lt)', borderRadius: 8, marginBottom: 16 }}>
                <h4 style={{ margin: 0, fontSize: 14, color: 'var(--text-1)', fontWeight: 600 }}>{scannedProduct.productName}</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 8, fontSize: 12, color: 'var(--text-3)' }}>
                  <div>Category: <strong>{scannedProduct.category}</strong></div>
                  {scannedProduct.currentStock !== undefined && <div>Current Stock: <strong>{scannedProduct.currentStock}</strong></div>}
                  {scannedProduct.sellingPrice !== undefined && <div>Price: <strong>₹{scannedProduct.sellingPrice}</strong></div>}
                  {scannedProduct.expiryStatus && <div>Expiry Status: <strong style={{ color: scannedProduct.expiryStatus === 'EXPIRED' ? 'var(--err)' : 'var(--ok)' }}>{scannedProduct.expiryStatus}</strong></div>}
                  {activeTab === 'customer' && <div>Available Return: <strong>{invoiceProducts.find(item => item.barcode === barcode)?.availableReturnQuantity ?? 0}</strong></div>}
                </div>
              </div>
            )}

            {activeTab === 'customer' && (
              <div className="form-group" style={{ marginBottom: 16 }}>
                <label className="form-label">Returned Product Condition *</label>
                <select className="form-input" value={condition} onChange={e => { setCondition(e.target.value); setSelectedFiles([]); stopCamera(); }}>
                  <option value="GOOD">GOOD (Reusable - Standard Catalog Stock)</option>
                  <option value="DAMAGED">DAMAGED (Move to Damage Inventory - Evidence Required)</option>
                </select>
              </div>
            )}

            <div className="form-group" style={{ marginBottom: 16 }}>
              <label className="form-label">Return Quantity *</label>
              <input
                type="number"
                min="1"
                className="form-input"
                value={quantity}
                onChange={e => setQuantity(parseInt(e.target.value) || 1)}
                required
              />
            </div>

            <div className="form-group" style={{ marginBottom: 16 }}>
              <label className="form-label">Reason / Notes</label>
              <textarea
                className="form-input"
                placeholder={activeTab === 'customer' ? 'E.g., Customer defect, wrong product, customer changed mind...' : 'E.g., Near expiry, damaged, defective batch...'}
                value={notes}
                onChange={e => setNotes(e.target.value)}
                style={{ height: 80, resize: 'none' }}
              />
            </div>

            {/* Damage Evidence Section (Supplier Return or Damaged Customer Return) */}
            {(activeTab === 'supplier' || (activeTab === 'customer' && condition === 'DAMAGED')) && (
              <div className="card" style={{ marginBottom: 20, border: '1px dashed var(--border)', background: 'var(--bg-card)' }}>
                <h4 style={{ fontSize: 14, fontWeight: 600, margin: '0 0 12px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>📸 Damage Evidence Images * <span style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 400 }}>(1 to 5 images)</span></span>
                  <span style={{ fontSize: 12, color: selectedFiles.length > 0 ? 'var(--accent)' : 'var(--err)' }}>{selectedFiles.length} selected</span>
                </h4>

                {/* Upload Buttons */}
                <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    Upload Photo
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                    onClick={isCameraOpen ? stopCamera : startCamera}
                  >
                    <Camera size={16} />
                    {isCameraOpen ? 'Close Camera' : 'Laptop Camera'}
                  </button>
                  <input
                    type="file"
                    ref={fileInputRef}
                    multiple
                    accept="image/png, image/jpeg, image/jpg"
                    onChange={handleFileChange}
                    style={{ display: 'none' }}
                  />
                </div>

                {/* Webcam Video */}
                {isCameraOpen && (
                  <div style={{ position: 'relative', background: '#000', borderRadius: 8, overflow: 'hidden', marginBottom: 16 }}>
                    <video ref={videoRef} autoPlay playsInline muted style={{ width: '100%', height: 'auto', display: 'block' }} />
                    <div style={{ position: 'absolute', bottom: 12, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 10 }}>
                      <button
                        type="button"
                        className="btn btn-primary"
                        onClick={capturePhoto}
                        style={{ background: 'var(--accent)', border: 'none' }}
                      >
                        Capture Photo
                      </button>
                    </div>
                  </div>
                )}

                {/* Previews */}
                {selectedFiles.length > 0 && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
                    {selectedFiles.map((file, idx) => {
                      const url = URL.createObjectURL(file)
                      return (
                        <div key={idx} style={{ position: 'relative', aspectRatio: '1/1', borderRadius: 6, overflow: 'hidden', border: '1px solid var(--border)' }}>
                          <img src={url} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          <button
                            type="button"
                            onClick={() => removeFile(idx)}
                            style={{ position: 'absolute', top: 2, right: 2, background: 'rgba(239, 68, 68, 0.9)', color: '#fff', border: 'none', borderRadius: '50%', width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0 }}
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: '100%', padding: '12px 16px', fontSize: 14, fontWeight: 600 }}
              disabled={loading || !scannedProduct}
            >
              {loading ? 'Processing return...' : activeTab === 'customer' ? 'Submit Customer Return Request' : 'Submit Supplier Return Request'}
            </button>
          </form>
        </div>
      </div>

      {/* Customer Return Requests Management Panel */}
      <div className="card" style={{ marginTop: 24 }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
          <User size={18} style={{ color: 'var(--accent)' }} />
          Customer Product Return & Resolution Panel
        </h3>

        {loadingHistory ? (
          <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-3)' }}>Loading customer return requests...</div>
        ) : returnsHistory.filter(r => r.returnType === 'CUSTOMER_TO_OWNER').length === 0 ? (
          <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-3)' }}>No customer return requests found.</div>
        ) : (
          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th>Request Info</th>
                  <th>Product Details</th>
                  <th>Condition</th>
                  <th>Notes / Evidence</th>
                  <th>Status & Actions</th>
                </tr>
              </thead>
              <tbody>
                {returnsHistory.filter(r => r.returnType === 'CUSTOMER_TO_OWNER').map((ret) => (
                  <tr key={ret.id}>
                    <td>
                      <div><strong>Invoice:</strong> {ret.invoiceNumber}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-3)' }}>
                        {new Date(ret.createdAt).toLocaleDateString()} {new Date(ret.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </td>
                    <td>
                      <div><strong>{ret.productName}</strong></div>
                      <div style={{ fontSize: 11, color: 'var(--text-3)' }}>Barcode: <code>{ret.barcode}</code></div>
                      <div style={{ fontSize: 11, color: 'var(--text-3)' }}>Qty: <strong>{ret.quantity}</strong></div>
                    </td>
                    <td>
                      <span className={`badge ${ret.condition === 'GOOD' ? 'badge-success' : 'badge-danger'}`}>
                        {ret.condition}
                      </span>
                    </td>
                    <td>
                      <div>{ret.notes || '-'}</div>
                      <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                        {(ret.evidenceUrls || '').split(',').filter(Boolean).map((imgUrl, i) => (
                          <div
                            key={i}
                            style={{ position: 'relative', width: 32, height: 32, borderRadius: 4, overflow: 'hidden', border: '1px solid var(--border)', cursor: 'pointer' }}
                            onClick={() => setZoomedImage(`http://localhost:8080${imgUrl}`)}
                          >
                            <img src={`http://localhost:8080${imgUrl}`} alt="Evidence" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          </div>
                        ))}
                      </div>
                    </td>
                    <td>
                      {/* ── Status display ── */}
                      <div style={{ marginBottom: 8 }}>
                        <span className={`badge ${
                          ret.status === 'RESOLVED_REFUND' ? 'badge-success' :
                          ret.status === 'RESOLVED_EXCHANGE' ? 'badge-success' :
                          ret.status === 'APPROVED' ? 'badge-info' :
                          ret.status === 'REJECTED' ? 'badge-danger' : 'badge-warning'
                        }`}>
                          {ret.status}
                        </span>
                      </div>

                      {/* ── PENDING OWNER APPROVAL Actions ── */}
                      {ret.status === 'PENDING_OWNER_APPROVAL' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 260 }}>
                          <div style={{ display: 'flex', gap: 8 }}>
                            <button className="btn btn-primary" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => handleApproveCustomerReturn(ret.id)}>
                              Approve
                            </button>
                            <button
                              className="btn btn-secondary"
                              style={{ padding: '4px 10px', fontSize: 12, borderColor: 'var(--err)', color: 'var(--err)' }}
                              onClick={() => setShowRejectForm(prev => ({ ...prev, [ret.id]: !prev[ret.id] }))}
                            >
                              Reject
                            </button>
                          </div>
                          {showRejectForm[ret.id] && (
                            <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                              <input
                                type="text"
                                className="form-input"
                                placeholder="Rejection reason..."
                                style={{ padding: '4px 8px', fontSize: 12 }}
                                value={rejectionReasons[ret.id] || ''}
                                onChange={e => setRejectionReasons(prev => ({ ...prev, [ret.id]: e.target.value }))}
                              />
                              <button className="btn btn-primary" style={{ padding: '4px 8px', fontSize: 12, background: 'var(--err)', borderColor: 'var(--err)' }} onClick={() => handleRejectCustomerReturn(ret.id)}>
                                Submit
                              </button>
                            </div>
                          )}
                        </div>
                      )}

                      {/* ── APPROVED (Wait for Customer Resolution Decision) Actions ── */}
                      {ret.status === 'APPROVED' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, background: 'var(--bg)', padding: 10, borderRadius: 6, border: '1px solid var(--border)' }}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-1)' }}>Customer Decision Required:</div>
                          <div style={{ display: 'flex', gap: 8 }}>
                            <button
                              className={`btn btn-secondary ${activeResolutions[ret.id] === 'REFUND' ? 'btn-primary' : ''}`}
                              style={{ padding: '4px 10px', fontSize: 11 }}
                              onClick={() => setActiveResolutions(prev => ({ ...prev, [ret.id]: 'REFUND' }))}
                            >
                              Refund
                            </button>
                            <button
                              className={`btn btn-secondary ${activeResolutions[ret.id] === 'EXCHANGE' ? 'btn-primary' : ''}`}
                              style={{ padding: '4px 10px', fontSize: 11 }}
                              onClick={() => setActiveResolutions(prev => ({ ...prev, [ret.id]: 'EXCHANGE' }))}
                            >
                              Exchange
                            </button>
                          </div>

                          {/* ── Refund Form ── */}
                          {activeResolutions[ret.id] === 'REFUND' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 6 }}>
                              <label style={{ fontSize: 11, color: 'var(--text-3)' }}>Refund Method</label>
                              <select
                                className="form-input"
                                style={{ padding: '4px 8px', fontSize: 11 }}
                                value={refundMethods[ret.id] || 'CASH'}
                                onChange={e => setRefundMethods(prev => ({ ...prev, [ret.id]: e.target.value }))}
                              >
                                <option value="CASH">Cash</option>
                                <option value="UPI">UPI</option>
                                <option value="BANK_TRANSFER">Bank Transfer</option>
                              </select>
                              <button className="btn btn-primary" style={{ padding: '4px 8px', fontSize: 11 }} onClick={() => handleProcessRefund(ret.id)}>
                                Process Refund
                              </button>
                            </div>
                          )}

                          {/* ── Exchange Form ── */}
                          {activeResolutions[ret.id] === 'EXCHANGE' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 6 }}>
                              <label style={{ fontSize: 11, color: 'var(--text-3)' }}>Exchange Item Barcode</label>
                              <input
                                type="text"
                                className="form-input"
                                placeholder="Scan or enter barcode"
                                style={{ padding: '4px 8px', fontSize: 11 }}
                                value={exchangeBarcodes[ret.id] || ''}
                                onChange={e => setExchangeBarcodes(prev => ({ ...prev, [ret.id]: e.target.value }))}
                              />
                              <label style={{ fontSize: 11, color: 'var(--text-3)' }}>Quantity</label>
                              <input
                                type="number"
                                min="1"
                                className="form-input"
                                style={{ padding: '4px 8px', fontSize: 11 }}
                                value={exchangeQuantities[ret.id] || 1}
                                onChange={e => setExchangeQuantities(prev => ({ ...prev, [ret.id]: parseInt(e.target.value) || 1 }))}
                              />
                              <button className="btn btn-primary" style={{ padding: '4px 8px', fontSize: 11 }} onClick={() => handleProcessExchange(ret.id)}>
                                Process Exchange
                              </button>
                            </div>
                          )}
                        </div>
                      )}

                      {/* ── REJECTED View ── */}
                      {ret.status === 'REJECTED' && ret.rejectionReason && (
                        <div style={{ fontSize: 12, color: 'var(--err)', background: 'var(--accent-lt)', padding: 6, borderRadius: 4, marginTop: 4 }}>
                          Rejection Reason: {ret.rejectionReason}
                        </div>
                      )}

                      {/* ── RESOLVED REFUND View ── */}
                      {ret.status === 'RESOLVED_REFUND' && (
                        <div style={{ fontSize: 12, background: 'var(--accent-lt)', padding: 8, borderRadius: 4, marginTop: 4 }}>
                          <div>Amount: <strong>₹{ret.refundAmount}</strong></div>
                          <div>Method: <strong>{ret.refundMethod}</strong></div>
                          <div>Processed By: <strong>{ret.processedBy}</strong></div>
                        </div>
                      )}

                      {/* ── RESOLVED EXCHANGE View ── */}
                      {ret.status === 'RESOLVED_EXCHANGE' && (
                        <div style={{ fontSize: 12, background: 'var(--accent-lt)', padding: 8, borderRadius: 4, marginTop: 4 }}>
                          <div>New Invoice: <strong>{ret.exchangeNewInvoiceNumber}</strong></div>
                          <div>Processed By: <strong>{ret.processedBy}</strong></div>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Supplier Return Requests History Table */}
      <div className="card" style={{ marginTop: 24 }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Truck size={18} style={{ color: 'var(--accent)' }} />
          Supplier Return Requests History
        </h3>

        {loadingHistory ? (
          <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-3)' }}>Loading history...</div>
        ) : returnsHistory.filter(r => r.returnType === 'OWNER_TO_SUPPLIER').length === 0 ? (
          <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-3)' }}>No supplier return requests found.</div>
        ) : (
          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Product</th>
                  <th>Barcode</th>
                  <th>Quantity</th>
                  <th>Status</th>
                  <th>Notes</th>
                  <th>Evidence</th>
                </tr>
              </thead>
              <tbody>
                {returnsHistory.filter(r => r.returnType === 'OWNER_TO_SUPPLIER').map((ret) => (
                  <tr key={ret.id}>
                    <td>{new Date(ret.createdAt).toLocaleDateString()} {new Date(ret.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                    <td>{ret.productName}</td>
                    <td><code>{ret.barcode}</code></td>
                    <td>{ret.quantity}</td>
                    <td>
                      <span className={`badge ${
                        ret.status === 'ACCEPTED' ? 'badge-success' :
                        ret.status === 'REJECTED' ? 'badge-danger' : 'badge-warning'
                      }`}>
                        {ret.status}
                      </span>
                      {ret.status === 'REJECTED' && ret.rejectionReason && (
                        <div style={{ fontSize: 11, color: 'var(--err)', marginTop: 4 }}>
                          Reason: {ret.rejectionReason}
                        </div>
                      )}
                    </td>
                    <td>{ret.notes || '-'}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {(ret.evidenceUrls || '').split(',').filter(Boolean).map((imgUrl, i) => (
                          <div
                            key={i}
                            style={{ position: 'relative', width: 32, height: 32, borderRadius: 4, overflow: 'hidden', border: '1px solid var(--border)', cursor: 'pointer' }}
                            onClick={() => setZoomedImage(`http://localhost:8080${imgUrl}`)}
                          >
                            <img src={`http://localhost:8080${imgUrl}`} alt="Evidence" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          </div>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Zoom Image Modal */}
      {zoomedImage && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ position: 'relative', maxWidth: '90%', maxHeight: '90%' }}>
            <button
              onClick={() => setZoomedImage(null)}
              style={{ position: 'absolute', top: -40, right: 0, background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', gap: 4 }}
            >
              <X size={20} /> Close
            </button>
            <img src={zoomedImage} alt="Zoomed Evidence" style={{ maxWidth: '100%', maxHeight: '80vh', display: 'block', borderRadius: 8 }} />
          </div>
        </div>
      )}
    </div>
  )
}
