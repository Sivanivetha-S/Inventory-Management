import React, { useState } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import Topbar from './Topbar'
import Chatbot from '../chatbot/Chatbot'
import { useAuth } from '../../context/AuthContext'
import './AppLayout.css'

export default function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const { activeBranchId } = useAuth()

  return (
    <div className={`app-layout ${sidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
      <Sidebar open={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />
      <div className="app-main">
        <Topbar onMenuClick={() => setSidebarOpen(!sidebarOpen)} />
        <main className="app-content">
          <Outlet key={activeBranchId} />
        </main>
      </div>
      {/* AI assistant — available on every authenticated page */}
      <Chatbot />
    </div>
  )
}
