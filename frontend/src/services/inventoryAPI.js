/**
 * inventoryAPI — Live Database Data Fetcher for Chatbot
 *
 * Calls the existing authenticated REST API endpoints and formats
 * the data into readable markdown strings for the chatbot to display.
 *
 * All functions return { text: string, data: any } where:
 *   - text  is the formatted markdown response for the chat bubble
 *   - data  is raw data optionally passed to Gemini for AI narration
 *
 * Uses the existing api.js axios instance (JWT-authenticated).
 */

import {
  productAPI,
  invoiceAPI,
  theftAPI,
  damageAPI,
  dashboardAPI,
  notificationAPI,
  batchAPI,
  supplyRequestAPI,
  customerAPI,
} from './api'

const INR = (v) => `₹${Number(v || 0).toLocaleString('en-IN')}`
const pct = (a, b) => b > 0 ? (((a - b) / b) * 100).toFixed(1) : null
const today = () => new Date().toISOString().split('T')[0]
const daysAgo = (n) => {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().split('T')[0]
}

// ── 1. Inventory Summary ─────────────────────────────────────────────────────
export async function getInventorySummary() {
  try {
    const res = await dashboardAPI.getData()
    const d   = res.data?.data || res.data
    const lines = [
      `📦 **Inventory Summary**`,
      ``,
      `• Total Products: **${d.totalProducts}**`,
      `• Total Customers: **${d.totalCustomers}**`,
      `• Total Invoices: **${d.totalSales}**`,
      `• Today's Revenue: **${INR(d.todayRevenue)}**`,
      `• Total Revenue: **${INR(d.totalRevenue)}**`,
      `• Low Stock Alerts: **${d.lowStockCount}**`,
      `• Theft Alerts (open): **${d.theftAlertsCount}**`,
    ]
    return { text: lines.join('\n'), data: d }
  } catch (err) {
    return { text: `⚠️ Could not fetch inventory summary: ${err.message}`, data: null }
  }
}

// ── 2. Low Stock Products ────────────────────────────────────────────────────
export async function getLowStockSummary() {
  try {
    const res      = await productAPI.getLowStock()
    const products = res.data?.data || res.data || []
    if (!products.length) {
      return { text: `✅ All products are well-stocked! No low stock alerts.`, data: [] }
    }
    const lines = [
      `⚠️ **${products.length} Products Below Minimum Stock Level:**`,
      ``,
    ]
    products.forEach(p => {
      lines.push(`• **${p.name}** — ${p.currentStock} units (min: ${p.minimumStock || p.minStock || '—'})`)
    })
    lines.push(``, `💡 Consider restocking these products soon.`)
    return { text: lines.join('\n'), data: products }
  } catch (err) {
    return { text: `⚠️ Could not fetch low stock data: ${err.message}`, data: null }
  }
}

// ── 3. Out of Stock Products ─────────────────────────────────────────────────
export async function getOutOfStockSummary() {
  try {
    const res      = await productAPI.getAll()
    const products = res.data?.data || res.data || []
    const oos      = products.filter(p => (p.currentStock ?? p.stock ?? 0) <= 0)
    if (!oos.length) {
      return { text: `✅ No products are currently out of stock!`, data: [] }
    }
    const lines = [`❌ **${oos.length} Products Are Out of Stock:**`, ``]
    oos.forEach(p => lines.push(`• **${p.name}** (${p.category || 'N/A'})`))
    return { text: lines.join('\n'), data: oos }
  } catch (err) {
    return { text: `⚠️ Could not fetch stock data: ${err.message}`, data: null }
  }
}

// ── 4. Product Search ────────────────────────────────────────────────────────
export async function searchProduct(query) {
  try {
    const res      = await productAPI.search(query)
    const products = res.data?.data || res.data || []
    if (!products.length) {
      return { text: `🔍 No products found matching "**${query}**".`, data: [] }
    }
    const lines = [`🔍 **Search Results for "${query}":**`, ``]
    products.slice(0, 5).forEach(p => {
      const stock  = p.currentStock ?? p.stock ?? 0
      const status = stock <= 0 ? '❌ Out of Stock' : stock < (p.minimumStock || p.minStock || 10) ? '⚠️ Low Stock' : '✅ In Stock'
      lines.push(
        `• **${p.name}** (${p.category || 'N/A'})`,
        `  Stock: ${stock} units | Price: ${INR(p.sellingPrice)} | ${status}`,
      )
    })
    return { text: lines.join('\n'), data: products }
  } catch (err) {
    return { text: `⚠️ Could not search products: ${err.message}`, data: null }
  }
}

// ── 5. Today's Sales ─────────────────────────────────────────────────────────
export async function getTodaysSales() {
  try {
    const td  = today()
    const res = await invoiceAPI.getReport(td, td)
    const r   = res.data?.data || res.data
    const lines = [
      `📊 **Today's Sales — ${new Date().toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' })}**`,
      ``,
      `• Revenue: **${INR(r.totalRevenue)}**`,
      `• Total Invoices: **${r.totalInvoices}**`,
      `• Avg Order Value: **${INR(r.averageOrderValue)}**`,
      `• Total Discounts: **${INR(r.totalDiscount)}**`,
    ]
    if (r.topProducts?.length) {
      lines.push(``, `🏆 **Today's Top Products:**`)
      r.topProducts.slice(0, 3).forEach((p, i) =>
        lines.push(`  ${i + 1}. ${p.name} — ${p.quantitySold} units`)
      )
    }
    return { text: lines.join('\n'), data: r }
  } catch (err) {
    return { text: `📊 No sales recorded today yet, or data unavailable.`, data: null }
  }
}

// ── 6. Weekly Sales ──────────────────────────────────────────────────────────
export async function getWeeklySales() {
  try {
    const res   = await invoiceAPI.getReport(daysAgo(7), today())
    const r     = res.data?.data || res.data
    // Compare with previous week
    const prevRes = await invoiceAPI.getReport(daysAgo(14), daysAgo(8))
    const prev  = prevRes.data?.data || prevRes.data
    const trend = pct(r.totalRevenue, prev.totalRevenue)
    const trendText = trend !== null
      ? (parseFloat(trend) >= 0 ? `📈 Up ${trend}%` : `📉 Down ${Math.abs(trend)}%`)
      : ''
    const lines = [
      `📊 **Weekly Sales (Last 7 Days)**`,
      ``,
      `• Revenue: **${INR(r.totalRevenue)}** ${trendText}`,
      `• Total Invoices: **${r.totalInvoices}**`,
      `• Avg Order Value: **${INR(r.averageOrderValue)}**`,
      `• Total Discounts: **${INR(r.totalDiscount)}**`,
    ]
    if (r.topProducts?.length) {
      lines.push(``, `🏆 **This Week's Top Products:**`)
      r.topProducts.slice(0, 3).forEach((p, i) =>
        lines.push(`  ${i + 1}. ${p.name} — ${p.quantitySold} units`)
      )
    }
    return { text: lines.join('\n'), data: r }
  } catch (err) {
    return { text: `⚠️ Could not fetch weekly sales: ${err.message}`, data: null }
  }
}

// ── 7. Monthly Sales ─────────────────────────────────────────────────────────
export async function getMonthlySales() {
  try {
    const res  = await invoiceAPI.getReport(daysAgo(30), today())
    const r    = res.data?.data || res.data
    const prevRes = await invoiceAPI.getReport(daysAgo(60), daysAgo(31))
    const prev = prevRes.data?.data || prevRes.data
    const trend = pct(r.totalRevenue, prev.totalRevenue)
    const trendText = trend !== null
      ? (parseFloat(trend) >= 0 ? `📈 Up ${trend}% vs last month` : `📉 Down ${Math.abs(trend)}% vs last month`)
      : ''
    const lines = [
      `📊 **Monthly Sales (Last 30 Days)**`,
      ``,
      `• Revenue: **${INR(r.totalRevenue)}** ${trendText}`,
      `• Total Invoices: **${r.totalInvoices}**`,
      `• Avg Order Value: **${INR(r.averageOrderValue)}**`,
      `• Total Discounts: **${INR(r.totalDiscount)}**`,
    ]
    if (r.topProducts?.length) {
      lines.push(``, `🏆 **Top Products This Month:**`)
      r.topProducts.slice(0, 5).forEach((p, i) =>
        lines.push(`  ${i + 1}. ${p.name} — ${p.quantitySold} units`)
      )
    }
    return { text: lines.join('\n'), data: r }
  } catch (err) {
    return { text: `⚠️ Could not fetch monthly sales: ${err.message}`, data: null }
  }
}

// ── 8. Top Selling Products ──────────────────────────────────────────────────
export async function getTopProducts() {
  try {
    const res = await invoiceAPI.getReport(daysAgo(30), today())
    const r   = res.data?.data || res.data
    const products = r.topProducts || []
    if (!products.length) {
      return { text: `📊 No sales data available for the last 30 days.`, data: [] }
    }
    const lines = [`🏆 **Top Selling Products (Last 30 Days):**`, ``]
    products.slice(0, 8).forEach((p, i) => {
      lines.push(`${i + 1}. **${p.name}** — ${p.quantitySold} units | Revenue: ${INR(p.revenue)}`)
    })
    return { text: lines.join('\n'), data: products }
  } catch (err) {
    return { text: `⚠️ Could not fetch top products: ${err.message}`, data: null }
  }
}

// ── 9. Least Selling Products ────────────────────────────────────────────────
export async function getLeastProducts() {
  try {
    const res = await invoiceAPI.getReport(daysAgo(30), today())
    const r   = res.data?.data || res.data
    const products = [...(r.topProducts || [])].reverse()
    if (!products.length) {
      return { text: `📊 No sales data available for the last 30 days.`, data: [] }
    }
    const lines = [`📉 **Slowest Moving Products (Last 30 Days):**`, ``]
    products.slice(0, 5).forEach((p, i) => {
      lines.push(`${i + 1}. **${p.name}** — only ${p.quantitySold} units sold`)
    })
    lines.push(``, `💡 Consider promotions or discounts on these products.`)
    return { text: lines.join('\n'), data: products }
  } catch (err) {
    return { text: `⚠️ Could not fetch sales data: ${err.message}`, data: null }
  }
}

// ── 10. Expiring Products ────────────────────────────────────────────────────
export async function getExpiringProducts() {
  try {
    const res     = await batchAPI.getAll()
    const batches = res.data?.data || res.data || []
    const cutoff  = new Date()
    cutoff.setDate(cutoff.getDate() + 30)
    const expiring = batches.filter(b => {
      if (!b.expiryDate || b.quantityRemaining <= 0) return false
      return new Date(b.expiryDate) <= cutoff
    }).sort((a, b) => new Date(a.expiryDate) - new Date(b.expiryDate))

    if (!expiring.length) {
      return { text: `✅ No products expiring within the next 30 days.`, data: [] }
    }
    const lines = [
      `⏰ **${expiring.length} Product Batches Expiring Within 30 Days:**`, ``
    ]
    expiring.slice(0, 8).forEach(b => {
      const daysLeft = Math.ceil((new Date(b.expiryDate) - new Date()) / (1000 * 60 * 60 * 24))
      const urgency  = daysLeft <= 7 ? '🔴' : daysLeft <= 14 ? '🟡' : '🟢'
      lines.push(
        `${urgency} **${b.productName || b.product?.name}** — Batch ${b.batchNumber}`,
        `  Qty: ${b.quantityRemaining} | Expires: ${new Date(b.expiryDate).toLocaleDateString('en-IN')} (${daysLeft} days)`,
      )
    })
    lines.push(``, `💡 Consider selling these products first to minimize losses.`)
    return { text: lines.join('\n'), data: expiring }
  } catch (err) {
    return { text: `⚠️ Could not fetch batch data: ${err.message}`, data: null }
  }
}

// ── 11. Theft Alerts ─────────────────────────────────────────────────────────
export async function getTheftAlerts() {
  try {
    const res     = await theftAPI.getAll()
    const records = res.data?.data || res.data || []
    const open    = records.filter(r => r.status === 'DETECTED')
    if (!records.length) {
      return { text: `✅ No theft or stock loss records found.`, data: [] }
    }
    const lines = [
      `🔴 **Theft & Stock Loss Alerts**`,
      ``,
      `• Total Records: **${records.length}**`,
      `• Open / Unresolved: **${open.length}**`,
      ``,
    ]
    open.slice(0, 5).forEach(r => {
      lines.push(
        `⚠️ **${r.productName}** — Loss: ${r.unexplainedLoss ?? r.missingQuantity} units`,
        `  Date: ${new Date(r.verificationDate || r.createdAt).toLocaleDateString('en-IN')} | Value: ${INR(r.lossValue)}`,
      )
    })
    if (open.length > 5) lines.push(`... and ${open.length - 5} more.`)
    return { text: lines.join('\n'), data: records }
  } catch (err) {
    return { text: `⚠️ Could not fetch theft records: ${err.message}`, data: null }
  }
}

// ── 12. Damage Records ───────────────────────────────────────────────────────
export async function getDamageRecords() {
  try {
    const td  = today()
    const res = await damageAPI.getByDate(td)
    const all = await damageAPI.getAll()
    const todayRecs  = res.data?.data || res.data || []
    const allRecs    = all.data?.data || all.data || []
    const lines = [
      `🛠️ **Damage Records**`,
      ``,
      `• Total Records: **${allRecs.length}**`,
      `• Today's Damage Entries: **${todayRecs.length}**`,
    ]
    if (todayRecs.length) {
      lines.push(``, `📋 Today's Entries:`)
      todayRecs.forEach(d =>
        lines.push(`• **${d.productName}** — ${d.quantity} units (${d.reason})`)
      )
    }
    return { text: lines.join('\n'), data: { today: todayRecs, all: allRecs } }
  } catch (err) {
    return { text: `⚠️ Could not fetch damage records: ${err.message}`, data: null }
  }
}

// ── 13. Pending Supply Requests ──────────────────────────────────────────────
export async function getPendingRequests() {
  try {
    const res      = await supplyRequestAPI.getAll()
    const requests = res.data?.data || res.data || []
    const pending  = requests.filter(r => r.status === 'PENDING')
    if (!pending.length) {
      return { text: `✅ No pending supply requests at this time.`, data: [] }
    }
    const lines = [`📋 **${pending.length} Pending Supply Requests:**`, ``]
    pending.slice(0, 5).forEach(r => {
      lines.push(
        `• **${r.productName}** — Qty: ${r.requestedQuantity}`,
        `  Supplier: ${r.supplierName || 'N/A'} | Date: ${new Date(r.createdAt).toLocaleDateString('en-IN')}`,
      )
    })
    return { text: lines.join('\n'), data: pending }
  } catch (err) {
    return { text: `⚠️ Could not fetch supply requests: ${err.message}`, data: null }
  }
}

// ── 14. Notifications Summary ────────────────────────────────────────────────
export async function getNotificationsSummary() {
  try {
    const res   = await notificationAPI.getUnread()
    const notifs = res.data?.data || res.data || []
    if (!notifs.length) {
      return { text: `🔔 No unread notifications! You're all caught up.`, data: [] }
    }
    const lines = [`🔔 **${notifs.length} Unread Notifications:**`, ``]
    notifs.slice(0, 5).forEach(n => {
      lines.push(`• **${n.title || n.type}** — ${n.message || n.body || ''}`)
    })
    if (notifs.length > 5) lines.push(`... and ${notifs.length - 5} more unread.`)
    return { text: lines.join('\n'), data: notifs }
  } catch (err) {
    return { text: `⚠️ Could not fetch notifications: ${err.message}`, data: null }
  }
}

// ── 15. Customers Summary ────────────────────────────────────────────────────
export async function getCustomersSummary() {
  try {
    const res       = await customerAPI.getAll()
    const customers = res.data?.data || res.data || []
    const verified  = customers.filter(c => c.emailVerified)
    const lines = [
      `👥 **Customers Summary**`,
      ``,
      `• Total Customers: **${customers.length}**`,
      `• Verified (email): **${verified.length}**`,
      `• Walk-in / Unverified: **${customers.length - verified.length}**`,
    ]
    return { text: lines.join('\n'), data: customers }
  } catch (err) {
    return { text: `⚠️ Could not fetch customer data: ${err.message}`, data: null }
  }
}

// ── 16. Demand Forecast Data (raw data for Gemini to narrate) ────────────────
export async function getDemandForecastData() {
  try {
    const [productsRes, salesRes] = await Promise.all([
      productAPI.getAll(),
      invoiceAPI.getReport(daysAgo(30), today()),
    ])
    const products   = productsRes.data?.data || productsRes.data || []
    const salesData  = salesRes.data?.data || salesRes.data
    const topSellers = salesData?.topProducts || []

    // Build velocity map: productName → avg daily qty sold
    const velocityMap = {}
    topSellers.forEach(p => {
      velocityMap[p.name?.toLowerCase()] = (p.quantitySold || 0) / 30
    })

    // Match products with velocity and estimate days left
    const forecasts = products
      .filter(p => (p.currentStock ?? 0) > 0)
      .map(p => {
        const vel  = velocityMap[p.name?.toLowerCase()] || 0
        const days = vel > 0 ? Math.floor((p.currentStock ?? 0) / vel) : null
        return {
          name:         p.name,
          stock:        p.currentStock ?? 0,
          minStock:     p.minimumStock || p.minStock || 0,
          dailyVelocity: parseFloat(vel.toFixed(2)),
          daysLeft:     days,
          reorderQty:   vel > 0 ? Math.ceil(vel * 30) : null,
        }
      })
      .sort((a, b) => {
        if (a.daysLeft === null && b.daysLeft === null) return 0
        if (a.daysLeft === null) return 1
        if (b.daysLeft === null) return -1
        return a.daysLeft - b.daysLeft
      })

    return { forecasts, topSellers }
  } catch (err) {
    return null
  }
}

// ── 17. Help text ────────────────────────────────────────────────────────────
export function getHelpText() {
  return {
    text: [
      `🤖 **Smart Inventory AI Assistant — What I Can Do:**`,
      ``,
      `📦 **Inventory Queries**`,
      `• "Show inventory summary"`,
      `• "Which products are low in stock?"`,
      `• "Show out of stock products"`,
      `• "Search [product name]"`,
      ``,
      `📊 **Sales & Revenue**`,
      `• "Show today's sales"`,
      `• "Show weekly sales"`,
      `• "Show monthly sales"`,
      `• "Top selling products"`,
      `• "Slow moving products"`,
      ``,
      `🔮 **AI Analysis**`,
      `• "Predict which products will run out soon"`,
      `• "Generate description for [product name]"`,
      ``,
      `⚠️ **Alerts & Records**`,
      `• "Show theft alerts"`,
      `• "Show expiring products"`,
      `• "Show damage records"`,
      `• "Show pending supply requests"`,
      `• "Show notifications"`,
      ``,
      `🎤 **Voice** — Click the microphone button to speak your question!`,
    ].join('\n'),
    data: null,
  }
}
