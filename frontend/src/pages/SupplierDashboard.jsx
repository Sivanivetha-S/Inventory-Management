import React, { useEffect, useState, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../context/AuthContext'
import { supplierProductAPI, supplyRequestAPI, ownerAPI, supplierDispatchAPI, supplierTheftAPI, supplierDashboardAPI, auditLogAPI, barcodeAPI } from '../services/api'
import { generateProductDescription, generateProductAIFeatures } from '../services/geminiService'
import BarcodeScanner from '../components/BarcodeScanner'
import toast from 'react-hot-toast'
import {
  Package, Truck, Building2, Users, Plus, Edit2, Trash2,
  Send, Clock, CheckCircle, XCircle, Search, X, RefreshCw,
  AlertTriangle, FileText, ShieldAlert
} from 'lucide-react'

const anim = { hidden:{opacity:0}, show:{opacity:1,transition:{staggerChildren:.06}} }
const row  = { hidden:{opacity:0,y:12}, show:{opacity:1,y:0,transition:{duration:.26}} }

const STATUS = {
  PENDING:    { cls:'badge-warning', label:'Pending',    Icon:Clock },
  ACCEPTED:   { cls:'badge-success', label:'Accepted',   Icon:CheckCircle },
  REJECTED:   { cls:'badge-danger',  label:'Rejected',   Icon:XCircle },
  DISPATCHED: { cls:'badge-primary', label:'Dispatched', Icon:Truck },
  RECEIVED:   { cls:'badge-success', label:'Received',   Icon:CheckCircle },
  CANCELLED:  { cls:'badge-gray',    label:'Cancelled',  Icon:XCircle },
}

const TABS = [
  { id:'overview', label:'Overview',        Icon:Building2 },
  { id:'catalog',  label:'My Products',     Icon:Package },
  { id:'requests', label:'Supply Requests', Icon:Truck },
  { id:'owners',   label:'Browse Shops',    Icon:Users },
  { id:'theft',    label:'Theft Detection', Icon:AlertTriangle },
  { id:'audit',    label:'Audit Trails',    Icon:FileText },
]

/* ── Product Modal ──────────────────────────────────────────────────────── */
const UNITS = ['Piece', 'Pack', 'Box', 'Bottle', 'Kg', 'Gram (g)', 'Litre', 'ml', 'Dozen', 'Bundle', 'Roll', 'Meter', 'Custom']
const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080'
const DEFAULT_IMG = 'https://placehold.co/200x200/e2e8f0/64748b?text=No+Image'

function ProductModal({ product, onClose, onSaved }) {
  const isEdit = !!product
  const empty = {
    name:'', category:'', brand:'', unit:'', unitSize:'', description:'',
    barcodeNumber:'', purchasePrice:'', sellingPrice:'',
    minimumOrderQty:1, quantity:0, manufacturingDate:'', expiryDate:'',
  }
  const [form, setForm] = useState(isEdit ? {
    name:            product.name,
    category:        product.category,
    brand:           product.brand          || '',
    unit:            product.unit           || '',
    unitSize:        product.unitSize ? product.unitSize.replace(new RegExp(`\\s*${product.unit}$`, 'i'), '').trim() : '',
    description:     product.description    || '',
    barcodeNumber:   product.barcodeNumber  || '',
    purchasePrice:   product.purchasePrice  || '',
    sellingPrice:    product.sellingPrice   || product.unitPrice || '',
    minimumOrderQty: product.minimumOrderQty ?? 1,
    quantity:        product.quantity       ?? product.availableStock ?? 0,
    manufacturingDate: product.manufacturingDate || '',
    expiryDate:        product.expiryDate        || '',
  } : empty)
  const [imageFile,    setImageFile]    = useState(null)
  const [imagePreview, setImagePreview] = useState(
    isEdit && product.productImage ? `${API_BASE}${product.productImage}` : null
  )
  const [saving, setSaving] = useState(false)
  const [generatingDesc, setGeneratingDesc] = useState(false)
  const [scanningBarcode, setScanningBarcode] = useState(false)
  const fileRef = useRef(null)
  const ch = e => setForm(p => ({ ...p, [e.target.name]: e.target.value }))

  const handleUnitChange = e => {
    const val = e.target.value
    setForm(p => ({ ...p, unit: val, unitSize: '' }))
  }

  const getUnitSizeOptions = (unit) => {
    switch (unit) {
      case 'Kg':
        return ['1', '2', '5', '10', '25', '50']
      case 'Gram (g)':
        return ['50', '100', '200', '250', '500', '1000']
      case 'Litre':
        return ['1', '2', '5', '10', '20']
      case 'ml':
        return ['100', '200', '250', '500', '750', '1000']
      default:
        return []
    }
  }

  const unitSizeOptions = getUnitSizeOptions(form.unit)
  const isSizeRequired = unitSizeOptions.length > 0

  const handleSupplierBarcodeScan = async (code) => {
    setForm(p => ({ ...p, barcodeNumber: code }))
    toast.success(`Scanned Barcode: ${code}`)

    try {
      // 1. Check if barcode already exists in the active supplier catalog database
      const res = await supplierProductAPI.getAll(code)
      const data = res.data?.data
      const match = data && data.find(p => p.barcodeNumber === code)

      if (match) {
        toast.success("Existing product detected.")
        // Auto fill details
        setForm(p => ({
          ...p,
          name: match.name,
          brand: match.brand || '',
          category: match.category,
          description: match.description || '',
          barcodeNumber: code,
          unit: match.unit || '',
        }))
        if (match.productImage) {
          setImagePreview(`${API_BASE}${match.productImage}`)
        }
        return
      }

      // Check if it exists in Owner Products table
      const ownerRes = await barcodeAPI.lookup(code)
      if (ownerRes.data?.success && ownerRes.data?.data?.productFound) {
        const prod = ownerRes.data.data
        toast.success("Existing product detected in system.")
        setForm(p => ({
          ...p,
          name: prod.productName,
          category: prod.category || '',
          barcodeNumber: code,
        }))
        return
      }

      // Case 2: Barcode does NOT exist. Retrieve from OpenFoodFacts
      toast.loading("Searching OpenFoodFacts barcode database...")
      const offRes = await fetch(`https://world.openfoodfacts.org/api/v0/product/${code}.json`)
      toast.dismiss()

      let name = ''
      let brand = ''
      let category = ''
      let desc = ''
      let image = ''

      if (offRes.ok) {
        const offData = await offRes.json()
        if (offData && offData.status === 1 && offData.product) {
          const offProd = offData.product
          name = offProd.product_name || ''
          brand = offProd.brands || ''
          category = offProd.categories ? offProd.categories.split(',')[0] : ''
          desc = offProd.description || offProd.ingredients_text || ''
          image = offProd.image_url || ''

          setForm(p => ({
            ...p,
            name: name || p.name,
            brand: brand || p.brand,
            category: category || p.category,
            description: desc || p.description,
            barcodeNumber: code
          }))
          if (image) {
            setImagePreview(image)
          }
          toast.success('Auto-filled product info from OpenFoodFacts!')
        } else {
          toast.error('No product information found. Please enter product details manually.')
        }
      } else {
        toast.error('No product information found. Please enter product details manually.')
      }

      // Trigger AI Features generation
      const queryName = name || form.name
      const queryCategory = category || form.category
      if (queryName && queryCategory) {
        toast.loading("Generating AI product description & metadata...")
        try {
          const aiData = await generateProductAIFeatures({
            productName: queryName,
            brand: brand || form.brand || 'Generic',
            category: queryCategory
          })
          toast.dismiss()
          if (aiData) {
            const formattedDesc = `${aiData.description || desc}\n\n[AI Metadata]\nStorage: ${aiData.storageInstructions || ''}\nCategory: ${aiData.inventoryCategory || ''}\nTags: ${(aiData.tags || []).join(', ')}`;
            setForm(p => ({ ...p, description: formattedDesc }))
            toast.success('AI attributes generated successfully!')
          }
        } catch (aiErr) {
          toast.dismiss()
          console.error(aiErr)
        }
      }

    } catch (err) {
      toast.dismiss()
      toast.error('No product information found. Please enter product details manually.')
    }
  }

  const handleGenerateDesc = async () => {
    if (!form.name || !form.category) {
      toast.error('Product Name and Category are required to generate description');
      return;
    }
    setGeneratingDesc(true);
    try {
      const desc = await generateProductDescription({
        productName: form.name,
        brand: form.brand,
        category: form.category,
        mfd: form.manufacturingDate,
        expiry: form.expiryDate
      });
      setForm(p => ({ ...p, description: desc }));
      toast.success('Description generated successfully!');
    } catch (err) {
      console.error(err);
      toast.error('Failed to generate description: ' + err.message);
    } finally {
      setGeneratingDesc(false);
    }
  }

  // Compute live validation for Minimum Order Quantity
  const moqVal = parseInt(form.minimumOrderQty)
  const isMoqInvalid = isNaN(moqVal) || moqVal < 50

  const handleImageChange = e => {
    const file = e.target.files[0]; if (!file) return
    const ok = ['image/jpeg','image/jpg','image/png','image/webp'].includes(file.type)
    if (!ok) { toast.error('Only JPG, JPEG, PNG and WEBP allowed'); return }
    if (file.size > 5*1024*1024) { toast.error('Max image size is 5 MB'); return }
    setImageFile(file); setImagePreview(URL.createObjectURL(file))
  }
  const removeImg = () => { setImageFile(null); setImagePreview(null); if (fileRef.current) fileRef.current.value='' }

  const handleSubmit = async e => {
    e.preventDefault()
    if (!form.name||!form.category) { toast.error('Name and category required'); return }
    if (!form.purchasePrice||!form.sellingPrice) { toast.error('Purchase and selling prices required'); return }
    if (parseFloat(form.sellingPrice) < parseFloat(form.purchasePrice)) { toast.error('Selling price cannot be less than purchase price'); return }
    if (parseInt(form.quantity) < 0) { toast.error('Quantity cannot be negative'); return }
    if (isMoqInvalid) { toast.error('Minimum Order Quantity must be 50 or above.'); return }
    if (!form.unit) { toast.error('Unit is required'); return }
    if (isSizeRequired && !form.unitSize) {
      toast.error(`${form.unit === 'Kg' || form.unit === 'Gram (g)' ? 'Weight' : 'Volume'} size is required`);
      return
    }

    const cat = form.category ? form.category.trim().toLowerCase() : "";
    const noDateCats = ["dress", "clothing", "boxes", "plastic products", "stationery", "furniture", "dresses", "box", "plastic"];
    const requiredDateCats = ["medicines", "medicine", "food", "beverages", "beverage", "cosmetics", "cosmetic", "dairy products", "dairy", "bakery products", "bakery"];

    let finalMfd = form.manufacturingDate || null;
    let finalExp = form.expiryDate || null;

    if (noDateCats.includes(cat)) {
      finalMfd = null;
      finalExp = null;
    } else {
      if (requiredDateCats.includes(cat)) {
        if (!finalMfd || !finalExp) {
          toast.error(`Manufacturing Date and Expiry Date are mandatory for category: ${form.category}`);
          return;
        }
      }
      if (finalMfd && finalExp && finalExp <= finalMfd) {
        toast.error('Expiry Date must be later than Manufacturing Date.');
        return;
      }
    }

    setSaving(true)
    try {
      const payload = {
        name:form.name, category:form.category, brand:form.brand||null,
        unit:form.unit||null, description:form.description||null,
        barcodeNumber:form.barcodeNumber||null,
        purchasePrice:parseFloat(form.purchasePrice),
        sellingPrice:parseFloat(form.sellingPrice),
        unitPrice:parseFloat(form.sellingPrice),
        minimumOrderQty:parseInt(form.minimumOrderQty),
        quantity:parseInt(form.quantity)||0,
        availableStock:parseInt(form.quantity)||0,
        manufacturingDate:finalMfd,
        expiryDate:finalExp,
        unitSize: isSizeRequired && form.unitSize 
          ? `${form.unitSize} ${form.unit === 'Gram (g)' ? 'g' : form.unit === 'Litre' ? 'L' : form.unit}`
          : null,
      }
      if (isEdit) { await supplierProductAPI.update(product.id, payload, imageFile); toast.success('Product updated!') }
      else        { await supplierProductAPI.add(payload, imageFile);                 toast.success('Product added!') }
      onSaved(); onClose()
    } catch(err) {
      const resp = err.response?.data
      if (resp && resp.message === 'Validation failed' && resp.data) {
        // Extract the first validation message from the error dictionary
        const messages = Object.values(resp.data)
        if (messages.length > 0) {
          toast.error(messages[0])
        } else {
          toast.error('Validation failed')
        }
      } else {
        toast.error(resp?.message || 'Save failed')
      }
    } finally { setSaving(false) }
  }

  const inp = { width:'100%', padding:'9px 11px', borderRadius:8, border:'1.5px solid var(--border)',
    background:'var(--surface)', color:'var(--text-h)', fontFamily:'inherit', fontSize:13,
    outline:'none', boxSizing:'border-box' }
  const lbl = { display:'block', fontSize:11, fontWeight:600, color:'var(--text-3)',
    textTransform:'uppercase', letterSpacing:'.05em', marginBottom:5 }
  const sec = { fontSize:10.5, fontWeight:700, color:'var(--accent)', textTransform:'uppercase',
    letterSpacing:'.08em', borderBottom:'1px solid var(--border)', paddingBottom:5, marginBottom:12, marginTop:4 }

  return (
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal-box" style={{maxWidth:640,maxHeight:'90vh',overflowY:'auto'}}>

        {/* Header */}
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:18}}>
          <div>
            <h2 style={{fontSize:19,fontWeight:700,color:'var(--text-h)'}}>{isEdit?'Edit Product':'Add New Product'}</h2>
            <p style={{fontSize:12,color:'var(--text-3)',marginTop:2}}>{isEdit?'Update product details below':'Fill all required fields and upload an image'}</p>
          </div>
          <button className="btn-icon" onClick={onClose}><X size={15}/></button>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Image Upload */}
          <p style={sec}>Product Image</p>
          <div style={{display:'flex',gap:16,alignItems:'flex-start',marginBottom:18}}>
            <div style={{width:110,height:110,borderRadius:10,border:'2px dashed var(--border)',
              overflow:'hidden',flexShrink:0,background:'var(--slate-100)',
              display:'flex',alignItems:'center',justifyContent:'center'}}>
              <img src={imagePreview||DEFAULT_IMG} alt="preview"
                style={{width:'100%',height:'100%',objectFit:'cover'}}
                onError={e=>{e.target.src=DEFAULT_IMG}}/>
            </div>
            <div style={{flex:1}}>
              <p style={{fontSize:12.5,color:'var(--text-2)',marginBottom:10,lineHeight:1.5}}>
                Accepts <strong>JPG, JPEG, PNG, WEBP</strong> &nbsp;·&nbsp; Max <strong>5 MB</strong>
              </p>
              <input ref={fileRef} type="file" accept=".jpg,.jpeg,.png,.webp"
                onChange={handleImageChange} style={{display:'none'}} id="sp-img"/>
              <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
                <label htmlFor="sp-img" style={{display:'inline-flex',alignItems:'center',gap:6,
                  padding:'7px 13px',borderRadius:7,border:'1.5px solid var(--accent)',
                  color:'var(--accent)',fontSize:12,fontWeight:600,cursor:'pointer',
                  background:'var(--accent-lt)'}}>
                  📁 {imagePreview?'Change Image':'Upload Image'}
                </label>
                {imagePreview&&<button type="button" onClick={removeImg}
                  style={{display:'inline-flex',alignItems:'center',gap:5,padding:'7px 13px',
                    borderRadius:7,border:'1.5px solid var(--err)',color:'var(--err)',
                    fontSize:12,fontWeight:600,cursor:'pointer',background:'transparent'}}>
                  🗑️ Remove</button>}
              </div>
              {imageFile&&<p style={{fontSize:11,color:'var(--ok)',marginTop:5}}>
                ✅ {imageFile.name} ({(imageFile.size/1024).toFixed(0)} KB)</p>}
            </div>
          </div>

          {/* Basic Info */}
          <p style={sec}>Basic Information</p>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:11,marginBottom:14}}>
            <div style={{gridColumn:'1/-1'}}>
              <label style={lbl}>Product Name *</label>
              <input name="name" style={inp} value={form.name} onChange={ch} placeholder="e.g. Basmati Rice 5kg" required/>
            </div>
            <div><label style={lbl}>Brand Name</label>
              <input name="brand" style={inp} value={form.brand} onChange={ch} placeholder="e.g. India Gate"/></div>
            <div><label style={lbl}>Category *</label>
              <input name="category" style={inp} value={form.category} onChange={ch} placeholder="e.g. Grocery" required/></div>
            <div><label style={lbl}>Unit *</label>
              <select name="unit" style={inp} value={form.unit} onChange={handleUnitChange}>
                <option value="">-- Select Unit --</option>
                {UNITS.map(u=><option key={u} value={u}>{u}</option>)}
              </select></div>
            {isSizeRequired && (
              <div>
                <label style={lbl}>
                  {form.unit === 'Kg' || form.unit === 'Gram (g)' ? 'Weight *' : 'Volume *'}
                </label>
                <select name="unitSize" style={inp} value={form.unitSize} onChange={ch}>
                  <option value="">-- Select Option --</option>
                  {unitSizeOptions.map(opt => (
                    <option key={opt} value={opt}>
                      {opt} {(form.unit === 'Gram (g)' ? 'g' : form.unit === 'Litre' ? 'L' : form.unit)}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label style={lbl}>Barcode Number</label>
              <div style={{ display:'flex', gap:8 }}>
                <input name="barcodeNumber" style={{ ...inp, flex: 1 }} value={form.barcodeNumber} onChange={ch} placeholder="e.g. 8901234567890"/>
                <button type="button" onClick={() => setScanningBarcode(true)} style={{
                  padding:'8px 12px', borderRadius:8, border:'1.5px solid var(--accent)',
                  background:'var(--accent-lt)', color:'var(--accent)', fontSize:12,
                  fontWeight:600, cursor:'pointer', display:'flex', alignItems:'center', gap:6
                }}>📷 Scan</button>
              </div>
            </div>
            <div style={{gridColumn:'1/-1'}}>
              <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:5}}>
                <label style={{...lbl, marginBottom:0}}>Description</label>
                <button
                  type="button"
                  onClick={handleGenerateDesc}
                  disabled={generatingDesc}
                  style={{
                    display:'inline-flex',
                    alignItems:'center',
                    gap:5,
                    padding:'4px 10px',
                    borderRadius:5,
                    border:'1.5px solid var(--accent)',
                    background:'var(--accent-lt)',
                    color:'var(--accent)',
                    fontSize:11,
                    fontWeight:600,
                    cursor:'pointer',
                    opacity: generatingDesc ? 0.6 : 1
                  }}
                >
                  {generatingDesc ? (
                    <>
                      <span className="btn-spinner" style={{width: 10, height: 10, borderWidth: 1.5, borderColor: 'var(--accent) transparent var(--accent) transparent'}} />
                      Generating...
                    </>
                  ) : '✨ Generate Description'}
                </button>
              </div>
              <textarea name="description" rows={3} style={{...inp,resize:'vertical'}}
                value={form.description} onChange={ch} placeholder="Enter details or generate with Gemini AI..."/>
            </div>
          </div>

          {(() => {
            const cat = form.category ? form.category.trim().toLowerCase() : "";
            const noDateCats = ["dress", "clothing", "boxes", "plastic products", "stationery", "furniture", "dresses", "box", "plastic"];
            const requiredDateCats = ["medicines", "medicine", "food", "beverages", "beverage", "cosmetics", "cosmetic", "dairy products", "dairy", "bakery products", "bakery"];
            
            if (noDateCats.includes(cat)) return null;

            const isMandatory = requiredDateCats.includes(cat);

            return (
              <>
                <p style={sec}>Manufacturing &amp; Expiry Dates {isMandatory && "*"}</p>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:11,marginBottom:14}}>
                  <div>
                    <label style={lbl}>Manufacturing Date (MFD) {isMandatory && "*"}</label>
                    <input type="date" name="manufacturingDate" style={inp} value={form.manufacturingDate} onChange={ch} required={isMandatory}/>
                  </div>
                  <div>
                    <label style={lbl}>Expiry Date {isMandatory && "*"}</label>
                    <input type="date" name="expiryDate" style={inp} value={form.expiryDate} onChange={ch}
                      min={form.manufacturingDate||undefined} required={isMandatory}/>
                    {form.manufacturingDate&&form.expiryDate&&form.expiryDate<=form.manufacturingDate&&
                      <p style={{fontSize:11,color:'var(--err)',marginTop:3}}>⚠️ Expiry Date must be later than Manufacturing Date.</p>}
                  </div>
                </div>
              </>
            );
          })()}

          {/* Pricing */}
          <p style={sec}>Pricing</p>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:11,marginBottom:14}}>
            <div><label style={lbl}>Purchase Price (₹) *</label>
              <input type="number" step="0.01" min="0.01" name="purchasePrice" style={inp}
                value={form.purchasePrice} onChange={ch} placeholder="0.00" required/></div>
            <div><label style={lbl}>Selling Price (₹) *</label>
              <input type="number" step="0.01" min="0.01" name="sellingPrice" style={inp}
                value={form.sellingPrice} onChange={ch} placeholder="0.00" required/>
              {form.sellingPrice&&form.purchasePrice&&
                parseFloat(form.sellingPrice)<parseFloat(form.purchasePrice)&&
                <p style={{fontSize:11,color:'var(--err)',marginTop:3}}>⚠️ Cannot be less than purchase price</p>}
            </div>
          </div>

          {/* Stock */}
          <p style={sec}>Stock</p>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:11,marginBottom:18}}>
            <div><label style={lbl}>Available Quantity *</label>
              <input type="number" min="0" name="quantity" style={inp}
                value={form.quantity} onChange={ch} placeholder="0" required/></div>
            <div><label style={lbl}>Min Order Quantity</label>
              <input type="number" name="minimumOrderQty" 
                style={{ ...inp, borderColor: isMoqInvalid ? 'var(--err)' : 'var(--border)' }}
                value={form.minimumOrderQty} onChange={ch}/>
              {isMoqInvalid && (
                <p style={{ fontSize:11, color:'var(--err)', marginTop:3 }}>
                  ⚠️ Minimum Order Quantity must be 50 or above.
                </p>
              )}
            </div>
          </div>

          {/* Footer */}
          <div style={{display:'flex',gap:10,justifyContent:'flex-end',paddingTop:10,borderTop:'1px solid var(--border)'}}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving || isMoqInvalid} style={{minWidth:130}}>
              {saving?<span className="btn-spinner"/>:(isEdit?'💾 Save Changes':'📦 Add Product')}
            </button>
          </div>
        </form>
      </div>

      {scanningBarcode && (
        <div className="modal-overlay" style={{ zIndex: 1000 }} onClick={e => e.target === e.currentTarget && setScanningBarcode(false)}>
          <div className="modal-box" style={{ maxWidth: 450, position: 'relative' }}>
            <button type="button" onClick={() => setScanningBarcode(false)} style={{
              position: 'absolute', top: 12, right: 12, border: 'none', background: 'transparent',
              cursor: 'pointer', color: 'var(--text-3)', fontSize: 16
            }}>✕</button>
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Scan Product Barcode</h3>
            <BarcodeScanner onScan={(code) => {
              setScanningBarcode(false);
              handleSupplierBarcodeScan(code);
            }} action="SUPPLIER_CATALOG_SCAN" />
          </div>
        </div>
      )}
    </div>
  )
}

/* ── Send Request Modal ─────────────────────────────────────────────────── */
function SendRequestModal({ owners, myCatalog, onClose, onSent }) {
  const [form, setForm] = useState({adminId:'',branchId:'',supplierProductId:'',productName:'',quantity:'',unitPrice:'',notes:''})
  const [saving, setSaving] = useState(false)
  const ch = e => setForm(p=>({...p,[e.target.name]:e.target.value}))
  const pickProduct = e => {
    const id = e.target.value; setForm(p=>({...p,supplierProductId:id}))
    if (id) { const pr=myCatalog.find(x=>String(x.id)===id); if(pr) setForm(p=>({...p,supplierProductId:id,productName:pr.name,unitPrice:pr.unitPrice})) }
  }
  const handleSubmit = async e => {
    e.preventDefault()
    if (!form.adminId) { toast.error('Select a shop owner'); return }
    if (!form.productName.trim()) { toast.error('Product name is required'); return }
    if (!form.quantity||parseInt(form.quantity)<1) { toast.error('Enter valid quantity'); return }
    setSaving(true)
    try {
      await supplyRequestAPI.create({ adminId:parseInt(form.adminId),
        branchId:form.branchId ? parseInt(form.branchId) : null,
        supplierProductId:form.supplierProductId?parseInt(form.supplierProductId):null,
        productName:form.productName, quantity:parseInt(form.quantity),
        unitPrice:form.unitPrice?parseFloat(form.unitPrice):null,
        notes:form.notes, direction:'SUPPLIER_TO_OWNER' })
      toast.success('Supply request sent!'); onSent(); onClose()
    } catch(err) { toast.error(err.response?.data?.message||'Failed') }
    finally { setSaving(false) }
  }
  return (
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal-box" style={{maxWidth:480}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:18}}>
          <h2 style={{fontSize:19,fontWeight:700}}>Send Supply Request to Owner</h2>
          <button className="btn-icon" onClick={onClose}><X size={15}/></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Target Shop Owner *</label>
            <select name="adminId" className="form-input" value={form.adminId} onChange={e => {
              ch(e);
              setForm(p => ({ ...p, branchId: '' }));
            }}>
              <option value="">-- Select Shop --</option>
              {owners.map(o=><option key={o.id} value={o.id}>{o.shopName} ({o.fullName})</option>)}
            </select>
          </div>
          {form.adminId && (
            (() => {
              const selectedOwner = owners.find(x => String(x.id) === String(form.adminId));
              if (selectedOwner && selectedOwner.branches && selectedOwner.branches.length > 0) {
                return (
                  <div className="form-group">
                    <label className="form-label">Target Branch *</label>
                    <select name="branchId" className="form-input" value={form.branchId || ''} onChange={ch} required>
                      <option value="">-- Select Branch --</option>
                      {selectedOwner.branches.map(b => (
                        <option key={b.id} value={b.id}>{b.name} ({b.city})</option>
                      ))}
                    </select>
                  </div>
                );
              }
              return null;
            })()
          )}
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:11}}>
            <div className="form-group">
              <label className="form-label">From My Catalog</label>
              <select className="form-input" value={form.supplierProductId} onChange={pickProduct}>
                <option value="">-- Optional --</option>
                {myCatalog.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Product Name *</label>
              <input name="productName" className="form-input" value={form.productName} onChange={ch} placeholder="e.g. Rice 5kg"/>
            </div>
            <div className="form-group">
              <label className="form-label">Quantity *</label>
              <input type="number" min="1" name="quantity" className="form-input" value={form.quantity} onChange={ch} placeholder="100"/>
            </div>
            <div className="form-group">
              <label className="form-label">Unit Price (₹)</label>
              <input type="number" step="0.01" name="unitPrice" className="form-input" value={form.unitPrice} onChange={ch} placeholder="Optional"/>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Notes</label>
            <textarea rows={2} name="notes" className="form-input" value={form.notes} onChange={ch} placeholder="Delivery details, terms..."/>
          </div>
          <div style={{display:'flex',gap:11,justifyContent:'flex-end'}}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving?<span className="btn-spinner"/>:<><Send size={14}/> Send Request</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

/* ── Main Page ──────────────────────────────────────────────────────────── */
export default function SupplierDashboard() {
  const { user }     = useAuth()
  const [tab, setTab]               = useState('overview')
  const [catalog, setCatalog]       = useState([])
  const [requests, setRequests]     = useState([])
  const [owners, setOwners]         = useState([])
  const [loading, setLoading]       = useState(true)
  const [search, setSearch]         = useState('')
  const [productModal, setProductModal] = useState(null) // null|'new'|productObj
  const [reqModal, setReqModal]     = useState(false)
  const [busy, setBusy]             = useState(false)

  // New features states
  const [dispatches, setDispatches] = useState([])
  const [theftRecords, setTheftRecords] = useState([])
  const [auditLogs, setAuditLogs] = useState([])
  const [dispatchForm, setDispatchForm] = useState({ productId: '', adminId: '', branchId: '', quantity: '' })
  const [physicalStockCounts, setPhysicalStockCounts] = useState({})
  const [dashboardData, setDashboardData] = useState(null)

  const load = useCallback(() => {
    setLoading(true)
    Promise.all([
      supplierProductAPI.getMyCatalog(),
      supplyRequestAPI.getAll(),
      ownerAPI.getAll(),
      supplierDispatchAPI.getSupplierDispatches().catch(() => ({ data: { data: [] } })),
      supplierTheftAPI.getTheftRecords().catch(() => ({ data: { data: [] } })),
      auditLogAPI.getAuditLogs().catch(() => ({ data: { data: [] } })),
      supplierDashboardAPI.getDashboard().catch(() => ({ data: { data: null } }))
    ])
      .then(([c, r, o, d, t, a, db]) => {
        setCatalog(c.data.data || []);
        setRequests(r.data.data || []);
        setOwners(o.data.data || []);
        setDispatches(d.data.data || []);
        setTheftRecords(t.data.data || []);
        setAuditLogs(a.data.data || []);
        setDashboardData(db.data.data || null);
      })
      .catch(() => toast.error('Failed to load data'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  const handleDispatch = async (e) => {
    e.preventDefault();
    if (!dispatchForm.productId || !dispatchForm.adminId || !dispatchForm.quantity) {
      toast.error('All fields are required');
      return;
    }
    const selectedOwner = owners.find(x => String(x.id) === String(dispatchForm.adminId));
    if (selectedOwner && selectedOwner.branches && selectedOwner.branches.length > 0 && !dispatchForm.branchId) {
      toast.error('Please select a target branch');
      return;
    }
    setBusy(true);
    try {
      await supplierDispatchAPI.dispatch(
        parseInt(dispatchForm.productId),
        parseInt(dispatchForm.adminId),
        dispatchForm.branchId ? parseInt(dispatchForm.branchId) : null,
        parseInt(dispatchForm.quantity)
      );
      toast.success('Products dispatched successfully!');
      setDispatchForm({ productId: '', adminId: '', branchId: '', quantity: '' });
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Dispatch failed');
    } finally {
      setBusy(false);
    }
  };

  const handleVerifyTheft = async (productId, count) => {
    if (count === undefined || count === null || count === '') {
      toast.error('Please enter actual physical count');
      return;
    }
    setBusy(true);
    try {
      const res = await supplierTheftAPI.verify(productId, parseInt(count));
      if (res.data?.data) {
        toast.success(`Theft alert triggered! Missing quantity: ${res.data.data.missingQuantity}`);
      } else {
        toast.success('Stock verified successfully. No discrepancies found.');
      }
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Verification failed');
    } finally {
      setBusy(false);
    }
  };

  const delProduct = async id => {
    if (!window.confirm('Delete this product?')) return
    try { await supplierProductAPI.delete(id); toast.success('Deleted'); load() }
    catch(e) { toast.error(e.response?.data?.message||'Delete failed') }
  }

  const updateStatus = async (id, status) => {
    setBusy(true)
    try { await supplyRequestAPI.updateStatus(id, status, ''); toast.success('Updated: '+status); load() }
    catch(e) { toast.error(e.response?.data?.message||'Failed') }
    finally { setBusy(false) }
  }

  const filtered = catalog.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.category.toLowerCase().includes(search.toLowerCase()))

  const pend = requests.filter(r=>r.status==='PENDING').length
  const acc  = requests.filter(r=>r.status==='ACCEPTED').length
  const disp = requests.filter(r=>r.status==='DISPATCHED').length

  return (
    <motion.div className="animate-fade-in" variants={anim} initial="hidden" animate="show">
      {/* Hero */}
      <motion.div variants={row} style={{background:'var(--surface)',border:'1px solid var(--border)',
        borderRadius:'var(--r-xl)',padding:'24px 28px',marginBottom:20,
        position:'relative',overflow:'hidden',boxShadow:'var(--sh-1)'}}>
        <div style={{position:'absolute',top:0,left:0,right:0,height:3,
          background:'linear-gradient(135deg,#D97706,#FBBF24)',borderRadius:'var(--r-xl) var(--r-xl) 0 0'}}/>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:14}}>
          <div>
            <p style={{fontSize:11,fontWeight:700,color:'#D97706',textTransform:'uppercase',letterSpacing:'.07em',marginBottom:4}}>Supplier Portal</p>
            <h2 style={{fontSize:21,fontWeight:700,color:'var(--text-h)',letterSpacing:'-.04em'}}>
              Welcome, {user?.supplierName||'Supplier'}!
            </h2>
            <p style={{fontSize:13,color:'var(--text-3)',marginTop:3}}>{user?.companyName}</p>
          </div>
          <div style={{display:'flex',gap:7}}>
            <button className="btn btn-secondary btn-sm" onClick={load}><RefreshCw size={13}/> Refresh</button>
            <button className="btn btn-primary btn-sm" onClick={()=>setReqModal(true)}
              style={{background:'linear-gradient(135deg,#D97706,#F59E0B)'}}>
              <Send size={13}/> Send Request
            </button>
            <button className="btn btn-primary btn-sm" onClick={()=>setProductModal('new')}>
              <Plus size={13}/> Add Product
            </button>
          </div>
        </div>
      </motion.div>

      {/* Stats */}
      <motion.div variants={row} style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))',gap:11,marginBottom:20}}>
        {[
          {l:'Total Products', v:dashboardData?.totalProducts ?? catalog.length, color:'var(--accent)', I:Package},
          {l:'Total Stock', v:dashboardData?.totalStock ?? 0, color:'#0891B2', I:Package},
          {l:'Today\'s Dispatches', v:dashboardData?.todayDispatches ?? 0, color:'#06B6D4', I:Truck},
          {l:'Pending Requests', v:dashboardData?.pendingRequests ?? 0, color:'#D97706', I:Clock},
          {l:'Accepted Requests', v:dashboardData?.acceptedRequests ?? 0, color:'#16A34A', I:CheckCircle},
          {l:'Rejected Requests', v:dashboardData?.rejectedRequests ?? 0, color:'#DC2626', I:XCircle},
          {l:'Theft Alerts', v:dashboardData?.theftAlerts?.length ?? theftRecords.length, color:'#E11D48', I:ShieldAlert},
        ].map(s=>(
          <div key={s.l} className="card" style={{padding:'14px 16px',display:'flex',alignItems:'center',gap:10}}>
            <div style={{width:36,height:36,borderRadius:'var(--r-sm)',background:'var(--accent-lt)',
              display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
              <s.I size={16} strokeWidth={1.75} style={{color:s.color}}/>
            </div>
            <div>
              <p style={{fontSize:9.5,fontWeight:700,color:'var(--text-4)',textTransform:'uppercase',letterSpacing:'.06em'}}>{s.l}</p>
              <h3 style={{fontSize:20,fontWeight:700,color:'var(--text-h)',letterSpacing:'-.04em'}}>{s.v}</h3>
            </div>
          </div>
        ))}
      </motion.div>

      {/* Tab bar */}
      <motion.div variants={row} style={{display:'flex',gap:2,background:'var(--slate-100)',
        border:'1px solid var(--border)',padding:4,borderRadius:'var(--r-lg)',width:'fit-content',marginBottom:20}}>
        {TABS.map(t=>{
          const Ic=t.Icon; const active=tab===t.id
          return (
            <button key={t.id} onClick={()=>setTab(t.id)}
              style={{display:'flex',alignItems:'center',gap:6,padding:'7px 15px',border:'none',
                borderRadius:'var(--r-md)',fontFamily:'inherit',fontSize:12.5,
                fontWeight:active?600:500,cursor:'pointer',transition:'all .15s ease',
                background:active?'var(--surface)':'transparent',
                color:active?'var(--accent-dk)':'var(--text-3)',
                boxShadow:active?'var(--sh-1)':'none'}}>
              <Ic size={13} strokeWidth={1.75}/>{t.label}
            </button>
          )
        })}
      </motion.div>

      {/* ── Tab content ── */}
      <AnimatePresence mode="wait">

        {/* OVERVIEW */}
        {tab==='overview' && (
          <motion.div key="ov" initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} exit={{opacity:0}} transition={{duration:.2}}>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14,marginBottom:14}}>
              <div className="card">
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12}}>
                  <h3 style={{fontSize:14,fontWeight:600,color:'var(--text-h)'}}>Recent Requests</h3>
                  <button className="btn btn-secondary btn-xs" onClick={()=>setTab('requests')}>View All</button>
                </div>
                {requests.slice(0,5).length===0
                  ? <p style={{color:'var(--text-4)',fontSize:13,textAlign:'center',padding:'14px 0'}}>No requests yet</p>
                  : requests.slice(0,5).map(r=>{
                      const s=STATUS[r.status]||{cls:'badge-gray',label:r.status}
                      return (
                        <div key={r.id} style={{display:'flex',alignItems:'center',gap:9,padding:'7px 0',borderBottom:'1px solid var(--border)'}}>
                          <div style={{flex:1,minWidth:0}}>
                            <p style={{fontSize:12.5,fontWeight:600,color:'var(--text-h)'}}>{r.productName}</p>
                            <p style={{fontSize:11,color:'var(--text-3)'}}>{r.adminName} · {r.quantity} units</p>
                          </div>
                          <span className={`badge ${s.cls}`} style={{fontSize:10}}>{s.label}</span>
                        </div>
                      )
                    })
                }
              </div>
              <div className="card">
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12}}>
                  <h3 style={{fontSize:14,fontWeight:600,color:'var(--text-h)'}}>My Catalog</h3>
                  <button className="btn btn-secondary btn-xs" onClick={()=>setTab('catalog')}>Manage</button>
                </div>
                {catalog.slice(0,5).length===0
                  ? <div style={{textAlign:'center',padding:'14px 0'}}>
                      <p style={{color:'var(--text-4)',fontSize:13,marginBottom:8}}>No products yet</p>
                      <button className="btn btn-primary btn-sm" onClick={()=>setProductModal('new')}><Plus size={12}/> Add First Product</button>
                    </div>
                  : catalog.slice(0,5).map(p=>(
                      <div key={p.id} style={{display:'flex',alignItems:'center',gap:9,padding:'7px 0',borderBottom:'1px solid var(--border)'}}>
                        <div style={{flex:1,minWidth:0}}>
                          <p style={{fontSize:12.5,fontWeight:600,color:'var(--text-h)'}}>{p.name}</p>
                          <p style={{fontSize:11,color:'var(--text-3)'}}>{p.category} · ₹{Number(p.unitPrice).toLocaleString('en-IN')}</p>
                        </div>
                        <span className="badge badge-gray" style={{fontSize:10}}>{p.availableStock} avail</span>
                      </div>
                    ))
                }
              </div>
            </div>

            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
              <div className="card">
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12}}>
                  <h3 style={{fontSize:14,fontWeight:600,color:'var(--text-h)'}}>Low Stock Products</h3>
                  <button className="btn btn-secondary btn-xs" onClick={()=>setTab('catalog')}>View Catalog</button>
                </div>
                {(!dashboardData?.lowStockProducts || dashboardData.lowStockProducts.length === 0)
                  ? <p style={{color:'var(--text-4)',fontSize:13,textAlign:'center',padding:'14px 0'}}>No low stock products</p>
                  : dashboardData.lowStockProducts.slice(0,5).map(p=>(
                      <div key={p.id} style={{display:'flex',alignItems:'center',gap:9,padding:'7px 0',borderBottom:'1px solid var(--border)'}}>
                        <div style={{flex:1,minWidth:0}}>
                          <p style={{fontSize:12.5,fontWeight:600,color:'var(--text-h)'}}>{p.name}</p>
                          <p style={{fontSize:11,color:'var(--text-3)'}}>{p.category} · ₹{Number(p.unitPrice).toLocaleString('en-IN')}</p>
                        </div>
                        <span className="badge badge-danger" style={{fontSize:10}}>{p.availableStock} left</span>
                      </div>
                    ))
                }
              </div>
              <div className="card">
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12}}>
                  <h3 style={{fontSize:14,fontWeight:600,color:'var(--text-h)'}}>Theft Alerts</h3>
                  <button className="btn btn-secondary btn-xs" onClick={()=>setTab('theft')}>View Reports</button>
                </div>
                {(!dashboardData?.theftAlerts || dashboardData.theftAlerts.length === 0)
                  ? <p style={{color:'var(--text-4)',fontSize:13,textAlign:'center',padding:'14px 0'}}>No theft alerts recorded</p>
                  : dashboardData.theftAlerts.slice(0,5).map(t=>(
                      <div key={t.id} style={{display:'flex',alignItems:'center',gap:9,padding:'7px 0',borderBottom:'1px solid var(--border)'}}>
                        <div style={{flex:1,minWidth:0}}>
                          <p style={{fontSize:12.5,fontWeight:600,color:'var(--text-h)'}}>{t.productName}</p>
                          <p style={{fontSize:11,color:'var(--text-3)'}}>{new Date(t.date).toLocaleDateString('en-IN')} · Missing: {t.missingQuantity}</p>
                        </div>
                        <span className="badge badge-danger" style={{fontSize:10}}>Theft</span>
                      </div>
                    ))
                }
              </div>
            </div>
          </motion.div>
        )}

        {/* MY CATALOG */}
        {tab==='catalog' && (
          <motion.div key="cat" initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} exit={{opacity:0}} transition={{duration:.2}}>
            <div className="page-header" style={{marginBottom:14}}>
              <div>
                <h1 className="page-title">My Product Catalog</h1>
                <p className="page-subtitle">{catalog.length} products — owners can browse &amp; request these</p>
              </div>
              <div style={{display:'flex',gap:9,alignItems:'center'}}>
                <div className="search-bar">
                  <Search size={13}/><input placeholder="Search..." value={search} onChange={e=>setSearch(e.target.value)}/>
                  {search&&<button onClick={()=>setSearch('')} style={{background:'none',border:'none',cursor:'pointer',display:'flex'}}><X size={12}/></button>}
                </div>
                <button className="btn btn-primary btn-sm" onClick={()=>setProductModal('new')}><Plus size={13}/> Add</button>
              </div>
            </div>
            {loading
              ? <div className="loading-center"><div className="spinner"/></div>
              : filtered.length===0
                ? <div className="empty-state"><Package size={44}/><h3>No products yet</h3><p>Add products so owners can browse and request them</p></div>
                : <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))',gap:13}}>
                    {filtered.map(p=>(
                      <div key={p.id} className="card" style={{padding:'18px'}}>
                        {/* Image + Header row */}
                        <div style={{display:'flex',gap:12,alignItems:'flex-start',marginBottom:10}}>
                          <img
                            src={p.productImage ? `${API_BASE}${p.productImage}` : DEFAULT_IMG}
                            alt={p.name}
                            style={{width:56,height:56,borderRadius:8,objectFit:'cover',
                              flexShrink:0,border:'1.5px solid var(--border)',background:'var(--slate-100)'}}
                            onError={e=>{e.target.src=DEFAULT_IMG}}
                          />
                          <div style={{flex:1,minWidth:0}}>
                            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
                              <div>
                                <h3 style={{fontSize:13.5,fontWeight:700,color:'var(--text-h)'}}>{p.name}</h3>
                                {p.unit && (
                                  <p style={{fontSize:11.5,color:'var(--text-3)',fontWeight:500,marginTop:2}}>
                                    {p.unitSize ? p.unitSize : p.unit}
                                  </p>
                                )}
                              </div>
                              <div style={{display:'flex',gap:4,flexShrink:0,marginLeft:6}}>
                                <button className="btn-icon btn-icon-edit" onClick={()=>setProductModal(p)}><Edit2 size={12}/></button>
                                <button className="btn-icon btn-icon-delete" onClick={()=>delProduct(p.id)}><Trash2 size={12}/></button>
                              </div>
                            </div>
                            <div style={{display:'flex',gap:4,flexWrap:'wrap',marginTop:6}}>
                              <span className="badge badge-primary">{p.category}</span>
                              {p.brand&&<span className="badge badge-gray">{p.brand}</span>}
                            </div>
                          </div>
                        </div>
                        {/* Price + Stock */}
                        <div style={{display:'flex',justifyContent:'space-between',paddingTop:9,borderTop:'1px solid var(--border)'}}>
                          <div>
                            <p style={{fontSize:11,color:'var(--text-4)'}}>Purchase / Sell</p>
                            <p style={{fontSize:15,fontWeight:700,color:'var(--text-h)',letterSpacing:'-.02em'}}>
                              ₹{Number(p.purchasePrice||p.unitPrice||0).toLocaleString('en-IN')}
                              <span style={{fontSize:12,color:'var(--ok)',marginLeft:5}}>
                                / ₹{Number(p.sellingPrice||p.unitPrice||0).toLocaleString('en-IN')}
                              </span>
                            </p>
                          </div>
                          <div style={{textAlign:'right'}}>
                            <p style={{fontSize:11,color:'var(--text-4)'}}>Stock</p>
                            <p style={{fontSize:15,fontWeight:700,color:(p.quantity??p.availableStock)>0?'var(--ok)':'var(--err)'}}>
                              {p.quantity??p.availableStock} {p.unitSize || p.unit || 'units'}
                            </p>
                          </div>
                        </div>
                        {/* Extra info row */}
                        <div style={{display:'flex',gap:8,flexWrap:'wrap',marginTop:7}}>
                          {p.barcodeNumber&&<span style={{fontSize:10.5,color:'var(--text-3)'}}>🔖 {p.barcodeNumber}</span>}
                          {p.expiryDate&&<span style={{fontSize:10.5,color:'var(--text-3)'}}>⏰ Exp: {p.expiryDate}</span>}
                        </div>
                        {p.description&&<p style={{fontSize:11.5,color:'var(--text-3)',marginTop:6,lineHeight:1.5}}>{p.description}</p>}
                      </div>
                    ))}
                  </div>
            }
          </motion.div>
        )}

        {/* SUPPLY REQUESTS */}
        {tab==='requests' && (
          <motion.div key="req" initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} exit={{opacity:0}} transition={{duration:.2}}>
            <div className="page-header" style={{marginBottom:14}}>
              <h1 className="page-title">Supply Requests</h1>
              <button className="btn btn-primary btn-sm" onClick={()=>setReqModal(true)}><Send size={13}/> Send Request</button>
            </div>
            {loading
              ? <div className="loading-center"><div className="spinner"/></div>
              : requests.length===0
                ? <div className="empty-state"><Truck size={44}/><h3>No requests yet</h3></div>
                : <div className="table-container">
                    <table>
                      <thead><tr>
                        <th>#</th><th>Shop / Owner</th><th>Product</th><th>Qty</th>
                        <th>Direction</th><th>Status</th><th>Date</th><th>Actions</th>
                      </tr></thead>
                      <tbody>
                        {requests.map((r,i)=>{
                          const s=STATUS[r.status]||{cls:'badge-gray',label:r.status}
                          const fromOwner = r.direction==='OWNER_TO_SUPPLIER'
                          return (
                            <tr key={r.id}>
                              <td>{i+1}</td>
                              <td><strong>{r.adminShopName || r.adminName}</strong></td>
                              <td>
                                <strong>{r.productName}</strong>
                                {r.unit && (
                                  <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 2, fontWeight: 500 }}>
                                    {r.unitSize ? `${r.unitSize}` : r.unit}
                                  </div>
                                )}
                              </td>
                              <td><span className="badge badge-primary">{r.quantity}</span></td>
                              <td><span className="badge badge-gray" style={{fontSize:10}}>
                                {fromOwner?'Owner → Me':'Me → Owner'}
                              </span></td>
                              <td><span className={`badge ${s.cls}`}>{s.label}</span></td>
                              <td style={{fontSize:11.5,color:'var(--text-3)'}}>
                                {new Date(r.createdAt).toLocaleDateString('en-IN')}
                              </td>
                              <td>
                                <div style={{display:'flex',gap:4,flexWrap:'wrap'}}>
                                  {fromOwner && r.status==='PENDING' && (<>
                                    <button className="btn btn-primary btn-xs" disabled={busy} onClick={()=>updateStatus(r.id,'ACCEPTED')}>Accept</button>
                                    <button className="btn btn-danger btn-xs"  disabled={busy} onClick={()=>updateStatus(r.id,'REJECTED')}>Reject</button>
                                  </>)}
                                  {fromOwner && r.status==='ACCEPTED' && (
                                    <button className="btn btn-secondary btn-xs" disabled={busy} onClick={()=>updateStatus(r.id,'DISPATCHED')}>
                                      <Truck size={11}/> Dispatch
                                    </button>
                                  )}
                                  {!fromOwner && r.status==='PENDING' && (
                                    <button className="btn btn-secondary btn-xs" disabled={busy} onClick={()=>updateStatus(r.id,'CANCELLED')}>Cancel</button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
            }
          </motion.div>
        )}

        {/* BROWSE SHOPS */}
        {tab==='owners' && (
          <motion.div key="own" initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} exit={{opacity:0}} transition={{duration:.2}}>
            <div className="page-header" style={{marginBottom:14}}>
              <div>
                <h1 className="page-title">Registered Shops</h1>
                <p className="page-subtitle">Send supply requests directly to shop owners</p>
              </div>
            </div>
            {loading
              ? <div className="loading-center"><div className="spinner"/></div>
              : owners.length===0
                ? <div className="empty-state"><Users size={44}/><h3>No shops registered yet</h3></div>
                : <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))',gap:13}}>
                    {owners.map(o=>(
                      <div key={o.id} className="card" style={{padding:'18px'}}>
                        <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:12}}>
                          <div style={{width:42,height:42,borderRadius:'var(--r-md)',
                            background:'var(--gradient-primary)',display:'flex',alignItems:'center',
                            justifyContent:'center',color:'#fff',fontWeight:700,fontSize:15,flexShrink:0}}>
                            {(o.shopName||'S').charAt(0).toUpperCase()}
                          </div>
                          <div style={{minWidth:0}}>
                            <h3 style={{fontSize:14,fontWeight:700,color:'var(--text-h)',marginBottom:2}}>{o.shopName}</h3>
                            <p style={{fontSize:11.5,color:'var(--text-3)'}}>{o.shopCategory}</p>
                          </div>
                        </div>
                        <p style={{fontSize:12.5,color:'var(--text-2)',marginBottom:3}}>{o.fullName}</p>
                        <p style={{fontSize:12,color:'var(--text-3)',marginBottom:12}}>{o.email}</p>
                        <button className="btn btn-primary btn-sm" style={{width:'100%',justifyContent:'center'}}
                          onClick={()=>{
                            setReqModal(true);
                            // Set targeted owner prefilled state directly
                            setTimeout(() => {
                              const selectEl = document.getElementsByName('adminId')[0];
                              if (selectEl) {
                                selectEl.value = o.id;
                                selectEl.dispatchEvent(new Event('change', { bubbles: true }));
                              }
                            }, 50);
                          }}>
                          <Send size={12}/> Send Supply Request
                        </button>
                      </div>
                    ))}
                  </div>
            }
          </motion.div>
        )}

        {/* SUPPLIER DISPATCHES */}
        {tab==='dispatches' && (
          <motion.div key="disp" initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} exit={{opacity:0}} transition={{duration:.2}}>
            <div style={{display:'grid',gridTemplateColumns:'1fr 2fr',gap:16,alignItems:'flex-start'}}>
              {/* Form */}
              <div className="card">
                <h3 style={{fontSize:15,fontWeight:700,marginBottom:14}}>Dispatch Products to Owner</h3>
                <form onSubmit={handleDispatch}>
                  <div className="form-group" style={{marginBottom:12}}>
                    <label className="form-label">Select Shop Owner *</label>
                    <select className="form-input" style={{width:'100%',padding:8,borderRadius:6}}
                      value={dispatchForm.adminId} onChange={e=>setDispatchForm(p=>({...p,adminId:e.target.value,branchId:''}))} required>
                      <option value="">-- Select Shop --</option>
                      {owners.map(o=><option key={o.id} value={o.id}>{o.shopName} ({o.fullName})</option>)}
                    </select>
                  </div>
                  {(() => {
                    const selectedOwner = owners.find(o => String(o.id) === String(dispatchForm.adminId));
                    if (selectedOwner && selectedOwner.branches && selectedOwner.branches.length > 0) {
                      return (
                        <div className="form-group" style={{marginBottom:12}}>
                          <label className="form-label">Target Branch *</label>
                          <select className="form-input" style={{width:'100%',padding:8,borderRadius:6}}
                            value={dispatchForm.branchId} onChange={e=>setDispatchForm(p=>({...p,branchId:e.target.value}))} required>
                            <option value="">-- Select Target Branch --</option>
                            {selectedOwner.branches.map(b=><option key={b.id} value={b.id}>{b.name} ({b.code})</option>)}
                          </select>
                        </div>
                      );
                    }
                    return null;
                  })()}
                  <div className="form-group" style={{marginBottom:12}}>
                    <label className="form-label">Select Product *</label>
                    <select className="form-input" style={{width:'100%',padding:8,borderRadius:6}}
                      value={dispatchForm.productId} onChange={e=>setDispatchForm(p=>({...p,productId:e.target.value}))} required>
                      <option value="">-- Select Product --</option>
                      {catalog.map(p=><option key={p.id} value={p.id}>{p.name} {p.unitSize ? `(${p.unitSize})` : p.unit ? `(${p.unit})` : ''} (Avail: {p.availableStock})</option>)}
                    </select>
                  </div>
                  <div className="form-group" style={{marginBottom:16}}>
                    <label className="form-label">Quantity to Dispatch *</label>
                    <input type="number" min="1" className="form-input" style={{width:'100%',padding:8,borderRadius:6}}
                      placeholder="e.g. 100" value={dispatchForm.quantity}
                      onChange={e=>setDispatchForm(p=>({...p,quantity:e.target.value}))} required/>
                  </div>
                  <button type="submit" className="btn btn-primary" style={{width:'100%',justifyContent:'center'}} disabled={busy}>
                    {busy ? <span className="btn-spinner"/> : '🚚 Dispatch Now'}
                  </button>
                </form>
              </div>

              {/* History */}
              <div className="card">
                <h3 style={{fontSize:15,fontWeight:700,marginBottom:14}}>Dispatch History</h3>
                {dispatches.length===0
                  ? <p style={{color:'var(--text-4)',fontSize:13,textAlign:'center',padding:'20px 0'}}>No dispatches recorded yet</p>
                  : <div className="table-container">
                      <table>
                        <thead><tr>
                          <th>ID</th><th>Owner / Shop</th><th>Product</th><th>Qty</th><th>Date</th><th>Status</th>
                        </tr></thead>
                        <tbody>
                          {dispatches.map(d=>(
                            <tr key={d.id}>
                              <td>#{d.id}</td>
                              <td>
                                <strong>{d.adminShopName || d.adminName}</strong>
                                {d.branchName && (
                                  <span style={{ display: 'block', fontSize: '11px', color: 'var(--text-3)', marginTop: 2 }}>
                                    Branch: {d.branchName}
                                  </span>
                                )}
                              </td>
                              <td>{d.productName}</td>
                              <td><span className="badge badge-primary">{d.quantity}</span></td>
                              <td style={{fontSize:11.5}}>{new Date(d.dispatchDate).toLocaleDateString('en-IN')}</td>
                              <td>
                                <span className={`badge ${d.status==='ACCEPTED'?'badge-success':d.status==='REJECTED'?'badge-danger':'badge-warning'}`}>
                                  {d.status}
                                </span>
                                {d.status==='REJECTED'&&d.rejectionReason&&
                                  <p style={{fontSize:10.5,color:'var(--err)',marginTop:3,fontWeight:500}}>Reason: {d.rejectionReason}</p>
                                }
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                }
              </div>
            </div>
          </motion.div>
        )}

        {/* THEFT DETECTION */}
        {tab==='theft' && (
          <motion.div key="th" initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} exit={{opacity:0}} transition={{duration:.2}}>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,alignItems:'flex-start'}}>
              {/* Verify Stock Card */}
              <div className="card">
                <h3 style={{fontSize:15,fontWeight:700,marginBottom:4}}>Daily Stock Verification</h3>
                <p style={{fontSize:12,color:'var(--text-3)',marginBottom:14}}>Verify actual physical stock count at the end of the day to detect discrepancies.</p>
                {catalog.length===0
                  ? <p style={{color:'var(--text-4)',fontSize:13,textAlign:'center',padding:'20px 0'}}>No products in catalog</p>
                  : <div className="table-container" style={{maxHeight:350,overflowY:'auto'}}>
                      <table>
                        <thead><tr>
                          <th>Product</th><th>Expected</th><th>Physical Count</th><th>Action</th>
                        </tr></thead>
                        <tbody>
                          {catalog.map(p=>(
                            <tr key={p.id}>
                              <td>{p.name}</td>
                              <td><strong>{p.availableStock}</strong></td>
                              <td>
                                <input type="number" min="0" placeholder="Actual"
                                  style={{width:70,padding:'5px 8px',borderRadius:5,border:'1.5px solid var(--border)',background:'var(--surface)'}}
                                  value={physicalStockCounts[p.id] ?? ''}
                                  onChange={e=>setPhysicalStockCounts(prev=>({...prev,[p.id]:e.target.value}))}/>
                              </td>
                              <td>
                                <button className="btn btn-primary btn-xs" disabled={busy}
                                  onClick={()=>handleVerifyTheft(p.id, physicalStockCounts[p.id])}>
                                  Verify
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                }
              </div>

              {/* Theft Reports Card */}
              <div className="card">
                <h3 style={{fontSize:15,fontWeight:700,marginBottom:14}}>Theft & Loss Reports</h3>
                {theftRecords.length===0
                  ? <p style={{color:'var(--text-4)',fontSize:13,textAlign:'center',padding:'20px 0'}}>No theft reports recorded yet</p>
                  : <div className="table-container">
                      <table>
                        <thead><tr>
                          <th>Date</th><th>Product</th><th>Expected</th><th>Actual</th><th>Missing</th>
                        </tr></thead>
                        <tbody>
                          {theftRecords.map(t=>(
                            <tr key={t.id}>
                              <td style={{fontSize:11.5}}>{new Date(t.date).toLocaleDateString('en-IN')}</td>
                              <td><strong>{t.productName}</strong></td>
                              <td>{t.expectedQuantity}</td>
                              <td>{t.actualQuantity}</td>
                              <td><span className="badge badge-danger">-{t.missingQuantity}</span></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                }
              </div>
            </div>
          </motion.div>
        )}

        {/* AUDIT TRAILS */}
        {tab==='audit' && (
          <motion.div key="aud" initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} exit={{opacity:0}} transition={{duration:.2}}>
            <div className="card">
              <h3 style={{fontSize:15,fontWeight:700,marginBottom:14}}>System Audit History</h3>
              {auditLogs.length===0
                ? <p style={{color:'var(--text-4)',fontSize:13,textAlign:'center',padding:'20px 0'}}>No audit logs recorded yet</p>
                : <div className="table-container">
                    <table>
                      <thead><tr>
                        <th>Date &amp; Time</th><th>User</th><th>Action</th><th>Product</th><th>Quantity</th>
                      </tr></thead>
                      <tbody>
                        {auditLogs.map(l=>(
                          <tr key={l.id}>
                            <td style={{fontSize:11.5}}>{new Date(l.dateTime).toLocaleString('en-IN')}</td>
                            <td><strong>{l.userEmail}</strong></td>
                            <td>
                              <span className={`badge ${
                                l.action==='DISPATCH'?'badge-primary':
                                l.action==='ACCEPT'?'badge-success':
                                l.action==='REJECT'?'badge-danger':
                                l.action==='THEFT_DETECTION'?'badge-danger':'badge-gray'
                              }`}>
                                {l.action}
                              </span>
                            </td>
                            <td>{l.productName}</td>
                            <td>{l.quantity}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
              }
            </div>
          </motion.div>
        )}

      </AnimatePresence>

      {/* Modals */}
      {productModal && (
        <ProductModal
          product={productModal==='new' ? null : productModal}
          onClose={()=>setProductModal(null)}
          onSaved={load}
        />
      )}
      {reqModal && (
        <SendRequestModal
          owners={owners}
          myCatalog={catalog}
          onClose={()=>setReqModal(false)}
          onSent={load}
        />
      )}
    </motion.div>
  )
}
