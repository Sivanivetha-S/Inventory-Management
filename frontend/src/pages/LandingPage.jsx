import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Mail, Package, Users, Shield, BarChart2, FileText, Percent } from 'lucide-react'
import './LandingPage.css'
import Chatbot from '../components/chatbot/Chatbot'

/* scroll reveal */
function useReveal() {
  useEffect(() => {
    const obs = new IntersectionObserver(
      es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('lp-visible'); obs.unobserve(e.target) } }),
      { threshold: 0.1 }
    )
    const t = setTimeout(() => document.querySelectorAll('.lp-animate').forEach(el => obs.observe(el)), 60)
    return () => { clearTimeout(t); obs.disconnect() }
  }, [])
}

/* single accordion item */
function AItem({ icon, title, desc, features, open: defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className={`lp-accordion-item${open ? ' open' : ''}`}>
      <div className="lp-accordion-header" onClick={() => setOpen(o => !o)}>
        <div className="lp-accordion-header__left">
          <div className="lp-accordion-header__icon"><span>{icon}</span></div>
          <span className="lp-accordion-header__text">{title}</span>
        </div>
        <button className="lp-accordion-toggle" onClick={e => { e.stopPropagation(); setOpen(o => !o) }}>+</button>
      </div>
      <div className="lp-accordion-body">
        <p className="lp-accordion-body__desc">{desc}</p>
        <div className="lp-accordion-body__features">
          {features.map(f => (
            <div key={f} className="lp-accordion-body__feat">
              <div className="lp-accordion-body__feat-dot" />{f}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/* accordion section */
function ASection({ icon: Icon, label, title, sub, items }) {
  return (
    <div className="lp-accordion-section lp-divider-section">
      <div className="lp-animate lp-delay-1" style={{ textAlign:'center' }}>
        <div className="lp-accordion-section__label">
          {Icon && <Icon size={12} style={{ marginRight:6 }} />}{label}
        </div>
        <h2 className="lp-accordion-section__title">{title}</h2>
        <p className="lp-accordion-section__sub">{sub}</p>
      </div>
      <div className="lp-accordion-list">
        {items.map((item, i) => (
          <div key={item.title} className="lp-animate" style={{ transitionDelay:`${i*60}ms` }}>
            <AItem {...item} open={i === 0} />
          </div>
        ))}
      </div>
    </div>
  )
}

/* ── DATA ─────────────────────────────────────── */
const PRODUCTS = [
  { icon:'📦', title:'Add & Manage Products', desc:'Create products with full details — purchase price, selling price, category and stock quantity. Edit or delete anytime with instant feedback.',
    features:['Purchase & selling price','Category grouping','Edit & delete anytime','Instant save feedback'] },
  { icon:'🔔', title:'Low Stock Alerts', desc:'Set a minimum stock alert level per product. When stock drops below that level, it is flagged immediately on the dashboard.',
    features:['Per-product minimum level','Dashboard flag','Never run out unexpectedly','Visual stock badge'] },
  { icon:'🔍', title:'Search & Filter', desc:'Find any product instantly by name or category using fast inline search with no page reload.',
    features:['Search by name','Filter by category','Instant results','Clean table view'] },
]
const CUSTOMERS = [
  { icon:'⚡', title:'Instant Walk-in Add', desc:'Add walk-in customers without email. No OTP needed — just name and phone. Immediately usable in billing.',
    features:['Name + phone only','No OTP required','Instantly active','Perfect for walk-ins'] },
  { icon:'✉️', title:'Email OTP Verification', desc:'When email is provided, an OTP is sent to the customer email. Admin enters the OTP to verify and activate.',
    features:['OTP to customer email','Admin verifies OTP','10 minute expiry','Resend OTP available'] },
  { icon:'🔒', title:'Private per Shop Owner', desc:'Complete multi-owner isolation. Each shop owner sees only their own customers — never another owner\'s data.',
    features:['Scoped per admin','Zero cross-visibility','JWT-level isolation','GDPR-friendly'] },
]
const BILLING = [
  { icon:'🛒', title:'Cart-Based Billing', desc:'Add multiple products to cart, adjust quantities, see live totals update instantly. Stock is validated before adding.',
    features:['Multiple products','Live total','Qty validation','Out-of-stock guard'] },
  { icon:'🏷️', title:'Smart Discounts', desc:'Set discounts with a minimum purchase amount. When cart meets the threshold, the discount auto-applies with a green banner.',
    features:['Minimum amount condition','Auto-applies on threshold','Manual % input too','Chip selector'] },
  { icon:'💵', title:'Amount Paid & Change', desc:'Enter the amount paid by the customer. System instantly shows change to return or balance due — no mental math.',
    features:['Amount paid field','Change shown instantly','Balance due warning','Printed on invoice'] },
  { icon:'🖨️', title:'Print-Ready Invoice', desc:'Generate a professional invoice and print with one click. Email is also automatically sent to the customer.',
    features:['One-click print','Email to customer','Professional layout','Full details'] },
]
const THEFT = [
  { icon:'📧', title:'Daily 8 PM Reminder', desc:'Every day at exactly 8 PM, the system automatically sends a stock verification reminder email to the admin.',
    features:['Automated cron job','Sent at 8:00 PM sharp','Email to admin','Never miss a check'] },
  { icon:'⚖️', title:'Automatic Comparison', desc:'Formula: Expected = Opening Stock − Sold Qty. If Actual < Expected, a theft record is created and alert email sent.',
    features:['Auto calculation','Missing qty computed','Loss value in ₹','Alert email sent'] },
  { icon:'🔎', title:'Investigate & Resolve', desc:'View all theft records with full details. Add admin notes and track status from Detected → Investigated → Resolved.',
    features:['Full theft history','Admin notes','Status tracking','Export to CSV'] },
]
const DASHBOARD = [
  { icon:'📈', title:'Revenue Charts', desc:'Weekly and monthly revenue visualised as area and bar charts. See trends at a glance from the moment you log in.',
    features:['Weekly area chart','Monthly bar chart','Real-time data','Color-coded'] },
  { icon:'🚨', title:'Alerts & Counters', desc:'Low stock items and active theft alerts shown as prominent stat cards for instant awareness.',
    features:['Low stock count','Theft alert count',"Today's revenue",'Total sales'] },
  { icon:'📋', title:'Recent Activity', desc:'Last 5 invoices and last 5 theft alerts shown in clean tables for a quick daily overview.',
    features:['Recent bills','Recent theft alerts','Customer names','Invoice amounts'] },
]

export default function LandingPage() {
  useReveal()
  return (
    <div className="lp-page">

      {/* ══ HERO ══════════════════════════════════ */}
      <div className="lp-hero">
        <div className="lp-grid-overlay" />
        <div className="lp-hero-blob lp-hero-blob--1" />
        <div className="lp-hero-blob lp-hero-blob--2" />
        <div className="lp-hero-blob lp-hero-blob--3" />
        <div className="lp-hero-inner">
          <div className="lp-hero__badge"><div className="lp-hero__badge-dot" />Retail Management Platform</div>
          <h1 className="lp-hero__title">AI-Integrated<br /><span>Inventory Intelligence</span><br />&amp; Loss Prevention Platform</h1>
          <p className="lp-hero__sub">One platform to manage products, bill customers, detect stock theft and grow your retail business with full confidence.</p>
          <div className="lp-hero__btns">
            <Link to="/register" className="lp-btn lp-btn--solid">Get Started Free <ArrowRight size={16} strokeWidth={2} /></Link>
            <Link to="/login"    className="lp-btn lp-btn--ghost">Sign In</Link>
          </div>
          <div className="lp-hero__stats">
            {[{val:'100%',lbl:'Multi-Owner'},{val:'8PM',lbl:'Auto Alert'},{val:'JWT',lbl:'Secure Auth'},{val:'Live',lbl:'Dashboard'}].map(s => (
              <div key={s.lbl} className="lp-hero__stat"><span className="lp-hero__stat-val">{s.val}</span><span className="lp-hero__stat-lbl">{s.lbl}</span></div>
            ))}
          </div>
        </div>
      </div>

      {/* ══ ACCORDION SECTIONS ════════════════════ */}
      <ASection icon={Package}   label="Product Management"   title="Full control over your entire inventory"              sub="Add, update and track every product with real-time stock levels and instant low-stock alerts." items={PRODUCTS} />
      <ASection icon={Users}     label="Customer Management"  title="Know your customers, grow your business"              sub="Instant walk-ins or OTP-verified customers — each owner's data is completely private." items={CUSTOMERS} />
      <ASection icon={FileText}  label="Billing System"       title="Generate professional invoices in seconds"            sub="Cart billing, smart discounts, amount paid tracking and one-click printable invoices." items={BILLING} />
      <ASection icon={Shield}    label="Theft Detection"      title="Catch stock loss before it costs you more"           sub="Daily automated reminders, smart stock comparison and instant theft records with loss calculation." items={THEFT} />
      <ASection icon={BarChart2} label="Analytics Dashboard"  title="Everything at a glance, always"                      sub="Revenue charts, low-stock warnings, theft counters and recent bills on one page." items={DASHBOARD} />

      {/* ══ FOOTER ════════════════════════════════ */}
      <div className="lp-footer">
        <div className="lp-grid-overlay" />
        <div style={{ position:'relative', zIndex:1 }}>
          <div className="lp-footer__logo lp-animate">SI</div>
          <h2 className="lp-footer__name lp-animate lp-delay-1">Smart Inventory</h2>
          <p className="lp-footer__tagline lp-animate lp-delay-2">Secure · Reliable · Intelligent</p>
          <div className="lp-footer__btns lp-animate lp-delay-3">
            <Link to="/register" className="lp-btn lp-btn--solid">Start for Free <ArrowRight /></Link>
            <Link to="/login"    className="lp-btn lp-btn--ghost">Already have an account?</Link>
          </div>
          <div className="lp-footer__contact lp-animate lp-delay-4"><Mail /> sidheessiva598@gmail.com</div>
          <p className="lp-footer__copy lp-animate lp-delay-4">© 2024 Smart Inventory System. All rights reserved.</p>
        </div>
      </div>

      <Chatbot />
    </div>
  )
}
