import React from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import {
  FiGrid, FiPackage, FiUsers, FiFileText, FiBarChart2,
  FiPercent, FiShield, FiLogOut, FiChevronLeft, FiChevronRight
} from 'react-icons/fi'
import './Sidebar.css'

const NAV_ITEMS = [
  { to: '/dashboard',       icon: FiGrid,      label: 'Dashboard' },
  { to: '/products',        icon: FiPackage,   label: 'Products' },
  { to: '/customers',       icon: FiUsers,     label: 'Customers' },
  { to: '/billing',         icon: FiFileText,  label: 'Billing' },
  { to: '/sales',           icon: FiBarChart2, label: 'Sales' },
  { to: '/discounts',       icon: FiPercent,   label: 'Discounts' },
  { to: '/theft-detection', icon: FiShield,    label: 'Theft Detection' },
]

export default function Sidebar({ open, onToggle }) {
  const { admin, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <aside className={`sidebar ${open ? 'sidebar--open' : 'sidebar--closed'}`}>
      {/* Header */}
      <div className="sidebar__header">
        {open && (
          <div className="sidebar__brand">
            <div className="sidebar__logo">SI</div>
            <div>
              <div className="sidebar__brand-name">SmartInventory</div>
              <div className="sidebar__brand-sub">Management System</div>
            </div>
          </div>
        )}
        <button className="sidebar__toggle" onClick={onToggle}>
          {open ? <FiChevronLeft /> : <FiChevronRight />}
        </button>
      </div>

      {/* Admin info */}
      {open && admin && (
        <div className="sidebar__admin">
          <div className="sidebar__avatar">{admin.fullName?.[0]?.toUpperCase()}</div>
          <div className="sidebar__admin-info">
            <div className="sidebar__admin-name">{admin.fullName}</div>
            <div className="sidebar__admin-shop">{admin.shopName}</div>
          </div>
        </div>
      )}

      {/* Nav */}
      <nav className="sidebar__nav">
        {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `sidebar__link ${isActive ? 'sidebar__link--active' : ''}`
            }
            title={!open ? label : undefined}
          >
            <Icon className="sidebar__link-icon" />
            {open && <span className="sidebar__link-label">{label}</span>}
            {open && <span className="sidebar__link-dot" />}
          </NavLink>
        ))}
      </nav>

      {/* Logout */}
      <div className="sidebar__footer">
        <button className="sidebar__logout" onClick={handleLogout} title={!open ? 'Logout' : undefined}>
          <FiLogOut />
          {open && <span>Logout</span>}
        </button>
      </div>
    </aside>
  )
}
