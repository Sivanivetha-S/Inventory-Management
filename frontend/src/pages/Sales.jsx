import React, { useEffect, useState, useCallback } from 'react'
import { invoiceAPI } from '../services/api'
import toast from 'react-hot-toast'
import { FiSearch, FiX, FiDownload, FiCalendar, FiFilter } from 'react-icons/fi'

const today = () => new Date().toISOString().split('T')[0]
const monthStart = () => {
  const d = new Date(); d.setDate(1)
  return d.toISOString().split('T')[0]
}

export default function Sales() {
  const [invoices, setInvoices]   = useState([])
  const [loading, setLoading]     = useState(true)
  const [search, setSearch]       = useState('')
  const [fromDate, setFromDate]   = useState(monthStart())
  const [toDate, setToDate]       = useState(today())
  const [filtered, setFiltered]   = useState([])
  const [totalRevenue, setTotalRevenue] = useState(0)
  const [totalDiscount, setTotalDiscount] = useState(0)

  const load = useCallback(() => {
    setLoading(true)
    invoiceAPI.getAll()
      .then(r => { setInvoices(r.data.data); applyFilter(r.data.data, fromDate, toDate, search) })
      .catch(() => toast.error('Failed to load sales'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  const applyFilter = (data, from, to, q) => {
    let result = data || invoices
    if (from && to) {
      result = result.filter(inv => {
        const d = inv.createdAt?.split('T')[0]
        return d >= from && d <= to
      })
    }
    if (q) {
      const lower = q.toLowerCase()
      result = result.filter(inv =>
        inv.invoiceNumber.toLowerCase().includes(lower) ||
        (inv.customer?.name || '').toLowerCase().includes(lower)
      )
    }
    setFiltered(result)
    setTotalRevenue(result.reduce((s, i) => s + Number(i.totalAmount), 0))
    setTotalDiscount(result.reduce((s, i) => s + Number(i.discountAmount), 0))
  }

  useEffect(() => { applyFilter(invoices, fromDate, toDate, search) }, [fromDate, toDate, search, invoices])

  const exportCSV = () => {
    const headers = ['Invoice #','Customer','Items','Subtotal','Discount%','Discount Amt','Total','Date']
    const rows = filtered.map(inv => [
      inv.invoiceNumber,
      inv.customer?.name || 'Walk-in',
      inv.items?.length,
      inv.subtotal,
      inv.discountPercentage,
      inv.discountAmount,
      inv.totalAmount,
      new Date(inv.createdAt).toLocaleDateString('en-IN'),
    ])
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `sales-report-${fromDate}-to-${toDate}.csv`
    a.click(); URL.revokeObjectURL(url)
    toast.success('Report exported!')
  }

  return (
    <div className="animate-fade-in">
      {/* Summary cards */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))', gap:16, marginBottom:24 }}>
        {[
          { label:'Total Invoices',   value: filtered.length,                            icon:'📋', color:'linear-gradient(135deg,#a07840,#c8a870)' },
          { label:'Total Revenue',    value:`₹${totalRevenue.toLocaleString('en-IN')}`,  icon:'💰', color:'linear-gradient(135deg,#7a5c2e,#b08050)' },
          { label:'Total Discounts',  value:`₹${totalDiscount.toLocaleString('en-IN')}`, icon:'🏷️', color:'linear-gradient(135deg,#8b6030,#c8a870)' },
          { label:'Avg Order Value',  value: filtered.length ? `₹${(totalRevenue/filtered.length).toLocaleString('en-IN',{maximumFractionDigits:0})}` : '₹0', icon:'📊', color:'linear-gradient(135deg,#6b4820,#a07840)' },
        ].map(s => (
          <div key={s.label} style={{ background:s.color, borderRadius:'var(--radius-lg)', padding:'20px', boxShadow:'var(--shadow-md)', display:'flex', alignItems:'center', gap:14 }}>
            <span style={{ fontSize:28 }}>{s.icon}</span>
            <div>
              <p style={{ fontSize:12, color:'rgba(255,255,255,0.8)', fontWeight:600 }}>{s.label}</p>
              <h3 style={{ fontSize:22, fontWeight:800, color:'white', lineHeight:1 }}>{s.value}</h3>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="card" style={{ marginBottom:20 }}>
        <div style={{ display:'flex', gap:16, flexWrap:'wrap', alignItems:'flex-end' }}>
          <div>
            <label className="form-label"><FiCalendar style={{ marginRight:4 }} />From Date</label>
            <input type="date" className="form-input" style={{ width:160 }} value={fromDate} onChange={e => setFromDate(e.target.value)} />
          </div>
          <div>
            <label className="form-label"><FiCalendar style={{ marginRight:4 }} />To Date</label>
            <input type="date" className="form-input" style={{ width:160 }} value={toDate} onChange={e => setToDate(e.target.value)} />
          </div>
          <div style={{ flex:1, minWidth:220 }}>
            <label className="form-label"><FiSearch style={{ marginRight:4 }} />Search</label>
            <div className="search-bar">
              <FiSearch style={{ color:'var(--gray)' }} />
              <input placeholder="Invoice # or customer name..." value={search} onChange={e => setSearch(e.target.value)} />
              {search && <button onClick={() => setSearch('')} style={{ background:'none',border:'none',cursor:'pointer',color:'var(--gray)' }}><FiX /></button>}
            </div>
          </div>
          <button className="btn btn-secondary" onClick={() => { setSearch(''); setFromDate(monthStart()); setToDate(today()) }}>
            <FiFilter /> Reset
          </button>
          <button className="btn btn-primary" onClick={exportCSV} disabled={filtered.length === 0}>
            <FiDownload /> Export CSV
          </button>
        </div>
      </div>

      {/* Table */}
      {loading
        ? <div className="loading-center"><div className="spinner" /></div>
        : filtered.length === 0
          ? <div className="empty-state"><h3>No sales found for this period</h3></div>
          : <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>#</th><th>Invoice #</th><th>Customer</th><th>Items</th>
                    <th>Subtotal</th><th>Discount</th><th>Total</th><th>Status</th><th>Date & Time</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((inv, i) => (
                    <tr key={inv.id}>
                      <td>{i + 1}</td>
                      <td><strong style={{ color:'var(--primary)' }}>{inv.invoiceNumber}</strong></td>
                      <td>{inv.customer?.name || <span className="badge badge-gray">Walk-in</span>}</td>
                      <td><span className="badge badge-primary">{inv.items?.length}</span></td>
                      <td>₹{Number(inv.subtotal).toLocaleString('en-IN')}</td>
                      <td>
                        {Number(inv.discountPercentage) > 0
                          ? <span className="badge badge-warning">{inv.discountPercentage}% (−₹{Number(inv.discountAmount).toLocaleString('en-IN')})</span>
                          : <span className="badge badge-gray">None</span>}
                      </td>
                      <td><strong>₹{Number(inv.totalAmount).toLocaleString('en-IN')}</strong></td>
                      <td><span className={`badge ${inv.status === 'PAID' ? 'badge-success' : 'badge-warning'}`}>{inv.status}</span></td>
                      <td style={{ fontSize:12 }}>{new Date(inv.createdAt).toLocaleString('en-IN')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
      }
    </div>
  )
}
