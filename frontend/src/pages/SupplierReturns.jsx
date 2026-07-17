import React, { useEffect, useState } from 'react'
import { barcodeAPI } from '../services/api'
import toast from 'react-hot-toast'
import { motion } from 'framer-motion'
import { Clock, CheckCircle, XCircle, Eye, RefreshCw, X, Receipt } from 'lucide-react'

const STATUS = {
  PENDING:  { cls: 'badge-warning', label: 'Pending', Icon: Clock },
  ACCEPTED: { cls: 'badge-success', label: 'Accepted', Icon: CheckCircle },
  REJECTED: { cls: 'badge-danger', label: 'Rejected', Icon: XCircle }
}

const anim = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: .06 } } }
const row = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { duration: .26 } } }

export default function SupplierReturns() {
  const [returns, setReturns] = useState([])
  const [loading, setLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)

  // Rejection Dialog State
  const [rejectingId, setRejectingId] = useState(null)
  const [rejectionReason, setRejectionReason] = useState('')

  // Zoom Modal
  const [zoomedImage, setZoomedImage] = useState(null)

  useEffect(() => {
    loadReturns()
  }, [])

  const loadReturns = async () => {
    setLoading(true)
    try {
      const res = await barcodeAPI.getSupplierReturns()
      setReturns(res.data?.data || [])
    } catch (err) {
      toast.error('Failed to load return requests')
    } finally {
      setLoading(false)
    }
  }

  const handleAccept = async (id) => {
    if (!window.confirm('Are you sure you want to accept this return request? This will update the owner\'s inventory.')) return
    setActionLoading(true)
    try {
      await barcodeAPI.acceptSupplierReturn(id)
      toast.success('Return request accepted successfully!')
      loadReturns()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to accept return request')
    } finally {
      setActionLoading(false)
    }
  }

  const handleRejectSubmit = async (e) => {
    e.preventDefault()
    if (!rejectionReason.trim()) {
      toast.error('Please specify a rejection reason')
      return
    }
    setActionLoading(true)
    try {
      await barcodeAPI.rejectSupplierReturn(rejectingId, rejectionReason.trim())
      toast.success('Return request rejected.')
      setRejectingId(null)
      setRejectionReason('')
      loadReturns()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to reject return request')
    } finally {
      setActionLoading(false)
    }
  }

  return (
    <div className="animate-fade-in" style={{ padding: '24px' }}>
      {/* Title */}
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-h)', margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
            <Receipt style={{ color: 'var(--accent)' }} size={28} />
            Product Return Requests
          </h2>
          <p style={{ color: 'var(--text-3)', margin: '4px 0 0 0', fontSize: 14 }}>
            Review damage evidence and process return requests from store owners.
          </p>
        </div>
        <button className="btn btn-secondary" onClick={loadReturns} disabled={loading} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {/* Main List */}
      <div className="card">
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-3)' }}>Loading return requests...</div>
        ) : returns.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-3)' }}>No return requests found.</div>
        ) : (
          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Shop Owner ID</th>
                  <th>Product</th>
                  <th>Barcode</th>
                  <th>Quantity</th>
                  <th>Status</th>
                  <th>Notes</th>
                  <th>Damage Photos (Evidence)</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <motion.tbody variants={anim} initial="hidden" animate="show">
                {returns.map((ret) => {
                  const statusInfo = STATUS[ret.status] || { cls: 'badge-gray', label: ret.status, Icon: Clock }
                  return (
                    <motion.tr key={ret.id} variants={row}>
                      <td>{new Date(ret.createdAt).toLocaleDateString()} {new Date(ret.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                      <td>
                        <div><strong>Owner #{ret.adminId}</strong></div>
                        {ret.branchId && <div style={{ fontSize: 11, color: 'var(--text-3)' }}>Branch #{ret.branchId}</div>}
                      </td>
                      <td>
                        <div>{ret.productName}</div>
                        {ret.condition && (
                          <span className={`badge ${ret.condition === 'GOOD' ? 'badge-success' : 'badge-danger'}`} style={{ fontSize: 10, padding: '2px 6px', marginTop: 4 }}>
                            {ret.condition}
                          </span>
                        )}
                      </td>
                      <td><code>{ret.barcode}</code></td>
                      <td>{ret.quantity}</td>
                      <td>
                        <span className={`badge ${statusInfo.cls}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <statusInfo.Icon size={12} />
                          {statusInfo.label}
                        </span>
                        {ret.status === 'REJECTED' && ret.rejectionReason && (
                          <div style={{ fontSize: 11, color: 'var(--err)', marginTop: 4, maxWidth: 180 }}>
                            Reason: {ret.rejectionReason}
                          </div>
                        )}
                      </td>
                      <td>{ret.notes || '-'}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          {(ret.evidenceUrls || '').split(',').filter(Boolean).map((imgUrl, i) => (
                            <div
                              key={i}
                              style={{ position: 'relative', width: 44, height: 44, borderRadius: 6, overflow: 'hidden', border: '1px solid var(--border)', cursor: 'pointer' }}
                              onClick={() => setZoomedImage(`http://localhost:8080${imgUrl}`)}
                            >
                              <img src={`http://localhost:8080${imgUrl}`} alt="Damage Evidence" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            </div>
                          ))}
                        </div>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        {ret.status === 'PENDING' ? (
                          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                            <button
                              className="btn btn-primary btn-sm"
                              onClick={() => handleAccept(ret.id)}
                              disabled={actionLoading}
                              style={{ background: 'var(--ok)', borderColor: 'var(--ok)', padding: '4px 10px', fontSize: 12 }}
                            >
                              Accept
                            </button>
                            <button
                              className="btn btn-secondary btn-sm"
                              onClick={() => setRejectingId(ret.id)}
                              disabled={actionLoading}
                              style={{ color: 'var(--err)', borderColor: 'var(--err)', padding: '4px 10px', fontSize: 12 }}
                            >
                              Reject
                            </button>
                          </div>
                        ) : (
                          <span style={{ fontSize: 12, color: 'var(--text-3)' }}>Processed</span>
                        )}
                      </td>
                    </motion.tr>
                  )
                })}
              </motion.tbody>
            </table>
          </div>
        )}
      </div>

      {/* Reject Reason Modal */}
      {rejectingId && (
        <div className="modal-overlay" onClick={() => setRejectingId(null)}>
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: 450 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
              <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Reject Return Request</h3>
              <button className="btn-icon" onClick={() => setRejectingId(null)}><X size={15} /></button>
            </div>
            <form onSubmit={handleRejectSubmit}>
              <div className="form-group" style={{ marginBottom: 20 }}>
                <label className="form-label">Specify Rejection Reason *</label>
                <textarea
                  className="form-input"
                  required
                  placeholder="Explain why this request is being rejected..."
                  value={rejectionReason}
                  onChange={e => setRejectionReason(e.target.value)}
                  style={{ height: 100, resize: 'none' }}
                />
              </div>
              <div style={{ display: 'flex', justifySelf: 'flex-end', gap: 10 }}>
                <button type="button" className="btn btn-secondary" onClick={() => setRejectingId(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary" style={{ background: 'var(--err)', borderColor: 'var(--err)' }} disabled={actionLoading}>
                  Reject Request
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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
