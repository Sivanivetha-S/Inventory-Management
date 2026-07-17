import React, { useEffect, useState, useCallback } from 'react'
import { invoiceAPI } from '../services/api'
import toast from 'react-hot-toast'
import { Search, X, Download, Calendar, Filter, FileText, DollarSign, Tag, BarChart3 } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import './Sales.css'

const today = () => new Date().toISOString().split('T')[0]
const monthStart = () => {
  const d = new Date(); d.setDate(1)
  return d.toISOString().split('T')[0]
}

export default function Sales() {
  const { activeBranchId } = useAuth()
  const [invoices, setInvoices]   = useState([])
  const [loading, setLoading]     = useState(true)
  const [search, setSearch]       = useState('')
  const [fromDate, setFromDate]   = useState(monthStart())
  const [toDate, setToDate]       = useState(today())
  const [filtered, setFiltered]   = useState([])
  const [totalRevenue, setTotalRevenue] = useState(0)
  const [totalDiscount, setTotalDiscount] = useState(0)

  const load = useCallback(() => {
    setInvoices([])
    setFiltered([])
    setLoading(true)
    invoiceAPI.getAll()
      .then(r => { setInvoices(r.data.data); applyFilter(r.data.data, fromDate, toDate, search) })
      .catch(() => toast.error('Failed to load sales'))
      .finally(() => setLoading(false))
  }, [activeBranchId])

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
      <div className="sales-stats-grid">
        {[
          { label:'Total Invoices',  value: filtered.length,                            icon: FileText,   cls:'indigo' },
          { label:'Total Revenue',   value:`₹${totalRevenue.toLocaleString('en-IN')}`,  icon: DollarSign, cls:'slate' },
          { label:'Total Discounts', value:`₹${totalDiscount.toLocaleString('en-IN')}`, icon: Tag,        cls:'amber' },
          { label:'Avg Order Value', value: filtered.length ? `₹${(totalRevenue/filtered.length).toLocaleString('en-IN',{maximumFractionDigits:0})}` : '₹0', icon: BarChart3, cls:'blue' },
        ].map(s => (
          <div key={s.label} className="sales-stat-card">
            <div className={`sales-stat-card__icon sales-stat-card__icon--${s.cls}`}>
              <s.icon size={20} strokeWidth={1.75} />
            </div>
            <div className="sales-stat-card__body">
              <p className="sales-stat-card__label">{s.label}</p>
              <h3 className="sales-stat-card__value">{s.value}</h3>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="sales-filter-bar">
        <div className="sales-filter-bar-inner">
          <div>
            <label className="form-label"><Calendar size={13} strokeWidth={1.75} style={{ marginRight:4, verticalAlign:'middle' }} />From Date</label>
            <input type="date" className="form-input" style={{ width:160 }} value={fromDate} onChange={e => setFromDate(e.target.value)} />
          </div>
          <div>
            <label className="form-label"><Calendar size={13} strokeWidth={1.75} style={{ marginRight:4, verticalAlign:'middle' }} />To Date</label>
            <input type="date" className="form-input" style={{ width:160 }} value={toDate} onChange={e => setToDate(e.target.value)} />
          </div>
          <div style={{ flex:1, minWidth:220 }}>
            <label className="form-label"><Search size={13} strokeWidth={1.75} style={{ marginRight:4, verticalAlign:'middle' }} />Search</label>
            <div className="search-bar">
              <Search size={15} />
              <input placeholder="Invoice # or customer name..." value={search} onChange={e => setSearch(e.target.value)} />
              {search && <button onClick={() => setSearch('')} style={{ background:'none',border:'none',cursor:'pointer',color:'var(--text-3)' }}><X size={14} /></button>}
            </div>
          </div>
          <button className="btn btn-secondary" onClick={() => { setSearch(''); setFromDate(monthStart()); setToDate(today()) }}>
            <Filter size={14} /> Reset
          </button>
          <button className="btn btn-primary" onClick={exportCSV} disabled={filtered.length === 0}>
            <Download size={14} /> Export CSV
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
