import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { dashboardAPI } from '../services/api'
import { FiActivity, FiAlertTriangle, FiArrowRight, FiDollarSign, FiFileText, FiPackage, FiShield, FiUsers } from 'react-icons/fi'
import toast from 'react-hot-toast'
import './Dashboard.css'

const CHART_COLORS = ['var(--primary)', 'var(--accent)', 'var(--primary-light)', 'var(--success)', 'var(--warning)', 'var(--primary-dark)']

const formatINR = (value) => `INR ${Number(value || 0).toLocaleString('en-IN')}`

const StatCard = ({ icon: Icon, tone, label, value, caption }) => (
  <div className={`stat-card stat-card--${tone}`}>
    <div className="stat-card__icon"><Icon /></div>
    <div className="stat-card__body">
      <p className="stat-card__label">{label}</p>
      <h3 className="stat-card__value">{value}</h3>
      {caption && <span className="stat-card__caption">{caption}</span>}
    </div>
  </div>
)

const chartTooltipStyle = {
  fontFamily: '"Segoe UI", Inter, sans-serif',
  borderRadius: 10,
  background: 'var(--bg-modal)',
  border: '1px solid var(--border)',
  color: 'var(--text-primary)',
  boxShadow: 'var(--shadow-md)',
}

export default function Dashboard() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    dashboardAPI.getData()
      .then((response) => setData(response.data.data))
      .catch(() => toast.error('Failed to load dashboard'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="loading-center"><div className="spinner" /><p>Loading dashboard...</p></div>
  if (!data) return <div className="empty-state"><p>No data available</p></div>

  const weeklyChartData = Object.entries(data.weeklySales || {}).map(([day, revenue]) => ({ day, revenue: Number(revenue) }))
  const monthlyChartData = Object.entries(data.monthlySales || {}).map(([month, revenue]) => ({ month, revenue: Number(revenue) }))

  return (
    <div className="dashboard animate-fade-in">
      <div className="stats-grid">
        <StatCard icon={FiPackage} tone="products" label="Total Products" value={data.totalProducts} caption="Catalog items" />
        <StatCard icon={FiUsers} tone="customers" label="Customers" value={data.totalCustomers} caption="Registered buyers" />
        <StatCard icon={FiFileText} tone="sales" label="Sales" value={data.totalSales} caption="Invoices generated" />
        <StatCard icon={FiActivity} tone="inventory" label="Inventory Status" value={data.lowStockCount} caption="Low stock items" />
        <StatCard icon={FiShield} tone="loss" label="Inventory Loss" value={data.theftAlertsCount} caption="Open alerts" />
        <StatCard icon={FiDollarSign} tone="revenue" label="Revenue" value={formatINR(data.totalRevenue)} caption={`Today: ${formatINR(data.todayRevenue)}`} />
      </div>

      <div className="charts-row">
        <div className="card chart-card">
          <h3 className="chart-title">Weekly Revenue</h3>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={weeklyChartData}>
              <defs>
                <linearGradient id="weeklyRevenueFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.24} />
                  <stop offset="95%" stopColor="var(--primary)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="day" tick={{ fontSize: 12, fill: 'var(--text-muted)', fontFamily: 'Segoe UI, sans-serif' }} axisLine={{ stroke: 'var(--border)' }} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)', fontFamily: 'Segoe UI, sans-serif' }} axisLine={{ stroke: 'var(--border)' }} tickLine={false} />
              <Tooltip formatter={(value) => [formatINR(value), 'Revenue']} contentStyle={chartTooltipStyle} />
              <Area type="monotone" dataKey="revenue" stroke="var(--primary)" strokeWidth={2.5} fill="url(#weeklyRevenueFill)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="card chart-card">
          <h3 className="chart-title">Monthly Revenue</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={monthlyChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: 'var(--text-muted)', fontFamily: 'Segoe UI, sans-serif' }} axisLine={{ stroke: 'var(--border)' }} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)', fontFamily: 'Segoe UI, sans-serif' }} axisLine={{ stroke: 'var(--border)' }} tickLine={false} />
              <Tooltip formatter={(value) => [formatINR(value), 'Revenue']} contentStyle={chartTooltipStyle} />
              <Bar dataKey="revenue" radius={[7, 7, 0, 0]}>
                {monthlyChartData.map((_, index) => <Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bottom-row">
        <div className="card">
          <div className="section-header">
            <h3>Low Stock Alerts</h3>
            <button className="btn btn-sm btn-secondary" onClick={() => navigate('/products')}>View All <FiArrowRight /></button>
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
        </div>

        <div className="card">
          <div className="section-header">
            <h3>Recent Bills</h3>
            <button className="btn btn-sm btn-secondary" onClick={() => navigate('/billing')}>View All <FiArrowRight /></button>
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
        </div>
      </div>

      {data.recentTheftAlerts?.length > 0 && (
        <div className="card theft-alert-section">
          <div className="section-header">
            <h3>Recent Theft Alerts</h3>
            <button className="btn btn-sm btn-danger" onClick={() => navigate('/theft-detection')}>Investigate <FiArrowRight /></button>
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
        </div>
      )}
    </div>
  )
}
