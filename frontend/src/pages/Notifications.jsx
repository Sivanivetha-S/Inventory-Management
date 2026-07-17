import React, { useEffect, useState, useCallback } from 'react'
import { notificationAPI } from '../services/api'
import toast from 'react-hot-toast'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Bell, BellOff, CheckCheck, Trash2, Package,
  ShieldAlert, Truck, AlertTriangle, Info, RefreshCw
} from 'lucide-react'

const container = { hidden:{opacity:0}, show:{opacity:1,transition:{staggerChildren:.04}} }
const item      = { hidden:{opacity:0,x:-12}, show:{opacity:1,x:0,transition:{duration:.25}} }

const TYPE_CONFIG = {
  STOCK_RECEIVED:  { icon: Package,     color:'#00b894', bg:'rgba(0,184,148,.10)',  label:'Stock Received' },
  THEFT_ALERT:     { icon: ShieldAlert, color:'#EF4444', bg:'rgba(239,68,68,.10)',   label:'Theft Alert' },
  SUPPLY_REQUEST:  { icon: Truck,       color:'#4F46E5', bg:'rgba(79,70,229,.10)',   label:'Supply Request' },
  LOW_STOCK:       { icon: AlertTriangle,color:'#F59E0B',bg:'rgba(245,158,11,.10)',  label:'Low Stock' },
  SYSTEM:          { icon: Info,        color:'#6B7280', bg:'rgba(107,114,128,.10)', label:'System' },
}

function typeConfig(type) {
  return TYPE_CONFIG[type] || TYPE_CONFIG.SYSTEM
}

function timeAgo(dateStr) {
  const now  = new Date()
  const date = new Date(dateStr)
  const diff = Math.floor((now - date) / 1000)
  if (diff < 60)    return 'Just now'
  if (diff < 3600)  return `${Math.floor(diff/60)}m ago`
  if (diff < 86400) return `${Math.floor(diff/3600)}h ago`
  return `${Math.floor(diff/86400)}d ago`
}

import { useAuth } from '../context/AuthContext'

export default function Notifications() {
  const { activeBranchId } = useAuth()
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading]             = useState(true)
  const [unreadCount, setUnreadCount]     = useState(0)
  const [filter, setFilter]               = useState('ALL')  // ALL | UNREAD
  const [page, setPage]                   = useState(0)
  const PAGE_SIZE = 30

  const load = useCallback(() => {
    setNotifications([])
    setLoading(true)
    Promise.all([
      notificationAPI.getAll(page, PAGE_SIZE),
      notificationAPI.getUnreadCount(),
    ])
      .then(([nr, cr]) => {
        setNotifications(nr.data.data || [])
        setUnreadCount(cr.data.data || 0)
      })
      .catch(() => toast.error('Failed to load notifications'))
      .finally(() => setLoading(false))
  }, [page, activeBranchId])

  useEffect(() => { load() }, [load])

  const displayed = filter === 'UNREAD'
    ? notifications.filter(n => !n.read)
    : notifications

  const handleMarkRead = async (id) => {
    try {
      await notificationAPI.markRead(id)
      setNotifications(prev => prev.map(n => n.id === id ? {...n, read:true} : n))
      setUnreadCount(c => Math.max(0, c - 1))
    } catch { toast.error('Failed to mark as read') }
  }

  const handleMarkAllRead = async () => {
    try {
      await notificationAPI.markAllRead()
      setNotifications(prev => prev.map(n => ({...n, read:true})))
      setUnreadCount(0)
      toast.success('All marked as read')
    } catch { toast.error('Failed') }
  }

  const handleDelete = async (id) => {
    try {
      await notificationAPI.delete(id)
      const wasUnread = notifications.find(n => n.id === id && !n.read)
      setNotifications(prev => prev.filter(n => n.id !== id))
      if (wasUnread) setUnreadCount(c => Math.max(0, c - 1))
    } catch { toast.error('Delete failed') }
  }

  return (
    <motion.div className="animate-fade-in" variants={container} initial="hidden" animate="show">

      {/* ── Header ── */}
      <motion.div variants={item} className="page-header">
        <div style={{display:'flex',alignItems:'center',gap:12}}>
          <div>
            <h1 className="page-title">Notifications</h1>
            <p className="page-subtitle">
              {unreadCount > 0
                ? <span style={{color:'var(--accent)',fontWeight:600}}>{unreadCount} unread</span>
                : 'All caught up!'}
            </p>
          </div>
        </div>
        <div style={{display:'flex',gap:8,alignItems:'center'}}>
          {/* Filter tabs */}
          <div style={{display:'flex',gap:2,background:'var(--slate-100)',border:'1px solid var(--border)',
            padding:4,borderRadius:'var(--r-lg)'}}>
            {['ALL','UNREAD'].map(f => (
              <button key={f} onClick={() => setFilter(f)}
                style={{padding:'6px 16px',border:'none',borderRadius:'var(--r-md)',fontFamily:'inherit',
                  fontSize:12,fontWeight:600,cursor:'pointer',
                  background: filter===f ? 'var(--surface)' : 'none',
                  color: filter===f ? 'var(--accent-dk)' : 'var(--text-3)',
                  boxShadow: filter===f ? 'var(--sh-1)' : 'none',
                  transition:'all .15s ease'}}>
                {f === 'ALL' ? `All (${notifications.length})` : `Unread (${unreadCount})`}
              </button>
            ))}
          </div>
          <button className="btn btn-secondary btn-sm" onClick={load} title="Refresh">
            <RefreshCw size={14} strokeWidth={1.75}/>
          </button>
          {unreadCount > 0 && (
            <button className="btn btn-outline btn-sm" onClick={handleMarkAllRead}>
              <CheckCheck size={14} strokeWidth={2}/> Mark all read
            </button>
          )}
        </div>
      </motion.div>

      {/* ── Notification list ── */}
      {loading
        ? <div className="loading-center"><div className="spinner"/></div>
        : displayed.length === 0
          ? (
            <motion.div variants={item} className="empty-state">
              <BellOff size={48}/>
              <h3>{filter === 'UNREAD' ? 'No unread notifications' : 'No notifications yet'}</h3>
              <p>You're all caught up!</p>
            </motion.div>
          )
          : (
            <AnimatePresence>
              <motion.div style={{display:'flex',flexDirection:'column',gap:8}}>
                {displayed.map(n => {
                  const cfg = typeConfig(n.type)
                  const Icon = cfg.icon
                  return (
                    <motion.div
                      key={n.id}
                      layout
                      initial={{opacity:0,y:8}}
                      animate={{opacity:1,y:0}}
                      exit={{opacity:0,x:-20}}
                      transition={{duration:.2}}
                      style={{
                        display:'flex',alignItems:'flex-start',gap:14,
                        padding:'14px 18px',
                        background: n.read ? 'var(--surface)' : 'var(--accent-lt)',
                        border: `1px solid ${n.read ? 'var(--border)' : 'var(--indigo-200)'}`,
                        borderRadius:'var(--r-lg)',
                        borderLeft: `3px solid ${n.read ? 'var(--border)' : cfg.color}`,
                        transition:'all .2s ease',
                        cursor: n.read ? 'default' : 'pointer',
                      }}
                      onClick={() => !n.read && handleMarkRead(n.id)}
                    >
                      {/* Icon */}
                      <div style={{width:40,height:40,borderRadius:'var(--r-sm)',
                        background:cfg.bg,display:'flex',alignItems:'center',
                        justifyContent:'center',flexShrink:0}}>
                        <Icon size={18} strokeWidth={1.75} style={{color:cfg.color}}/>
                      </div>

                      {/* Content */}
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:3}}>
                          <span style={{fontSize:11,fontWeight:700,color:cfg.color,
                            textTransform:'uppercase',letterSpacing:'.05em'}}>
                            {cfg.label}
                          </span>
                          {!n.read && (
                            <span style={{width:7,height:7,borderRadius:'50%',
                              background:'var(--accent)',flexShrink:0}}/>
                          )}
                        </div>
                        <p style={{fontSize:13.5,color:'var(--text-1)',lineHeight:1.5,margin:0}}>
                          {n.message}
                        </p>
                        <p style={{fontSize:11.5,color:'var(--text-4)',marginTop:4}}>
                          {timeAgo(n.createdAt)}
                        </p>
                      </div>

                      {/* Actions */}
                      <div style={{display:'flex',gap:6,flexShrink:0}}>
                        {!n.read && (
                          <button
                            className="btn-icon"
                            onClick={e => { e.stopPropagation(); handleMarkRead(n.id) }}
                            title="Mark as read"
                            style={{width:32,height:32}}>
                            <CheckCheck size={14} strokeWidth={2} style={{color:'var(--ok)'}}/>
                          </button>
                        )}
                        <button
                          className="btn-icon btn-icon-delete"
                          onClick={e => { e.stopPropagation(); handleDelete(n.id) }}
                          title="Delete"
                          style={{width:32,height:32}}>
                          <Trash2 size={13} strokeWidth={1.75}/>
                        </button>
                      </div>
                    </motion.div>
                  )
                })}
              </motion.div>
            </AnimatePresence>
          )
      }

      {/* ── Pagination ── */}
      {notifications.length >= PAGE_SIZE && (
        <div style={{display:'flex',justifyContent:'center',gap:12,marginTop:24}}>
          {page > 0 && (
            <button className="btn btn-secondary btn-sm" onClick={() => setPage(p => p-1)}>
              ← Previous
            </button>
          )}
          <button className="btn btn-secondary btn-sm" onClick={() => setPage(p => p+1)}>
            Next →
          </button>
        </div>
      )}
    </motion.div>
  )
}
