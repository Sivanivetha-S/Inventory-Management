import React, { useEffect, useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../../context/AuthContext'
import { notificationAPI } from '../../services/api'
import {
  LayoutDashboard, Package, Users, FileText, BarChart3,
  Percent, Shield, LogOut, ChevronLeft, ChevronRight,
  Receipt, Layers, UserCog, Building2, Truck, Bell,
  Home, Settings,
} from 'lucide-react'
import './Sidebar.css'

// ── Nav definitions per role ────────────────────────────────────────────────
const ADMIN_SETTINGS = [
  { to:'/settings',         icon:Settings,         label:'Settings' },
]

const ADMIN_MAIN = [
  { to:'/dashboard',        icon:LayoutDashboard, label:'Dashboard' },
  { to:'/products',         icon:Package,          label:'Products' },
  { to:'/customers',        icon:Users,            label:'Customers' },
]
const ADMIN_OPS = [
  { to:'/billing',          icon:FileText,         label:'Billing' },
  { to:'/sales',            icon:BarChart3,        label:'Sales' },
  { to:'/discounts',        icon:Percent,          label:'Discounts' },
  { to:'/theft-detection',  icon:Shield,           label:'Theft Detection' },
  { to:'/inventory-verification', icon:Shield,       label:'Verification' },
  { to:'/product-returns',  icon:Receipt,          label:'Returns' },
]
const ADMIN_TEAM = [
  { to:'/staff',            icon:UserCog,          label:'Staff' },
  { to:'/suppliers',        icon:Building2,        label:'Suppliers' },
  { to:'/supply-requests',  icon:Truck,            label:'Supply Requests' },
  { to:'/batch-inventory',  icon:Layers,           label:'Batch Inventory' },
]

const STAFF_NAV = [
  { to:'/staff-dashboard',  icon:Home,     label:'Dashboard' },
  { to:'/billing',          icon:FileText, label:'Billing' },
  { to:'/products',         icon:Package,  label:'Products' },
  { to:'/customers',        icon:Users,    label:'Customers' },
  { to:'/inventory-verification', icon:Shield, label:'Verification' },
  { to:'/product-returns',  icon:Receipt,  label:'Returns' },
]

const SUPPLIER_NAV = [
  { to:'/supplier-dashboard', icon:Home,           label:'Dashboard' },
  { to:'/supply-requests',    icon:Truck,          label:'Supply Requests' },
  { to:'/supplier-returns',   icon:Receipt,        label:'Return Requests' },
]

const ADMIN_QUICK = [
  { to:'/billing',          icon:Receipt,          label:'New Bill' },
  { to:'/batch-inventory',  icon:Layers,           label:'Receive Stock' },
]
const STAFF_QUICK = [
  { to:'/billing', icon:Receipt, label:'New Bill' },
]

const navVariants = {
  hidden:  { opacity:0, x:-8 },
  visible: (i) => ({ opacity:1, x:0, transition:{ delay:i*.04, duration:.25, ease:[.4,0,.2,1] } }),
}

export default function Sidebar({ open, onToggle }) {
  const { user, role, logout } = useAuth()
  const navigate = useNavigate()
  const [unreadCount, setUnreadCount] = useState(0)

  // Only admins get notification polling
  useEffect(() => {
    if (role !== 'ADMIN') return
    const fetch = () => {
      notificationAPI.getUnreadCount()
        .then(r => setUnreadCount(r.data.data || 0))
        .catch(() => {})
    }
    fetch()
    const t = setInterval(fetch, 30000)
    return () => clearInterval(t)
  }, [role])

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  // ── Branded label based on role ────────────────────────────────────────────
  const brandSub =
    role === 'STAFF'    ? 'Staff Portal' :
    role === 'SUPPLIER' ? 'Supplier Portal' :
                          'Enterprise'

  const brandColor =
    role === 'STAFF'    ? 'linear-gradient(135deg,#00897B,#00BCD4)' :
    role === 'SUPPLIER' ? 'linear-gradient(135deg,#D97706,#FBBF24)' :
                          'linear-gradient(135deg,#4338CA,#6366F1)'

  // ── Render a nav link ───────────────────────────────────────────────────────
  const renderLink = (item, index) => (
    <motion.div key={item.to} custom={index} variants={navVariants} initial="hidden" animate="visible">
      <NavLink
        to={item.to}
        className={({ isActive }) => `sidebar__link ${isActive ? 'sidebar__link--active' : ''}`}
        title={!open ? item.label : undefined}
      >
        <span className="sidebar__link-icon-wrap">
          <item.icon size={18} strokeWidth={1.75} />
        </span>
        <AnimatePresence>
          {open && (
            <motion.span className="sidebar__link-label"
              initial={{ opacity:0, width:0 }}
              animate={{ opacity:1, width:'auto' }}
              exit={{ opacity:0, width:0 }}
              transition={{ duration:.2 }}>
              {item.label}
            </motion.span>
          )}
        </AnimatePresence>
        <span className="sidebar__link-indicator" />
      </NavLink>
    </motion.div>
  )

  // ── Notification link (admin only) with badge ───────────────────────────────
  const renderNotifLink = (index) => (
    <motion.div key="/notifications" custom={index} variants={navVariants} initial="hidden" animate="visible">
      <NavLink
        to="/notifications"
        className={({ isActive }) => `sidebar__link ${isActive ? 'sidebar__link--active' : ''}`}
        title={!open ? 'Notifications' : undefined}
      >
        <span className="sidebar__link-icon-wrap" style={{ position:'relative' }}>
          <Bell size={18} strokeWidth={1.75} />
          {unreadCount > 0 && (
            <span style={{
              position:'absolute', top:-4, right:-4,
              width:16, height:16, borderRadius:'50%',
              background:'var(--err)', color:'#fff',
              fontSize:9, fontWeight:700,
              display:'flex', alignItems:'center', justifyContent:'center',
              border:'1.5px solid var(--surface)',
            }}>
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </span>
        <AnimatePresence>
          {open && (
            <motion.span className="sidebar__link-label"
              initial={{ opacity:0, width:0 }}
              animate={{ opacity:1, width:'auto' }}
              exit={{ opacity:0, width:0 }}
              transition={{ duration:.2 }}
              style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flex:1 }}>
              <span>Notifications</span>
              {unreadCount > 0 && (
                <span style={{
                  background:'var(--err)', color:'#fff',
                  borderRadius:'var(--r-pill)', padding:'1px 7px',
                  fontSize:10, fontWeight:700, marginLeft:6,
                }}>
                  {unreadCount}
                </span>
              )}
            </motion.span>
          )}
        </AnimatePresence>
        <span className="sidebar__link-indicator" />
      </NavLink>
    </motion.div>
  )

  // ── Determine which nav + quick actions to show ─────────────────────────────
  const navGroups =
    role === 'STAFF'    ? [{
      label:'Navigation',
      items: STAFF_NAV.filter(item => {
        if (item.to === '/billing' && !user?.billingPermission) return false
        return true
      })
    }] :
    role === 'SUPPLIER' ? [{ label:'Navigation', items:SUPPLIER_NAV }] :
    [
      { label:'Main',           items:ADMIN_MAIN },
      { label:'Operations',     items:ADMIN_OPS  },
      { label:'Team & Supply',  items:ADMIN_TEAM },
      { label:'Settings',       items:ADMIN_SETTINGS },
    ]

  const quickActions =
    role === 'STAFF'    ? (user?.billingPermission ? STAFF_QUICK : []) :
    role === 'ADMIN'    ? ADMIN_QUICK : []

  let linkIndex = 0

  return (
    <motion.aside
      className={`sidebar ${open ? 'sidebar--open' : 'sidebar--closed'}`}
      animate={{ width: open ? 'var(--sidebar-width)' : 'var(--sidebar-collapsed)' }}
      transition={{ duration:.28, ease:[.4,0,.2,1] }}>

      {/* ── Header ── */}
      <div className="sidebar__header">
        <div className="sidebar__brand">
          <div className="sidebar__logo" style={{ background: brandColor }}>SI</div>
          <AnimatePresence>
            {open && (
              <motion.div className="sidebar__brand-text"
                initial={{ opacity:0, x:-8 }} animate={{ opacity:1, x:0 }}
                exit={{ opacity:0, x:-8 }} transition={{ duration:.2 }}>
                <div className="sidebar__brand-name">SmartInventory</div>
                <div className="sidebar__brand-sub">{brandSub}</div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <button className="sidebar__toggle" onClick={onToggle} aria-label="Toggle sidebar">
          {open ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
        </button>
      </div>

      {/* ── Profile card ── */}
      {user && (
        <div className="sidebar__profile">
          <div className="sidebar__avatar" style={{ background: brandColor }}>
            {(user.fullName || user.supplierName || user.companyName || '?')[0].toUpperCase()}
          </div>
          <AnimatePresence>
            {open && (
              <motion.div className="sidebar__admin-info"
                initial={{ opacity:0 }} animate={{ opacity:1 }}
                exit={{ opacity:0 }} transition={{ duration:.15 }}>
                <div className="sidebar__admin-name">
                  {user.fullName || user.supplierName || user.companyName}
                </div>
                <div className="sidebar__admin-shop">
                  {role === 'ADMIN'    ? user.shopName       :
                   role === 'STAFF'    ? user.adminName || 'Staff' :
                   role === 'SUPPLIER' ? user.companyName    : ''}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* ── Quick Actions (admin + staff only) ── */}
      {open && quickActions.length > 0 && (
        <div className="sidebar__quick">
          <p className="sidebar__section-label">Quick Actions</p>
          <div className="sidebar__quick-grid">
            {quickActions.map(({ to, icon:Icon, label }) => (
              <button key={to+label} className="sidebar__quick-btn"
                onClick={() => navigate(to)} title={label}>
                <Icon size={15} strokeWidth={1.75} />
                <span>{label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Navigation ── */}
      <nav className="sidebar__nav">
        {navGroups.map((group, gi) => (
          <React.Fragment key={group.label}>
            {gi > 0 && !open && <div className="sidebar__nav-divider" />}
            {open && <p className="sidebar__section-label">{group.label}</p>}
            {group.items.map((navItem) => {
              const el = renderLink(navItem, linkIndex)
              linkIndex++
              return el
            })}
          </React.Fragment>
        ))}

        {/* Notifications — admin only */}
        {role === 'ADMIN' && (
          <>
            {open && <p className="sidebar__section-label">System</p>}
            {!open && <div className="sidebar__nav-divider" />}
            {renderNotifLink(linkIndex++)}
          </>
        )}
      </nav>

      {/* ── Footer ── */}
      <div className="sidebar__footer">
        <button className="sidebar__logout" onClick={handleLogout}
          title={!open ? 'Logout' : undefined}>
          <LogOut size={18} strokeWidth={1.75} />
          {open && <span>Sign out</span>}
        </button>
      </div>
    </motion.aside>
  )
}
