import React from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAuth } from '../context/AuthContext'
import { FileText, Users, Receipt, ArrowRight, Package, Info, ShieldAlert } from 'lucide-react'

const container = { hidden:{opacity:0}, show:{opacity:1,transition:{staggerChildren:.08}} }
const item      = { hidden:{opacity:0,y:16}, show:{opacity:1,y:0,transition:{duration:.35}} }

export default function StaffDashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const hasBillingPerm = user?.billingPermission === true

  const ACTIONS = [
    ...(hasBillingPerm ? [{ to:'/billing',   icon:FileText,  label:'New Bill',     desc:'Create a new customer invoice',      color:'#4F46E5', bg:'rgba(79,70,229,.10)' }] : []),
    { to:'/customers', icon:Users,     label:'Customers',    desc:'Add or search customers',             color:'#16A34A', bg:'rgba(22,163,74,.10)' },
    { to:'/products',  icon:Package,   label:'View Products',desc:'Browse catalog and details',          color:'#D97706', bg:'rgba(217,119,6,.10)' },
  ]

  return (
    <motion.div className="animate-fade-in" variants={container} initial="hidden" animate="show">

      {/* Hero */}
      <motion.div variants={item} style={{
        background:'var(--surface)', border:'1px solid var(--border)',
        borderRadius:'var(--r-xl)', padding:'28px 32px', marginBottom:24,
        position:'relative', overflow:'hidden', boxShadow:'var(--sh-1)',
      }}>
        <div style={{
          position:'absolute', top:0, left:0, right:0, height:3,
          background:'linear-gradient(135deg,#00897B,#00BCD4)',
          borderRadius:'var(--r-xl) var(--r-xl) 0 0',
        }}/>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:16}}>
          <div>
            <p style={{fontSize:12,fontWeight:600,color:'#00897B',textTransform:'uppercase',letterSpacing:'.06em',marginBottom:6}}>
              Staff Portal
            </p>
            <h2 style={{fontSize:22,fontWeight:700,color:'var(--text-h)',letterSpacing:'-.04em'}}>
              Welcome, {user?.fullName || 'Staff Member'}!
            </h2>
            <p style={{fontSize:13.5,color:'var(--text-3)',marginTop:6}}>
              {user?.adminName ? `Working at ${user.adminName}'s shop` : 'Smart Inventory Staff Portal'}
            </p>
          </div>
          {hasBillingPerm ? (
            <button className="btn btn-primary"
              onClick={() => navigate('/billing')}
              style={{background:'linear-gradient(135deg,#00897B,#00BCD4)', boxShadow:'0 4px 16px rgba(0,137,123,.30)'}}>
              <Receipt size={15} strokeWidth={2}/> New Bill
            </button>
          ) : (
            <div style={{ display:'flex', alignItems:'center', gap:8, background:'var(--err-bg)', border:'1px solid var(--err-bdr)', borderRadius:'var(--r-md)', padding:'10px 14px', color:'var(--err)', fontSize:13 }}>
              <ShieldAlert size={16} />
              <span>Billing Permission Disabled</span>
            </div>
          )}
        </div>
      </motion.div>

      {/* Quick action cards */}
      <motion.div variants={item}
        style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(220px,1fr))',gap:16,marginBottom:24}}>
        {ACTIONS.map(a => (
          <motion.div key={a.to} className="card"
            style={{cursor:'pointer',padding:'24px'}}
            whileHover={{y:-4,boxShadow:'0 8px 24px rgba(0,0,0,.10)'}}
            onClick={() => navigate(a.to)}>
            <div style={{width:48,height:48,borderRadius:'var(--r-md)',background:a.bg,
              display:'flex',alignItems:'center',justifyContent:'center',marginBottom:16}}>
              <a.icon size={22} strokeWidth={1.75} style={{color:a.color}}/>
            </div>
            <h3 style={{fontSize:16,fontWeight:700,color:'var(--text-h)',marginBottom:4}}>{a.label}</h3>
            <p style={{fontSize:13,color:'var(--text-3)',lineHeight:1.5,marginBottom:16}}>{a.desc}</p>
            <div style={{display:'flex',alignItems:'center',gap:5,color:a.color,fontSize:13,fontWeight:600}}>
              Open <ArrowRight size={14} strokeWidth={2}/>
            </div>
          </motion.div>
        ))}
      </motion.div>

      {/* Info */}
      <motion.div variants={item} style={{
        background:'var(--surface)',border:'1px solid var(--border)',
        borderRadius:'var(--r-lg)',padding:'20px 24px',boxShadow:'var(--sh-1)',
      }}>
        <h3 style={{fontSize:15,fontWeight:600,color:'var(--text-h)',marginBottom:12,
          display:'flex',alignItems:'center',gap:8}}>
          <Info size={16} strokeWidth={1.75} style={{color:'var(--accent)'}}/> Your Quick Actions
        </h3>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
          {[
            ...(hasBillingPerm ? [{icon:Receipt,  label:'Create Billing',  desc:'Bill customers at the counter', to:'/billing'}] : []),
            {icon:Users,    label:'Add Customers',   desc:'Register walk-in customers',    to:'/customers'},
            {icon:Package,  label:'View Products',   desc:'Look up product price and stock', to:'/products'},
          ].map(t => (
            <div key={t.to} onClick={() => navigate(t.to)}
              style={{display:'flex',alignItems:'center',gap:12,padding:'12px 14px',
                background:'var(--slate-50)',border:'1px solid var(--border)',
                borderRadius:'var(--r-md)',cursor:'pointer',transition:'all .18s ease'}}
              onMouseEnter={e => e.currentTarget.style.borderColor='var(--accent)'}
              onMouseLeave={e => e.currentTarget.style.borderColor='var(--border)'}>
              <t.icon size={16} strokeWidth={1.75} style={{color:'var(--accent)',flexShrink:0}}/>
              <div>
                <p style={{fontSize:13,fontWeight:600,color:'var(--text-h)'}}>{t.label}</p>
                <p style={{fontSize:11.5,color:'var(--text-3)'}}>{t.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </motion.div>
    </motion.div>
  )
}
