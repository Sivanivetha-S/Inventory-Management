import React, { createContext, useCallback, useContext, useEffect, useState } from 'react'

const ThemeContext = createContext(null)

export const THEMES = {
  light: {
    label: 'Light',
    description: 'Bright workspace',
    vars: {
      '--bg-base': '#f5f7fb',
      '--bg-raised': '#ffffff',
      '--bg-overlay': '#f8fafc',
      '--bg-card': '#ffffff',
      '--bg-card-hv': '#f8fafc',
      '--bg-modal': '#ffffff',
      '--text-primary': '#172033',
      '--text-secondary': '#526078',
      '--text-muted': '#8290a6',
      '--text-disabled': '#aeb8c8',
      '--border': 'rgba(23, 32, 51, 0.09)',
      '--border-md': 'rgba(108, 92, 231, 0.2)',
      '--border-lg': 'rgba(108, 92, 231, 0.36)',
      '--primary': '#6c5ce7',
      '--primary-dark': '#5a4bd1',
      '--primary-light': '#8b80f9',
      '--primary-faint': 'rgba(108, 92, 231, 0.11)',
      '--primary-glow': 'transparent',
      '--accent': '#0f766e',
      '--accent-dark': '#115e59',
      '--accent-faint': 'rgba(15, 118, 110, 0.11)',
      '--success': '#0f766e',
      '--success-bg': 'rgba(15, 118, 110, 0.09)',
      '--success-bdr': 'rgba(15, 118, 110, 0.2)',
      '--warning': '#b45309',
      '--warning-bg': 'rgba(180, 83, 9, 0.09)',
      '--warning-bdr': 'rgba(180, 83, 9, 0.2)',
      '--danger': '#dc2626',
      '--danger-bg': 'rgba(220, 38, 38, 0.08)',
      '--danger-bdr': 'rgba(220, 38, 38, 0.2)',
      '--shadow-sm': '0 1px 2px rgba(15, 23, 42, 0.06)',
      '--shadow-md': '0 8px 20px rgba(15, 23, 42, 0.08)',
      '--shadow-lg': '0 16px 36px rgba(15, 23, 42, 0.12)',
      '--shadow-xl': '0 24px 56px rgba(15, 23, 42, 0.18)',
      '--gradient-primary': 'linear-gradient(135deg,#5a4bd1,#6c5ce7)',
    },
  },
  dark: {
    label: 'Dark',
    description: 'Low-light workspace',
    vars: {
      '--bg-base': '#101522',
      '--bg-raised': '#151b2a',
      '--bg-overlay': '#1b2334',
      '--bg-card': '#182132',
      '--bg-card-hv': '#1f2a3d',
      '--bg-modal': '#182132',
      '--text-primary': '#eef3fb',
      '--text-secondary': '#b0bdd0',
      '--text-muted': '#748297',
      '--text-disabled': '#536073',
      '--border': 'rgba(238, 243, 251, 0.08)',
      '--border-md': 'rgba(108, 92, 231, 0.24)',
      '--border-lg': 'rgba(108, 92, 231, 0.42)',
      '--primary': '#7c6dff',
      '--primary-dark': '#5e50e0',
      '--primary-light': '#a99bff',
      '--primary-faint': 'rgba(124, 109, 255, 0.12)',
      '--primary-glow': 'transparent',
      '--accent': '#14b8a6',
      '--accent-dark': '#0f766e',
      '--accent-faint': 'rgba(20, 184, 166, 0.12)',
      '--success': '#34d399',
      '--success-bg': 'rgba(52, 211, 153, 0.12)',
      '--success-bdr': 'rgba(52, 211, 153, 0.25)',
      '--warning': '#fbbf24',
      '--warning-bg': 'rgba(251, 191, 36, 0.12)',
      '--warning-bdr': 'rgba(251, 191, 36, 0.25)',
      '--danger': '#f87171',
      '--danger-bg': 'rgba(248, 113, 113, 0.12)',
      '--danger-bdr': 'rgba(248, 113, 113, 0.25)',
      '--shadow-sm': '0 1px 2px rgba(0, 0, 0, 0.24)',
      '--shadow-md': '0 8px 20px rgba(0, 0, 0, 0.28)',
      '--shadow-lg': '0 16px 36px rgba(0, 0, 0, 0.34)',
      '--shadow-xl': '0 24px 56px rgba(0, 0, 0, 0.42)',
      '--gradient-primary': 'linear-gradient(135deg,#5e50e0,#7c6dff)',
    },
  },
  blue: {
    label: 'Blue',
    description: 'Banking accent',
    vars: {
      '--bg-base': '#f3f8fc',
      '--bg-raised': '#ffffff',
      '--bg-overlay': '#eef7fd',
      '--bg-card': '#ffffff',
      '--bg-card-hv': '#f5fbff',
      '--bg-modal': '#ffffff',
      '--text-primary': '#102033',
      '--text-secondary': '#4e647a',
      '--text-muted': '#7a91a8',
      '--text-disabled': '#adc0d0',
      '--border': 'rgba(3, 105, 161, 0.1)',
      '--border-md': 'rgba(14, 165, 233, 0.24)',
      '--border-lg': 'rgba(14, 165, 233, 0.42)',
      '--primary': '#0ea5e9',
      '--primary-dark': '#0369a1',
      '--primary-light': '#38bdf8',
      '--primary-faint': 'rgba(14, 165, 233, 0.1)',
      '--primary-glow': 'transparent',
      '--accent': '#f59e0b',
      '--accent-dark': '#b45309',
      '--accent-faint': 'rgba(245, 158, 11, 0.1)',
      '--success': '#047857',
      '--success-bg': 'rgba(4, 120, 87, 0.08)',
      '--success-bdr': 'rgba(4, 120, 87, 0.18)',
      '--warning': '#b45309',
      '--warning-bg': 'rgba(180, 83, 9, 0.09)',
      '--warning-bdr': 'rgba(180, 83, 9, 0.2)',
      '--danger': '#dc2626',
      '--danger-bg': 'rgba(220, 38, 38, 0.08)',
      '--danger-bdr': 'rgba(220, 38, 38, 0.2)',
      '--shadow-sm': '0 1px 2px rgba(14, 91, 130, 0.06)',
      '--shadow-md': '0 8px 20px rgba(14, 91, 130, 0.09)',
      '--shadow-lg': '0 16px 36px rgba(14, 91, 130, 0.13)',
      '--shadow-xl': '0 24px 56px rgba(14, 91, 130, 0.18)',
      '--gradient-primary': 'linear-gradient(135deg,#0369a1,#0ea5e9)',
    },
  },
}

function applyTheme(themeKey) {
  const nextTheme = THEMES[themeKey] ? themeKey : 'light'
  const root = document.documentElement

  Object.entries(THEMES[nextTheme].vars).forEach(([key, value]) => {
    root.style.setProperty(key, value)
  })
  root.setAttribute('data-theme', nextTheme)
}

export const ThemeProvider = ({ children }) => {
  const [theme, setThemeState] = useState(() => localStorage.getItem('si-theme') || 'light')

  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  const setTheme = useCallback((key) => {
    if (!THEMES[key]) return
    setThemeState(key)
    localStorage.setItem('si-theme', key)
    applyTheme(key)
  }, [])

  return (
    <ThemeContext.Provider value={{ theme, setTheme, themes: THEMES }}>
      {children}
    </ThemeContext.Provider>
  )
}

export const useTheme = () => {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be inside ThemeProvider')
  return ctx
}
