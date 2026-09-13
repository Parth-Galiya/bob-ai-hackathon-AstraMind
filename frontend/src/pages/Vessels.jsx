import React, { useState } from 'react'
import { useApp } from '../context/AppContext'
import { useNavigate } from 'react-router-dom'

const RISK_ORDER = { critical: 4, high: 3, medium: 2, low: 1 }
const PRIORITY_ORDER = { critical: 4, high: 3, normal: 2, low: 1 }

function getRiskColor(level) {
  return { critical: '#ff3b5c', high: '#ff7b00', medium: '#ffc107', low: '#00d97e' }[level] || '#8a9bbf'
}

export default function Vessels() {
  const { vessels, loading } = useApp()
  const navigate = useNavigate()
  const [sortBy, setSortBy] = useState('risk')
  const [filterRisk, setFilterRisk] = useState('all')
  const [filterPriority, setFilterPriority] = useState('all')
  const [search, setSearch] = useState('')

  let filtered = vessels
  if (filterRisk !== 'all') filtered = filtered.filter(v => v.risk_level === filterRisk)
  if (filterPriority !== 'all') filtered = filtered.filter(v => v.priority === filterPriority)
  if (search) {
    const s = search.toLowerCase()
    filtered = filtered.filter(v =>
      v.vessel_id.toLowerCase().includes(s) ||
      v.vessel_name?.toLowerCase().includes(s) ||
      v.assigned_berth?.toLowerCase().includes(s)
    )
  }

  if (sortBy === 'risk') filtered = [...filtered].sort((a, b) => (RISK_ORDER[b.risk_level] || 0) - (RISK_ORDER[a.risk_level] || 0))
  if (sortBy === 'priority') filtered = [...filtered].sort((a, b) => (PRIORITY_ORDER[b.priority] || 0) - (PRIORITY_ORDER[a.priority] || 0))
  if (sortBy === 'eta') filtered = [...filtered].sort((a, b) => a.eta.localeCompare(b.eta))
  if (sortBy === 'wait') filtered = [...filtered].sort((a, b) => (b.predicted_wait || b.waiting_time || 0) - (a.predicted_wait || a.waiting_time || 0))
  if (sortBy === 'containers') filtered = [...filtered].sort((a, b) => b.containers - a.containers)

  const riskDist = {
    critical: vessels.filter(v => v.risk_level === 'critical').length,
    high: vessels.filter(v => v.risk_level === 'high').length,
    medium: vessels.filter(v => v.risk_level === 'medium').length,
    low: vessels.filter(v => v.risk_level === 'low').length,
  }

  return (
    <div style={{ padding: 24 }}>
      <div className="page-header">
        <div className="page-title">🚢 Vessel Operations</div>
        <div className="page-subtitle">Risk analysis and assignment status for all vessels in the simulation</div>
      </div>

      {/* Risk Summary */}
      <div className="kpi-grid" style={{ marginBottom: 20 }}>
        {Object.entries(riskDist).map(([level, count]) => (
          <div key={level} className="kpi-card" style={{ cursor: 'pointer' }}
            onClick={() => setFilterRisk(filterRisk === level ? 'all' : level)}>
            <div className="kpi-label">{level.toUpperCase()}</div>
            <div className="kpi-value" style={{ color: getRiskColor(level) }}>{count}</div>
            <div className="kpi-sub">vessels</div>
            <div className="kpi-accent" style={{ background: getRiskColor(level) }} />
          </div>
        ))}
        <div className="kpi-card">
          <div className="kpi-label">TOTAL</div>
          <div className="kpi-value">{vessels.length}</div>
          <div className="kpi-sub">vessels monitored</div>
          <div className="kpi-accent" style={{ background: 'var(--accent-blue)' }} />
        </div>
      </div>

      {/* Filters */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div className="input-group" style={{ margin: 0, flex: 1, minWidth: 160 }}>
            <label className="input-label">Search</label>
            <input className="form-input" placeholder="ID, Name, Berth…"
              value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div className="input-group" style={{ margin: 0 }}>
            <label className="input-label">Risk Filter</label>
            <select className="form-select" value={filterRisk} onChange={e => setFilterRisk(e.target.value)}>
              <option value="all">All</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>
          <div className="input-group" style={{ margin: 0 }}>
            <label className="input-label">Priority</label>
            <select className="form-select" value={filterPriority} onChange={e => setFilterPriority(e.target.value)}>
              <option value="all">All</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="normal">Normal</option>
              <option value="low">Low</option>
            </select>
          </div>
          <div className="input-group" style={{ margin: 0 }}>
            <label className="input-label">Sort By</label>
            <select className="form-select" value={sortBy} onChange={e => setSortBy(e.target.value)}>
              <option value="risk">Risk</option>
              <option value="priority">Priority</option>
              <option value="eta">ETA</option>
              <option value="wait">Wait Time</option>
              <option value="containers">Containers</option>
            </select>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={() => {
            setFilterRisk('all'); setFilterPriority('all'); setSearch(''); setSortBy('risk')
          }}>Clear</button>
        </div>
      </div>

      {/* Table */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">Vessel Register</div>
          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
            Showing {filtered.length} of {vessels.length} vessels
          </span>
        </div>
        {loading ? <div className="spinner" /> : (
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Name</th>
                  <th>ETA</th>
                  <th>ETD</th>
                  <th>Containers</th>
                  <th>Size</th>
                  <th>Priority</th>
                  <th>Berth</th>
                  <th>Cranes</th>
                  <th>Wait (h)</th>
                  <th>Risk</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(v => {
                  const etaDate = new Date(v.eta)
                  const etdDate = new Date(v.etd)
                  const wait = v.predicted_wait || v.waiting_time || 0
                  return (
                    <tr key={v.vessel_id}>
                      <td><code style={{ color: 'var(--accent-cyan)', fontSize: 11 }}>{v.vessel_id}</code></td>
                      <td><strong style={{ fontSize: 13 }}>{v.vessel_name}</strong></td>
                      <td style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--text-secondary)' }}>
                        {etaDate.toLocaleDateString()} {etaDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--text-secondary)' }}>
                        {etdDate.toLocaleDateString()} {etdDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td style={{ fontFamily: 'monospace' }}>{v.containers?.toLocaleString()}</td>
                      <td style={{ textTransform: 'capitalize', color: 'var(--text-secondary)' }}>{v.vessel_size}</td>
                      <td>
                        <span className={`priority-badge priority-${v.priority}`}>{v.priority}</span>
                      </td>
                      <td>
                        {v.assigned_berth
                          ? <strong style={{ color: 'var(--accent-cyan)' }}>{v.assigned_berth}</strong>
                          : <span style={{ color: 'var(--text-muted)' }}>TBD</span>}
                      </td>
                      <td style={{ textAlign: 'center' }}>{v.required_cranes}</td>
                      <td style={{
                        fontWeight: 700,
                        color: wait > 4 ? 'var(--accent-red)' : wait > 2 ? 'var(--accent-orange)' : 'var(--text-primary)'
                      }}>
                        {wait.toFixed(1)}
                      </td>
                      <td>
                        <span className={`risk-badge risk-${v.risk_level}`}>
                          {v.congestion_risk?.toFixed(0)}%
                        </span>
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--text-secondary)', maxWidth: 160 }}>
                        {v.recommended_action}
                      </td>
                    </tr>
                  )
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={12} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '24px 0' }}>
                      No vessels match the current filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
