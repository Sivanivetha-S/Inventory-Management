import React, { useEffect, useState } from 'react'
import { Plus, Edit2, Trash2, Power, Eye, Building2, MapPin, Phone, CheckCircle, XCircle } from 'lucide-react'
import { branchAPI } from '../services/api'
import toast from 'react-hot-toast'
import './Settings.css'

export default function Settings() {
  const [branches, setBranches] = useState([])
  const [loading, setLoading] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [editingBranch, setEditingBranch] = useState(null)
  
  // Form fields
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [city, setCity] = useState('')
  const [state, setState] = useState('')
  const [pincode, setPincode] = useState('')
  const [contactNumber, setContactNumber] = useState('')
  const [active, setActive] = useState(true)

  const fetchBranches = async () => {
    setLoading(true)
    try {
      const res = await branchAPI.getAll()
      if (res.data?.success) {
        setBranches(res.data.data || [])
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to fetch branches')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchBranches()
  }, [])

  const openAddModal = () => {
    setEditingBranch(null)
    setName('')
    setAddress('')
    setCity('')
    setState('')
    setPincode('')
    setContactNumber('')
    setActive(true)
    setShowModal(true)
  }

  const openEditModal = (b) => {
    setEditingBranch(b)
    setName(b.name)
    setAddress(b.address)
    setCity(b.city)
    setState(b.state)
    setPincode(b.pincode)
    setContactNumber(b.contactNumber)
    setActive(b.active)
    setShowModal(true)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const payload = { name, address, city, state, pincode, contactNumber, active }
    try {
      if (editingBranch) {
        const res = await branchAPI.update(editingBranch.id, payload)
        if (res.data?.success) {
          toast.success('Branch updated successfully')
          fetchBranches()
          setShowModal(false)
        }
      } else {
        const res = await branchAPI.create(payload)
        if (res.data?.success) {
          toast.success('Branch created successfully')
          fetchBranches()
          setShowModal(false)
        }
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save branch')
    }
  }

  const handleToggle = async (id) => {
    try {
      const res = await branchAPI.toggle(id)
      if (res.data?.success) {
        toast.success(res.data.message)
        fetchBranches()
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update status')
    }
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this branch?')) return
    try {
      const res = await branchAPI.delete(id)
      if (res.data?.success) {
        toast.success('Branch deleted successfully')
        fetchBranches()
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete branch')
    }
  }

  return (
    <div className="settings-page">
      <div className="page-header-actions">
        <div>
          <h2 className="page-title">Branch Management</h2>
          <p className="page-subtitle">Add, edit and manage branches under this business account.</p>
        </div>
        <button className="btn btn-primary btn-with-icon" onClick={openAddModal}>
          <Plus size={16} /> Add Branch
        </button>
      </div>

      <div className="card settings-card">
        {loading ? (
          <div className="text-center py-4">Loading branches...</div>
        ) : branches.length === 0 ? (
          <div className="empty-state text-center py-5">
            <Building2 size={48} className="text-muted mb-3" />
            <h3>No Branches Found</h3>
            <p className="text-muted">Create a branch to start isolating inventory and staff data.</p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th>Branch Code</th>
                  <th>Branch Name</th>
                  <th>Contact Info</th>
                  <th>Location</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {branches.map((b) => (
                  <tr key={b.id}>
                    <td>
                      <span className="branch-code-badge">{b.code}</span>
                    </td>
                    <td>
                      <div className="font-semibold">{b.name}</div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                          <Phone size={12} style={{ marginRight: 4, display: 'inline' }} />
                          {b.contactNumber}
                        </span>
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span>{b.address}</span>
                        <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                          {b.city}, {b.state} - {b.pincode}
                        </span>
                      </div>
                    </td>
                    <td>
                      <span className={`badge ${b.active ? 'badge-success' : 'badge-danger'}`}>
                        {b.active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>
                      <div className="actions-cell">
                        <button className="action-btn" title="Toggle Active Status" onClick={() => handleToggle(b.id)}>
                          <Power size={15} />
                        </button>
                        <button className="action-btn" title="Edit" onClick={() => openEditModal(b)}>
                          <Edit2 size={15} />
                        </button>
                        <button className="action-btn action-btn-danger" title="Delete" onClick={() => handleDelete(b.id)}>
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <div className="modal-backdrop show">
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">{editingBranch ? 'Edit Branch' : 'Add New Branch'}</h5>
                <button type="button" className="btn-close" onClick={() => setShowModal(false)}></button>
              </div>
              <form onSubmit={handleSubmit}>
                <div className="modal-body">
                  <div className="form-group mb-3">
                    <label className="form-label required">Branch Name</label>
                    <input
                      type="text"
                      className="form-input"
                      required
                      placeholder="e.g., Chennai Branch"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </div>
                  <div className="form-group mb-3">
                    <label className="form-label required">Address</label>
                    <textarea
                      className="form-input"
                      required
                      rows={2}
                      placeholder="Street address..."
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                    />
                  </div>
                  <div className="row">
                    <div className="col-6 mb-3">
                      <label className="form-label required">City</label>
                      <input
                        type="text"
                        className="form-input"
                        required
                        placeholder="e.g., Chennai"
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                      />
                    </div>
                    <div className="col-6 mb-3">
                      <label className="form-label required">State</label>
                      <input
                        type="text"
                        className="form-input"
                        required
                        placeholder="e.g., Tamil Nadu"
                        value={state}
                        onChange={(e) => setState(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="row">
                    <div className="col-6 mb-3">
                      <label className="form-label required">Pincode</label>
                      <input
                        type="text"
                        className="form-input"
                        required
                        placeholder="e.g., 600001"
                        value={pincode}
                        onChange={(e) => setPincode(e.target.value)}
                      />
                    </div>
                    <div className="col-6 mb-3">
                      <label className="form-label required">Contact Number</label>
                      <input
                        type="text"
                        className="form-input"
                        required
                        placeholder="e.g., +91 9876543210"
                        value={contactNumber}
                        onChange={(e) => setContactNumber(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="form-check mt-2">
                    <input
                      type="checkbox"
                      id="branch-active"
                      className="form-check-input"
                      checked={active}
                      onChange={(e) => setActive(e.target.checked)}
                    />
                    <label htmlFor="branch-active" className="form-check-label">
                      Activate this branch immediately
                    </label>
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary">
                    {editingBranch ? 'Update Branch' : 'Add Branch'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
