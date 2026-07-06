import React, { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useTheme, THEMES } from '../../context/ThemeContext'
import { FiCheck, FiChevronDown, FiDroplet, FiLogOut, FiMenu, FiMoon, FiSun } from 'react-icons/fi'
import './Topbar.css'

const PAGE_TITLES = {
  '/dashboard': 'Dashboard',
  '/products': 'Product Management',
  '/customers': 'Customer Management',
  '/billing': 'Billing',
  '/sales': 'Sales Management',
  '/discounts': 'Discount Management',
  '/theft-detection': 'Theft Detection',
}

const THEME_ICONS = {
  light: FiSun,
  dark: FiMoon,
  blue: FiDroplet,
}

function ThemeSwitcher() {
  const { theme, setTheme } = useTheme()
  const [open, setOpen] = useState(false)
  const ref = useRef()
  const ActiveIcon = THEME_ICONS[theme] || FiSun

  useEffect(() => {
    const handler = (event) => {
      if (ref.current && !ref.current.contains(event.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div className="theme-switcher" ref={ref}>
      <button
        className="theme-switcher__btn"
        onClick={() => setOpen((value) => !value)}
        title="Switch Theme"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <ActiveIcon className="theme-switcher__icon" />
        <span className="theme-switcher__label">{THEMES[theme]?.label}</span>
        <FiChevronDown className="theme-switcher__arrow" />
      </button>

      {open && (
        <div className="theme-switcher__dropdown" role="menu">
          <p className="theme-switcher__title">Choose Theme</p>
          {Object.entries(THEMES).map(([key, config]) => {
            const ThemeIcon = THEME_ICONS[key] || FiSun
            return (
              <button
                key={key}
                className={`theme-switcher__option ${theme === key ? 'active' : ''}`}
                onClick={() => { setTheme(key); setOpen(false) }}
                role="menuitem"
              >
                <ThemeIcon className="theme-switcher__option-icon" />
                <span>
                  <span className="theme-switcher__option-label">{config.label}</span>
                  <span className="theme-switcher__option-desc">{config.description}</span>
                </span>
                {theme === key && <FiCheck className="theme-switcher__check" />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default function Topbar({ onMenuClick }) {
  const { admin, logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const title = PAGE_TITLES[location.pathname] || 'Smart Inventory'

  return (
    <header className="topbar">
      <div className="topbar__left">
        <button className="topbar__menu-btn" onClick={onMenuClick} title="Toggle menu">
          <FiMenu />
        </button>
        <div>
          <h1 className="topbar__title">{title}</h1>
          <p className="topbar__date">
            {new Date().toLocaleDateString('en-IN', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </p>
        </div>
      </div>

      <div className="topbar__right">
        <ThemeSwitcher />
        <div className="topbar__admin">
          <div className="topbar__avatar">{admin?.fullName?.[0]?.toUpperCase()}</div>
          <div className="topbar__admin-info">
            <span className="topbar__admin-name">{admin?.fullName}</span>
            <span className="topbar__admin-role">Shop Owner</span>
          </div>
        </div>
        <button
          className="topbar__logout-btn"
          onClick={() => { logout(); navigate('/login') }}
          title="Logout"
        >
          <FiLogOut />
        </button>
      </div>
    </header>
  )
}
