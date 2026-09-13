import React, { useState } from 'react'
import { BrowserRouter, Routes, Route, NavLink, useLocation } from 'react-router-dom'
import { AppProvider, useApp } from './context/AppContext'

// Pages
import Dashboard from './pages/Dashboard'
import Vessels from './pages/Vessels'
import CongestionPage from './pages/CongestionPage'
import BerthOptimizer from './pages/BerthOptimizer'
import CraneOptimizer from './pages/CraneOptimizer'
import SmartRouting from './pages/SmartRouting'
import YardManagement from './pages/YardManagement'
import Plan72h from './pages/Plan72h'
import WhatIf from './pages/WhatIf'
import AlertsPage from './pages/AlertsPage'
import DataManagement from './pages/DataManagement'
import Copilot from './pages/Copilot'
import PortMap from './pages/PortMap'

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: '⊞', exact: true },
  { to: '/vessels', label: 'Vessels', icon: '🚢' },
  { to: '/congestion', label: 'Congestion', icon: '📊' },
  { to: '/berth-optimizer', label: 'Berth Optimizer', icon: '⚓' },
  { to: '/crane-optimizer', label: 'Crane Optimizer', icon: '🏗️' },
  { to: '/routing', label: 'Smart Routing', icon: '🗺️' },
  { to: '/yard', label: 'Yard Mgmt', icon: '📦' },
  { to: '/plan-72h', label: '72-Hour Plan', icon: '📅' },
  { to: '/what-if', label: 'What-If', icon: '🔮' },
  { to: '/port-map', label: 'Port Map', icon: '🗺' },
  { to: '/alerts', label: 'Alerts', icon: '🔔', badge: true },
  { to: '/data', label: 'Data', icon: '💾' },
  { to: '/copilot', label: 'AI Copilot', icon: '🤖' },
]

function Sidebar() {
  const { simTime, criticalAlerts, loading } = useApp()
  const location = useLocation()

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div className="logo-icon">⚓</div>
        <div>
          <div className="logo-text">PortFlow AI</div>
          <div className="logo-tag">Operations</div>
        </div>
      </div>

      <nav className="sidebar-nav">
        <div className="nav-section">Navigation</div>
        {NAV_ITEMS.map(item => {
          const isActive = item.exact
            ? location.pathname === item.to
            : location.pathname.startsWith(item.to)
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={`nav-item ${isActive ? 'active' : ''}`}
            >
              <span className="nav-icon">{item.icon}</span>
              <span>{item.label}</span>
              {item.badge && criticalAlerts.length > 0 && (
                <span className="nav-badge">{criticalAlerts.length}</span>
              )}
            </NavLink>
          )
        })}
      </nav>

      <div className="sidebar-footer">
        <div className="sim-status">
          <div className={`status-dot ${loading ? '' : ''}`} />
          <span>{loading ? 'Loading...' : 'LIVE SIM'}</span>
        </div>
        <span style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--text-muted)' }}>
          {simTime.toLocaleTimeString()}
        </span>
      </div>
    </aside>
  )
}

function Header() {
  const { dashboard, simTime, criticalAlerts, loadAll, loading } = useApp()
  const location = useLocation()

  const pageName = NAV_ITEMS.find(n =>
    n.exact ? location.pathname === n.to : location.pathname.startsWith(n.to)
  )?.label || 'Dashboard'

  return (
    <header className="app-header">
      <div className="header-left">
        <div>
          <div className="header-title">{pageName}</div>
          <div className="header-subtitle">Operations Command Center – Simulated Data</div>
        </div>
      </div>
      <div className="header-right">
        {criticalAlerts.length > 0 && (
          <div className="header-badge badge-live">
            <span className="notif-dot" />
            {criticalAlerts.length} Critical
          </div>
        )}
        <div className="header-badge badge-sim">
          ⚡ DEMO MODE
        </div>
        <div className="header-time">{simTime.toLocaleTimeString()}</div>
        <button
          className="btn btn-secondary btn-sm"
          onClick={loadAll}
          disabled={loading}
        >
          {loading ? '⏳' : '↻'} Refresh
        </button>
      </div>
    </header>
  )
}

function AppLayout() {
  return (
    <div className="app-layout">
      <Sidebar />
      <div className="main-content">
        <Header />
        <main className="page" style={{ padding: 0 }}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/vessels" element={<Vessels />} />
            <Route path="/congestion" element={<CongestionPage />} />
            <Route path="/berth-optimizer" element={<BerthOptimizer />} />
            <Route path="/crane-optimizer" element={<CraneOptimizer />} />
            <Route path="/routing" element={<SmartRouting />} />
            <Route path="/yard" element={<YardManagement />} />
            <Route path="/plan-72h" element={<Plan72h />} />
            <Route path="/what-if" element={<WhatIf />} />
            <Route path="/alerts" element={<AlertsPage />} />
            <Route path="/data" element={<DataManagement />} />
            <Route path="/copilot" element={<Copilot />} />
            <Route path="/port-map" element={<PortMap />} />
          </Routes>
        </main>
      </div>
    </div>
  )
}

function App() {
  return (
    <BrowserRouter>
      <AppProvider>
        <AppLayout />
      </AppProvider>
    </BrowserRouter>
  )
}

export default App
