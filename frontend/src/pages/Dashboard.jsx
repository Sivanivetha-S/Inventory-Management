import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import {
  Activity, AlertTriangle, ArrowRight, DollarSign, FileText,
  Package, Shield, Users, TrendingUp, Receipt, Plus,
} from 'lucide-react'
import { dashboardAPI } from '../services/api'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'
import './Dashboard.css'

const CHART_COLORS = ['#6366F1', '#818CF8', '#A5B4FC', '#059669', '#D97706', '#4F46E5']
const formatINR = (value) => `₹${Number(value || 0).toLocaleString('en-IN')}`

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06 } },
}

const item = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.4, 0, 0.2, 1] } },
}

const StatCard = ({ icon: Icon, tone, label, value, caption, featured }) => (
  <motion.div
    className={`stat-card stat-card--${tone} ${featured ? 'stat-card--featured' : ''}`}
    variants={item}
    whileHover={{ y: -4, transition: { duration: 0.2 } }}
  >
    <div className="stat-card__icon"><Icon size={20} strokeWidth={1.75} /></div>
    <div className="stat-card__body">
      <p className="stat-card__label">{label}</p>
      <h3 className="stat-card__value">{value}</h3>
      {caption && <span className="stat-card__caption">{caption}</span>}
    </div>
    <div className="stat-card__glow" />
  </motion.div>
)

const SkeletonGrid = () => (
  <div className="dashboard-skeleton">
    <div className="skeleton dashboard-skeleton__hero" />
    <div className="stats-grid">
      {[...Array(6)].map((_, i) => (
        <div key={i} className="skeleton stat-card-skeleton" />
      ))}
    </div>
    <div className="charts-row">
      <div className="skeleton chart-skeleton" />
      <div className="skeleton chart-skeleton" />
    </div>
  </div>
)

const chartTooltipStyle = {
  fontFamily: 'Inter, sans-serif',
  borderRadius: 12,
  background: '#FFFFFF',
  border: '1px solid #E2E8F0',
  color: '#0F172A',
  boxShadow: '0 8px 24px rgba(15,23,42,.08)',
  fontSize: 13,
  padding: '10px 14px',
}

export default function Dashboard() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()
  const { admin, activeBranchId } = useAuth()

  useEffect(() => {
    setLoading(true)
    setData(null)
    dashboardAPI.getData()
      .then((response) => setData(response.data.data))
      .catch(() => toast.error('Failed to load dashboard'))
      .finally(() => setLoading(false))
  }, [activeBranchId])

  if (loading) return <SkeletonGrid />
  if (!data) return <div className="empty-state"><p>No data available</p></div>

  const weeklyChartData = Object.entries(data.weeklySales || {}).map(([day, revenue]) => ({ day, revenue: Number(revenue) }))
  const monthlyChartData = Object.entries(data.monthlySales || {}).map(([month, revenue]) => ({ month, revenue: Number(revenue) }))

  return (
    <motion.div className="dashboard" variants={container} initial="hidden" animate="show">
      <motion.div className="dashboard-hero" variants={item}>
        <div className="dashboard-hero__text">
          <p className="dashboard-hero__greeting">Welcome back{admin?.fullName ? `, ${admin.fullName.split(' ')[0]}` : ''}</p>
          <h2 className="dashboard-hero__title">Here&apos;s your business overview</h2>
          <p className="dashboard-hero__sub">Track inventory, revenue, and alerts in real time.</p>
        </div>
        <div className="dashboard-hero__actions">
          <button className="dash-action-btn dash-action-btn--primary" onClick={() => navigate('/billing')}>
            <Receipt size={16} strokeWidth={1.75} /> New Bill
          </button>
          <button className="dash-action-btn" onClick={() => navigate('/products')}>
            <Plus size={16} strokeWidth={1.75} /> Add Product
          </button>
        </div>
      </motion.div>

      <div className="stats-grid stats-grid--asymmetric">
        <StatCard icon={DollarSign} tone="revenue" label="Total Revenue" value={formatINR(data.totalRevenue)} caption={`Today: ${formatINR(data.todayRevenue)}`} featured />
        <StatCard icon={Package} tone="products" label="Total Products" value={data.totalProducts} caption="Catalog items" />
        <StatCard icon={Users} tone="customers" label="Customers" value={data.totalCustomers} caption="Registered buyers" />
        <StatCard icon={FileText} tone="sales" label="Sales" value={data.totalSales} caption="Invoices generated" />
        <StatCard icon={Activity} tone="inventory" label="Low Stock" value={data.lowStockCount} caption="Items need restock" />
        <StatCard icon={Shield} tone="loss" label="Theft Alerts" value={data.theftAlertsCount} caption="Open alerts" />
      </div>

      <div className="charts-row">
        <motion.div className="card chart-card" variants={item}>
          <div className="chart-card__header">
            <div>
              <h3 className="chart-title">Weekly Revenue</h3>
              <p className="chart-subtitle">Last 7 days performance</p>
            </div>
            <TrendingUp size={18} strokeWidth={1.75} className="chart-card__icon" />
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={weeklyChartData}>
              <defs>
                <linearGradient id="weeklyRevenueFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366F1" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#6366F1" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
              <XAxis dataKey="day" tick={{ fontSize: 12, fill: '#64748B' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} />
              <Tooltip formatter={(value) => [formatINR(value), 'Revenue']} contentStyle={chartTooltipStyle} />
              <Area type="monotone" dataKey="revenue" stroke="#6366F1" strokeWidth={2} fill="url(#weeklyRevenueFill)" animationDuration={800} />
            </AreaChart>
          </ResponsiveContainer>
        </motion.div>

        <motion.div className="card chart-card" variants={item}>
          <div className="chart-card__header">
            <div>
              <h3 className="chart-title">Monthly Revenue</h3>
              <p className="chart-subtitle">Year-to-date breakdown</p>
            </div>
            <TrendingUp size={18} strokeWidth={1.75} className="chart-card__icon" />
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={monthlyChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#64748B' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} />
              <Tooltip formatter={(value) => [formatINR(value), 'Revenue']} contentStyle={chartTooltipStyle} />
              <Bar dataKey="revenue" radius={[8, 8, 0, 0]} animationDuration={800}>
                {monthlyChartData.map((_, index) => <Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </motion.div>
      </div>

      {/* Staff Billing Performance */}
      {data.staffStats?.length > 0 && (
        <motion.div className="card panel-card" variants={item} style={{ marginBottom: 24 }}>
          <div className="section-header">
            <div>
              <h3>Staff Performance</h3>
              <p className="panel-subtitle">Total bills and revenue generated by each staff member</p>
            </div>
            <button className="dash-link-btn" onClick={() => navigate('/staff')}>
              Manage Staff <ArrowRight size={14} strokeWidth={2} />
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
            {data.staffStats.map((s) => (
              <div key={s.name} className="card" style={{ display: 'flex', flexDirection: 'column', padding: 20, background: 'var(--slate-50)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                  <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--accent-lt)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Users size={16} style={{ color: 'var(--accent)' }} />
                  </div>
                  <div>
                    <h4 style={{ fontSize: 15, fontWeight: 700, margin: 0, color: 'var(--text-h)' }}>{s.name}</h4>
                    <span className="badge badge-primary">STAFF</span>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <span style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 600 }}>BILLS CREATED</span>
                    <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-h)', marginTop: 2 }}>{s.billsCreated}</div>
                  </div>
                  <div>
                    <span style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 600 }}>REVENUE</span>
                    <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--ok)', marginTop: 2 }}>{formatINR(s.revenue)}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      <div className="bottom-row">
        <motion.div className="card panel-card" variants={item}>
          <div className="section-header">
            <div>
              <h3>Low Stock Alerts</h3>
              <p className="panel-subtitle">{data.lowStockProducts?.length || 0} items below threshold</p>
            </div>
            <button className="dash-link-btn" onClick={() => navigate('/products')}>
              View All <ArrowRight size={14} strokeWidth={2} />
            </button>
          </div>
          {data.lowStockProducts?.length === 0
            ? <p className="empty-msg">No low stock products</p>
            : <div className="table-container">
                <table>
                  <thead><tr><th>Product</th><th>Category</th><th>Stock</th><th>Min</th></tr></thead>
                  <tbody>
                    {data.lowStockProducts.map((product) => (
                      <tr key={product.id}>
                        <td><strong>{product.name}</strong></td>
                        <td>{product.category}</td>
                        <td><span className="badge badge-danger">{product.currentStock}</span></td>
                        <td>{product.minimumStockAlert}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
          }
        </motion.div>

        <motion.div className="card panel-card" variants={item}>
          <div className="section-header">
            <div>
              <h3>Recent Bills</h3>
              <p className="panel-subtitle">Latest transactions</p>
            </div>
            <button className="dash-link-btn" onClick={() => navigate('/billing')}>
              View All <ArrowRight size={14} strokeWidth={2} />
            </button>
          </div>
          {data.recentBills?.length === 0
            ? <p className="empty-msg">No bills yet</p>
            : <div className="table-container">
                <table>
                  <thead><tr><th>Invoice</th><th>Customer</th><th>Amount</th></tr></thead>
                  <tbody>
                    {data.recentBills.map((bill) => (
                      <tr key={bill.id}>
                        <td><strong>{bill.invoiceNumber}</strong></td>
                        <td>{bill.customer?.name || 'Walk-in'}</td>
                        <td><span className="badge badge-primary">{formatINR(bill.totalAmount)}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
          }
        </motion.div>
      </div>

      {data.highRiskProducts?.length > 0 && (
        <motion.div className="card panel-card theft-alert-section" variants={item}>
          <div className="section-header">
            <div>
              <h3>🔥 High Risk Products</h3>
              <p className="panel-subtitle">Repeated theft alerts require immediate investigation</p>
            </div>
          </div>
          <div className="table-container">
            <table>
              <thead><tr><th>Product</th><th>Barcode</th><th>Branch</th><th>Theft Count</th><th>Missing</th><th>Last Detection</th><th>Risk</th></tr></thead>
              <tbody>{data.highRiskProducts.map((product) => (
                <tr key={`${product.productName}-${product.barcode}`}>
                  <td><strong>{product.productName}</strong></td><td>{product.barcode || '—'}</td><td>{product.branchName}</td>
                  <td>{product.theftCount}</td><td>{product.missingQuantity}</td><td>{product.lastDetectionDate || '—'}</td>
                  <td><span className="badge badge-danger">{product.riskLevel}</span></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </motion.div>
      )}

      {data.recentTheftAlerts?.length > 0 && (
        <motion.div className="card panel-card theft-alert-section" variants={item}>
          <div className="section-header">
            <div>
              <h3><AlertTriangle size={16} strokeWidth={1.75} /> Recent Theft Alerts</h3>
              <p className="panel-subtitle">Requires immediate attention</p>
            </div>
            <button className="dash-link-btn dash-link-btn--danger" onClick={() => navigate('/theft-detection')}>
              Investigate <ArrowRight size={14} strokeWidth={2} />
            </button>
          </div>
          <div className="table-container">
            <table>
              <thead><tr><th>Product</th><th>Expected</th><th>Actual</th><th>Missing</th><th>Loss Value</th><th>Date</th></tr></thead>
              <tbody>
                {data.recentTheftAlerts.map((alert) => (
                  <tr key={alert.id}>
                    <td><strong>{alert.productName}</strong></td>
                    <td>{alert.expectedStock}</td>
                    <td>{alert.actualStock}</td>
                    <td><span className="badge badge-danger">-{alert.missingQuantity}</span></td>
                    <td><span className="badge badge-warning">{formatINR(alert.lossValue)}</span></td>
                    <td>{alert.detectionDate}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}
    </motion.div>
  )
}
