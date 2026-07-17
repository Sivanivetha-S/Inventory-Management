import React, { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../../context/AuthContext'
import { useTheme, THEMES } from '../../context/ThemeContext'
import {
  Check, ChevronDown, Droplets, LogOut, Menu, Moon, Sun,
  Search, Bell, User, UserCog, Building2,
} from 'lucide-react'
import { branchAPI } from '../../services/api'
import './Topbar.css'

const PAGE_TITLES = {
  '/dashboard':          'Dashboard',
  '/staff-dashboard':    'Staff Dashboard',
  '/supplier-dashboard': 'Supplier Dashboard',
  '/products':           'Product Management',
  '/customers':          'Customer Management',
  '/billing':            'Billing',
  '/sales':              'Sales Management',
  '/discounts':          'Discount Management',
  '/theft-detection':    'Theft Detection',
  '/staff':              'Staff Management',
  '/suppliers':          'Suppliers',
  '/supply-requests':    'Supply Requests',
  '/batch-inventory':    'Batch Inventory',
  '/notifications':      'Notifications',
}

const ROLE_BADGE = {
  ADMIN:    { label:'Owner',    color:'#4F46E5', bg:'#EEF2FF', Icon: User },
  STAFF:    { label:'Staff',    color:'#00897B', bg:'#E0F2F1', Icon: UserCog },
  SUPPLIER: { label:'Supplier', color:'#D97706', bg:'#FEF3C7', Icon: Building2 },
}

const THEME_ICONS = { light: Sun, dark: Moon, blue: Droplets }

function ThemeSwitcher() {
  const { theme, setTheme } = useTheme()
  const [open, setOpen] = useState(false)
  const ref = useRef()
  const ActiveIcon = THEME_ICONS[theme] || Sun

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div className="theme-switcher" ref={ref}>
      <button className="topbar__icon-btn" onClick={() => setOpen(v => !v)}
        title="Switch theme" aria-haspopup="menu" aria-expanded={open}>
        <ActiveIcon size={18} strokeWidth={1.75} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div className="theme-switcher__dropdown" role="menu"
            initial={{ opacity:0, y:-8, scale:.96 }}
            animate={{ opacity:1, y:0, scale:1 }}
            exit={{ opacity:0, y:-8, scale:.96 }}
            transition={{ duration:.18 }}>
            <p className="theme-switcher__title">Appearance</p>
            {Object.entries(THEMES).map(([key, config]) => {
              const Icon = THEME_ICONS[key] || Sun
              return (
                <button key={key}
                  className={`theme-switcher__option ${theme === key ? 'active' : ''}`}
                  onClick={() => { setTheme(key); setOpen(false) }} role="menuitem">
                  <Icon size={16} strokeWidth={1.75} />
                  <span>
                    <span className="theme-switcher__option-label">{config.label}</span>
                    <span className="theme-switcher__option-desc">{config.description}</span>
                  </span>
                  {theme === key && <Check size={14} strokeWidth={2} className="theme-switcher__check" />}
                </button>
              )
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function BranchSelector() {
  const [branches, setBranches] = useState([])
  const { role, activeBranchId, switchBranch } = useAuth()

  useEffect(() => {
    if (role !== 'ADMIN') return
    const fetchBranches = async () => {
      try {
        const res = await branchAPI.getAll()
        if (res.data?.success) {
          const list = res.data.data || []
          setBranches(list)

          const stored = localStorage.getItem('si_active_branch_id')
          if (list.length > 0) {
            const isValid = list.some(b => String(b.id) === stored)
            if (!isValid) {
              switchBranch(String(list[0].id))
            }
          } else {
            if (stored !== 'all') {
              switchBranch('all')
            }
          }
        }
      } catch (err) {
        console.error(err)
      }
    }
    fetchBranches()
  }, [role, switchBranch])

  if (role !== 'ADMIN') return null

  const handleBranchChange = (e) => {
    const val = e.target.value
    switchBranch(val)
  }

  return (
    <div className="topbar__branch-selector" style={{ marginRight: 16 }}>
      <select
        value={activeBranchId || ''}
        onChange={handleBranchChange}
        style={{
          padding: '6px 12px',
          borderRadius: '8px',
          border: '1px solid var(--border)',
          background: 'var(--slate-50)',
          color: 'var(--text-1)',
          fontSize: '13px',
          fontWeight: 600,
          outline: 'none',
          cursor: 'pointer',
        }}
      >
        {branches.map(b => (
          <option key={b.id} value={b.id}>
            {b.name} ({b.code})
          </option>
        ))}
      </select>
    </div>
  )
}

function ProfileMenu({ user, role, onLogout }) {
  const [open, setOpen] = useState(false)
  const ref = useRef()
  const badge = ROLE_BADGE[role] || ROLE_BADGE.ADMIN
  const BadgeIcon = badge.Icon

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const displayName = user?.fullName || user?.supplierName || user?.companyName || 'User'
  const displaySub  =
    role === 'ADMIN'    ? (user?.shopName    || 'Shop Owner') :
    role === 'STAFF'    ? (user?.adminName   || 'Staff Member') :
    role === 'SUPPLIER' ? (user?.companyName || 'Supplier') : ''
  const initials = displayName?.[0]?.toUpperCase() || '?'

  return (
    <div className="topbar__profile-menu" ref={ref}>
      <button className="topbar__admin" onClick={() => setOpen(v => !v)}
        aria-haspopup="menu" aria-expanded={open}>
        <div className="topbar__avatar">{initials}</div>
        <div className="topbar__admin-info">
          <span className="topbar__admin-name">{displayName}</span>
          <span className="topbar__admin-role"
            style={{ color: badge.color, fontWeight:600, fontSize:10 }}>
            {badge.label}
          </span>
        </div>
        <ChevronDown size={14} className={`topbar__chevron ${open ? 'open' : ''}`} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div className="topbar__profile-dropdown"
            initial={{ opacity:0, y:-8, scale:.96 }}
            animate={{ opacity:1, y:0, scale:1 }}
            exit={{ opacity:0, y:-8, scale:.96 }}
            transition={{ duration:.18 }}>
            {/* Header */}
            <div className="topbar__profile-header">
              <div style={{ width:36, height:36, borderRadius:'50%', flexShrink:0,
                background:'var(--gradient-primary)', display:'flex', alignItems:'center',
                justifyContent:'center', color:'#fff', fontWeight:700, fontSize:14 }}>
                {initials}
              </div>
              <div>
                <span style={{ display:'block', fontSize:13, fontWeight:600, color:'var(--text-h)' }}>
                  {displayName}
                </span>
                <small style={{ color:'var(--text-3)', fontSize:11 }}>{displaySub}</small>
              </div>
            </div>
            {/* Role badge */}
            <div style={{ padding:'6px 10px 8px' }}>
              <span style={{
                display:'inline-flex', alignItems:'center', gap:5,
                background: badge.bg, color: badge.color,
                fontSize:11, fontWeight:700, padding:'3px 10px',
                borderRadius:'var(--r-pill)',
              }}>
                <BadgeIcon size={11} strokeWidth={2} /> {badge.label}
              </span>
            </div>
            <button className="topbar__profile-logout" onClick={onLogout}>
              <LogOut size={16} strokeWidth={1.75} />
              Sign out
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default function Topbar({ onMenuClick }) {
  const { user, role, logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [scrolled, setScrolled] = useState(false)
  const title = PAGE_TITLES[location.pathname] || 'Smart Inventory'

  useEffect(() => {
    const main = document.querySelector('.app-content')
    if (!main) return
    const onScroll = () => setScrolled(main.scrollTop > 8)
    main.addEventListener('scroll', onScroll)
    return () => main.removeEventListener('scroll', onScroll)
  }, [])

  const handleLogout = async () => { await logout(); navigate('/login') }

  return (
    <header className={`topbar ${scrolled ? 'topbar--scrolled' : ''}`}>
      <div className="topbar__left">
        <button className="topbar__menu-btn" onClick={onMenuClick} aria-label="Toggle menu">
          <Menu size={18} strokeWidth={1.75} />
        </button>
        <div className="topbar__titles">
          <h1 className="topbar__title">{title}</h1>
          <p className="topbar__date">
            {new Date().toLocaleDateString('en-IN', {
              weekday:'long', year:'numeric', month:'long', day:'numeric',
            })}
          </p>
        </div>
      </div>


      <div className="topbar__right">
        <BranchSelector />
        <ThemeSwitcher />
        <ProfileMenu user={user} role={role} onLogout={handleLogout} />
      </div>
    </header>
  )
}
