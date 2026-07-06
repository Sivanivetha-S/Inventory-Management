import React, { useEffect, useState, useCallback } from 'react'
import { productAPI } from '../services/api'
import toast from 'react-hot-toast'
import { FiPlus, FiEdit2, FiTrash2, FiSearch, FiPackage, FiX } from 'react-icons/fi'

const EMPTY_FORM = {
  name: '', category: '', purchasePrice: '', sellingPrice: '',
  currentStock: '', minimumStockAlert: ''
}

export default function Products() {
  const [products, setProducts]   = useState([])
  const [loading, setLoading]     = useState(true)
  const [search, setSearch]       = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing]     = useState(null)
  const [form, setForm]           = useState(EMPTY_FORM)
  const [errors, setErrors]       = useState({})
  const [saving, setSaving]       = useState(false)
  const [deleteId, setDeleteId]   = useState(null)

  const load = useCallback(() => {
    setLoading(true)
    productAPI.getAll()
      .then(r => setProducts(r.data.data))
      .catch(() => toast.error('Failed to load products'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.category.toLowerCase().includes(search.toLowerCase())
  )

  const openAdd = () => {
    setEditing(null)
    setForm(EMPTY_FORM)
    setErrors({})
    setModalOpen(true)
  }

  const openEdit = (product) => {
    setEditing(product.id)
    setForm({
      name: product.name,
      category: product.category,
      purchasePrice: product.purchasePrice,
      sellingPrice: product.sellingPrice,
      currentStock: product.currentStock,
      minimumStockAlert: product.minimumStockAlert,
    })
    setErrors({})
    setModalOpen(true)
  }

  const validate = () => {
    const e = {}
    if (!form.name.trim()) e.name = 'Name is required'
    if (!form.category.trim()) e.category = 'Category is required'
    if (!form.purchasePrice || form.purchasePrice <= 0) e.purchasePrice = 'Valid purchase price required'
    if (!form.sellingPrice || form.sellingPrice <= 0) e.sellingPrice = 'Valid selling price required'
    if (form.currentStock === '' || form.currentStock < 0) e.currentStock = 'Stock cannot be negative'
    if (form.minimumStockAlert === '' || form.minimumStockAlert < 0) e.minimumStockAlert = 'Min alert cannot be negative'
    return e
  }

  const handleSave = async (e) => {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length) { setErrors(errs); return }
    setSaving(true)
    try {
      const payload = {
        name: form.name, category: form.category,
        purchasePrice: parseFloat(form.purchasePrice),
        sellingPrice: parseFloat(form.sellingPrice),
        currentStock: parseInt(form.currentStock),
        minimumStockAlert: parseInt(form.minimumStockAlert),
      }
      if (editing) {
        await productAPI.update(editing, payload)
        toast.success('Product updated!')
      } else {
        await productAPI.create(payload)
        toast.success('Product added!')
      }
      setModalOpen(false)
      load()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id) => {
    try {
      await productAPI.delete(id)
      toast.success('Product deleted')
      setDeleteId(null)
      load()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Delete failed')
    }
  }

  const ch = (e) => {
    setForm(p => ({ ...p, [e.target.name]: e.target.value }))
    setErrors(p => ({ ...p, [e.target.name]: '' }))
  }

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Products</h1>
          <p className="page-subtitle">{products.length} total products</p>
        </div>
        <div style={{ display:'flex', gap:'12px', alignItems:'center' }}>
          <div className="search-bar">
            <FiSearch style={{ color:'var(--gray)' }} />
            <input placeholder="Search products..." value={search} onChange={e => setSearch(e.target.value)} />
            {search && <button onClick={() => setSearch('')} style={{ background:'none',border:'none',cursor:'pointer',color:'var(--gray)' }}><FiX /></button>}
          </div>
          <button className="btn btn-primary" onClick={openAdd}><FiPlus /> Add Product</button>
        </div>
      </div>

      {loading
        ? <div className="loading-center"><div className="spinner" /></div>
        : filtered.length === 0
          ? <div className="empty-state"><FiPackage size={48} /><h3>No products found</h3><p>Add your first product to get started</p></div>
          : <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>#</th><th>Name</th><th>Category</th>
                    <th>Purchase</th><th>Selling</th><th>Stock</th>
                    <th>Min Alert</th><th>Status</th><th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((p, i) => (
                    <tr key={p.id}>
                      <td>{i + 1}</td>
                      <td><strong>{p.name}</strong></td>
                      <td><span className="badge badge-primary">{p.category}</span></td>
                      <td>₹{Number(p.purchasePrice).toLocaleString('en-IN')}</td>
                      <td>₹{Number(p.sellingPrice).toLocaleString('en-IN')}</td>
                      <td><span className={`badge ${p.lowStock ? 'badge-danger' : 'badge-success'}`}>{p.currentStock}</span></td>
                      <td>{p.minimumStockAlert}</td>
                      <td>
                        {p.lowStock
                          ? <span className="badge badge-danger">⚠ Low Stock</span>
                          : <span className="badge badge-success">✓ OK</span>}
                      </td>
                      <td>
                        <div style={{ display:'flex', gap:'6px' }}>
                          <button className="btn-icon btn-icon-edit" onClick={() => openEdit(p)} title="Edit"><FiEdit2 /></button>
                          <button className="btn-icon btn-icon-delete" onClick={() => setDeleteId(p.id)} title="Delete"><FiTrash2 /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
      }

      {/* Add/Edit Modal */}
      {modalOpen && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModalOpen(false)}>
          <div className="modal-box">
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
              <h2 style={{ fontSize:20, fontWeight:700 }}>{editing ? 'Edit Product' : 'Add Product'}</h2>
              <button className="btn-icon" style={{ background:'#f3f4f6', color:'#374151' }} onClick={() => setModalOpen(false)}><FiX /></button>
            </div>
            <form onSubmit={handleSave}>
              <div className="form-group">
                <label className="form-label">Product Name *</label>
                <input name="name" className={`form-input ${errors.name?'error':''}`} value={form.name} onChange={ch} placeholder="e.g. Rice (5kg)" />
                {errors.name && <p className="form-error">{errors.name}</p>}
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                <div className="form-group">
                  <label className="form-label">Category *</label>
                  <input name="category" className={`form-input ${errors.category?'error':''}`} value={form.category} onChange={ch} placeholder="e.g. Grocery" />
                  {errors.category && <p className="form-error">{errors.category}</p>}
                </div>
                <div className="form-group">
                  <label className="form-label">Min Stock Alert *</label>
                  <input type="number" name="minimumStockAlert" className={`form-input ${errors.minimumStockAlert?'error':''}`} value={form.minimumStockAlert} onChange={ch} placeholder="5" />
                  {errors.minimumStockAlert && <p className="form-error">{errors.minimumStockAlert}</p>}
                </div>
                <div className="form-group">
                  <label className="form-label">Purchase Price (₹) *</label>
                  <input type="number" step="0.01" name="purchasePrice" className={`form-input ${errors.purchasePrice?'error':''}`} value={form.purchasePrice} onChange={ch} placeholder="0.00" />
                  {errors.purchasePrice && <p className="form-error">{errors.purchasePrice}</p>}
                </div>
                <div className="form-group">
                  <label className="form-label">Selling Price (₹) *</label>
                  <input type="number" step="0.01" name="sellingPrice" className={`form-input ${errors.sellingPrice?'error':''}`} value={form.sellingPrice} onChange={ch} placeholder="0.00" />
                  {errors.sellingPrice && <p className="form-error">{errors.sellingPrice}</p>}
                </div>
                <div className="form-group">
                  <label className="form-label">Current Stock *</label>
                  <input type="number" name="currentStock" className={`form-input ${errors.currentStock?'error':''}`} value={form.currentStock} onChange={ch} placeholder="0" />
                  {errors.currentStock && <p className="form-error">{errors.currentStock}</p>}
                </div>
              </div>
              <div style={{ display:'flex', gap:12, justifyContent:'flex-end', marginTop:8 }}>
                <button type="button" className="btn btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? <span className="btn-spinner" /> : (editing ? 'Update' : 'Add Product')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {deleteId && (
        <div className="modal-overlay">
          <div className="modal-box" style={{ maxWidth:400, textAlign:'center' }}>
            <div style={{ fontSize:48, marginBottom:16 }}>🗑️</div>
            <h3 style={{ fontSize:20, fontWeight:700, marginBottom:8 }}>Delete Product?</h3>
            <p style={{ color:'var(--gray)', marginBottom:24 }}>This action cannot be undone.</p>
            <div style={{ display:'flex', gap:12, justifyContent:'center' }}>
              <button className="btn btn-secondary" onClick={() => setDeleteId(null)}>Cancel</button>
              <button className="btn btn-danger" onClick={() => handleDelete(deleteId)}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
