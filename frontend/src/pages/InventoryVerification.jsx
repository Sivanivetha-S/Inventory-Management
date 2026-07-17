import React, { useState } from 'react'
import { barcodeAPI } from '../services/api'
import BarcodeScanner from '../components/BarcodeScanner'
import toast from 'react-hot-toast'
import { ShieldCheck, Plus, Trash2, HelpCircle } from 'lucide-react'

export default function InventoryVerification() {
  const [scannedItems, setScannedItems] = useState([]) // array of { barcode, productName, expectedStock, actualStock }
  const [manualCode, setManualCode] = useState('')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [reportResults, setReportResults] = useState(null)

  const handleBarcodeLookup = async (code) => {
    try {
      const res = await barcodeAPI.lookup(code, 'VERIFICATION')
      const data = res.data.data
      if (data && data.productFound) {
        setScannedItems(prev => {
          const idx = prev.findIndex(item => item.barcode === code)
          if (idx > -1) {
            // Already in list: increment actual stock
            const updated = [...prev]
            updated[idx].actualStock += 1
            toast.success(`Incremented ${data.productName} quantity to ${updated[idx].actualStock}`)
            return updated;
          } else {
            // Add new row
            toast.success(`Added ${data.productName} to verification list`)
            return [...prev, {
              barcode: code,
              productName: data.productName,
              expectedStock: data.currentStock,
              actualStock: 1
            }]
          }
        })
      } else {
        toast.error(`Barcode ${code} not found in inventory. Please register the product first.`)
      }
    } catch (e) {
      toast.error(e.response?.data?.message || 'Error looking up barcode')
    }
  }

  const handleManualSearch = (e) => {
    e.preventDefault()
    if (!manualCode.trim()) return
    handleBarcodeLookup(manualCode.trim())
    setManualCode('')
  }

  const handleRemove = (barcode) => {
    setScannedItems(prev => prev.filter(item => item.barcode !== barcode))
    toast.success('Product removed from verification list')
  }

  const handleQtyChange = (barcode, val) => {
    const num = parseInt(val)
    if (isNaN(num) || num < 0) return
    setScannedItems(prev => prev.map(item => item.barcode === barcode ? { ...item, actualStock: num } : item))
  }

  const handleSubmit = async () => {
    if (scannedItems.length === 0) {
      toast.error('Scan or search at least one product to verify inventory.')
      return
    }

    setLoading(true)
    try {
      // Format payload as Map<String, Integer>: { barcode: actualStock }
      const payload = {}
      scannedItems.forEach(item => {
        payload[item.barcode] = item.actualStock
      })

      const res = await barcodeAPI.verifyInventory(payload, notes)
      toast.success('Inventory Verification Submitted Successfully!')
      setReportResults(res.data.data)
      setScannedItems([])
      setNotes('')
    } catch (e) {
      toast.error(e.response?.data?.message || 'Submission failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="animate-fade-in" style={{ padding: '24px' }}>
      {/* Page Title */}
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-h)', margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
          <ShieldCheck style={{ color: 'var(--accent)' }} size={28} />
          Barcode Inventory Verification
        </h2>
        <p style={{ color: 'var(--text-3)', margin: '4px 0 0 0', fontSize: 14 }}>
          Audit stock accuracy by scanning barcodes. Shortages will generate theft warnings and alerts automatically.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {/* Left Side: Camera Scanner & Manual Lookup */}
        <div>
          <BarcodeScanner onScan={handleBarcodeLookup} action="VERIFICATION" />

          <div className="card" style={{ marginTop: 16 }}>
            <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>
              ⌨ Manual Barcode Entry
            </h3>
            <form onSubmit={handleManualSearch} style={{ display: 'flex', gap: 10 }}>
              <input
                type="text"
                className="form-input"
                placeholder="Type barcode number manually..."
                value={manualCode}
                onChange={e => setManualCode(e.target.value)}
                style={{ flex: 1 }}
              />
              <button type="submit" className="btn btn-primary">
                Add Product
              </button>
            </form>
          </div>
        </div>

        {/* Right Side: Reconciliation List & Submit */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', minHeight: '400px' }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>
            📝 Reconciliation Sheet
          </h3>

          <div style={{ flex: 1, overflowY: 'auto', marginBottom: 16 }}>
            {scannedItems.length > 0 ? (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)', textAlign: 'left' }}>
                    <th style={{ padding: 8 }}>Product</th>
                    <th style={{ padding: 8 }}>Expected</th>
                    <th style={{ padding: 8 }}>Actual Count</th>
                    <th style={{ padding: 8 }}>Diff</th>
                    <th style={{ padding: 8, width: 50 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {scannedItems.map((item) => {
                    const diff = item.expectedStock - item.actualStock
                    const diffColor = diff === 0 ? 'var(--ok)' : diff > 0 ? 'var(--err)' : 'var(--info)'
                    return (
                      <tr key={item.barcode} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: 8 }}>
                          <div style={{ fontWeight: 600 }}>{item.productName}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{item.barcode}</div>
                        </td>
                        <td style={{ padding: 8, fontWeight: 500 }}>{item.expectedStock}</td>
                        <td style={{ padding: 8 }}>
                          <input
                            type="number"
                            min="0"
                            className="form-input"
                            value={item.actualStock}
                            onChange={e => handleQtyChange(item.barcode, e.target.value)}
                            style={{ width: 70, padding: '4px 8px', fontSize: 13 }}
                          />
                        </td>
                        <td style={{ padding: 8, fontWeight: 700, color: diffColor }}>
                          {diff === 0 ? '✓ Match' : diff > 0 ? `-${diff} (Short)` : `+${Math.abs(diff)} (Extra)`}
                        </td>
                        <td style={{ padding: 8 }}>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => handleRemove(item.barcode)}
                            style={{ color: 'var(--err)', borderColor: 'var(--err)', padding: 4 }}
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-3)' }}>
                <HelpCircle size={48} strokeWidth={1.5} style={{ marginBottom: 12, color: 'var(--text-4)' }} />
                <span>No products scanned yet.</span>
                <span style={{ fontSize: 12, marginTop: 4 }}>Scan barcodes to begin stock reconciliation.</span>
              </div>
            )}
          </div>

          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
            <div className="form-group" style={{ marginBottom: 16 }}>
              <label className="form-label">Audit Notes</label>
              <textarea
                className="form-input"
                placeholder="E.g., Yearly inventory audit, branch verification notes..."
                value={notes}
                onChange={e => setNotes(e.target.value)}
                style={{ width: '100%', height: 60, resize: 'none' }}
              />
            </div>

            <button
              onClick={handleSubmit}
              className="btn btn-primary"
              style={{ width: '100%', padding: '12px 16px', fontSize: 14, fontWeight: 600 }}
              disabled={loading || scannedItems.length === 0}
            >
              {loading ? 'Submitting Report...' : 'Submit Verification Report'}
            </button>
          </div>
        </div>
      </div>

      {/* Results Log Summary */}
      {reportResults && (
        <div className="card" style={{ marginTop: 24, borderColor: 'var(--ok-bdr)', background: 'var(--ok-bg)' }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-h)', marginBottom: 12 }}>
            ✓ Verification Report Results
          </h3>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border)' }}>
                  <th style={{ padding: 8 }}>Product</th>
                  <th style={{ padding: 8 }}>Expected</th>
                  <th style={{ padding: 8 }}>Scanned Actual</th>
                  <th style={{ padding: 8 }}>Shortage/Extra</th>
                  <th style={{ padding: 8 }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {reportResults.map((item, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: 8, fontWeight: 500 }}>{item.productName}</td>
                    <td style={{ padding: 8 }}>{item.expectedStock}</td>
                    <td style={{ padding: 8 }}>{item.actualStock}</td>
                    <td style={{ padding: 8, fontWeight: 600 }}>{item.difference}</td>
                    <td style={{ padding: 8, fontWeight: 600, color: item.status.includes('Short') ? 'var(--err)' : 'var(--ok)' }}>{item.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
