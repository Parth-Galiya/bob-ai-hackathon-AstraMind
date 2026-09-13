import React, { useState } from 'react'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell
} from 'recharts'
import { useApp } from '../context/AppContext'
import { portflowApi } from '../services/api'

function getRiskColor(risk) {
  if (risk >= 75) return '#ff3b5c'
  if (risk >= 55) return '#ff7b00'
  if (risk >= 30) return '#ffc107'
  return '#00d97e'
}

export default function BerthOptimizer() {
  const { berthOpt, congestion, loading } = useApp()
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState(null)

  const data = result || berthOpt
  const assignments = data?.assignments || []
  const summary = data?.summary || {}
  const predictions = congestion?.predictions || []

  // Gantt chart data
  const berthNames = [...new Set(assignments.map(a => a.berth_id))].sort()

  const handleOptimize = async () => {
    setRunning(true)
    try {
      const r = await portflowApi.runBerthOptimization()
      setResult(r)
    } catch (e) {
      alert('Optimization error: ' + e.message)
    } finally {
      setRunning(false)
    }
  }

  // Bar chart for wait times
  const waitData = assignments.slice(0, 20).map(a => ({
    name: a.vessel_id,
    wait: a.waiting_time,
    handling: a.handling_time,
  }))

  return (
    <div style={{ padding: 24 }}>
      <div className="page-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div className="page-title">⚓ Berth Optimizer</div>
            <div className="page-subtitle">Priority-aware vessel-to-berth assignment using constraint optimization</div>
          </div>
          <button className="btn btn-primary" onClick={handleOptimize} disabled={running}>
            {running ? '⏳ Optimizing...' : '▶ Run Optimization'}
          </button>
        </div>
      </div>

      {/* Summary KPIs */}
      <div className="kpi-grid" style={{ marginBottom: 20 }}>
        <div className="kpi-card">
          <div className="kpi-label">Assigned</div>
          <div className="kpi-value" style={{ color: 'var(--accent-green)' }}>{summary.assigned || 0}</div>
          <div className="kpi-sub">vessels placed</div>
          <div className="kpi-accent" style={{ background: 'var(--accent-green)' }} />
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Unassigned</div>
          <div className="kpi-value" style={{ color: summary.unassigned > 0 ? 'var(--accent-red)' : 'var(--text-primary)' }}>
            {summary.unassigned || 0}
          </div>
          <div className="kpi-sub">no compatible berth</div>
          <div className="kpi-accent" style={{ background: 'var(--accent-red)' }} />
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Avg Wait Before</div>
          <div className="kpi-value" style={{ color: 'var(--text-secondary)' }}>
            {summary.avg_wait_before?.toFixed(1) || '—'}h
          </div>
          <div className="kpi-sub">unoptimized</div>
          <div className="kpi-accent" style={{ background: 'var(--text-muted)' }} />
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Avg Wait After</div>
          <div className="kpi-value" style={{ color: 'var(--accent-green)' }}>
            {summary.avg_wait_after?.toFixed(1) || '—'}h
          </div>
          <div className="kpi-sub">after optimization</div>
          <div className="kpi-accent" style={{ background: 'var(--accent-green)' }} />
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Improvement</div>
          <div className="kpi-value" style={{ color: 'var(--accent-cyan)' }}>
            {summary.improvement_pct?.toFixed(0) || 0}%
          </div>
          <div className="kpi-sub">wait time reduction</div>
          <div className="kpi-accent" style={{ background: 'var(--accent-cyan)' }} />
        </div>
      </div>

      {/* Berth Status Table */}
      <div className="grid-2" style={{ marginBottom: 20 }}>
        <div className="card">
          <div className="card-header">
            <div className="card-title">Berth Risk & Assignments</div>
          </div>
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Berth</th>
                  <th>Risk</th>
                  <th>Vessels</th>
                  <th>Cranes</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {predictions.map(p => {
                  const berth_assignments = assignments.filter(a => a.berth_id === p.berth_id)
                  return (
                    <tr key={p.berth_id}>
                      <td><strong>{p.berth_id}</strong></td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <div style={{ width: 40, height: 4, background: 'var(--border)', borderRadius: 2 }}>
                            <div style={{ width: `${p.congestion_risk}%`, height: '100%', background: getRiskColor(p.congestion_risk), borderRadius: 2 }} />
                          </div>
                          <span style={{ color: getRiskColor(p.congestion_risk), fontWeight: 700, fontSize: 12 }}>
                            {p.congestion_risk.toFixed(0)}%
                          </span>
                        </div>
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--accent-cyan)' }}>
                        {berth_assignments.length}
                      </td>
                      <td style={{ color: 'var(--text-secondary)' }}>{p.available_cranes}</td>
                      <td>
                        <span className={`risk-badge risk-${p.risk_level}`}>{p.risk_level}</span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Wait Time Chart */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">Waiting Times (Top 20 Vessels)</div>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={waitData} barSize={12} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(30,45,74,0.7)" />
              <XAxis dataKey="name" tick={{ fill: '#8a9bbf', fontSize: 9 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#8a9bbf', fontSize: 10 }} axisLine={false} tickLine={false} unit="h" />
              <Tooltip
                contentStyle={{ background: '#1a2438', border: '1px solid #1e2d4a', borderRadius: 8, fontSize: 12 }}
                formatter={(v, n) => [`${v.toFixed(2)}h`, n === 'wait' ? 'Wait' : 'Handling']}
              />
              <Bar dataKey="wait" name="Wait" fill="#2b7fff" radius={[2, 2, 0, 0]} />
              <Bar dataKey="handling" name="Handling" fill="rgba(0,196,232,0.5)" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Assignments Table */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">Assignment Details</div>
          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{assignments.length} vessels assigned</span>
        </div>
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Vessel</th>
                <th>Name</th>
                <th>Berth</th>
                <th>Start</th>
                <th>End</th>
                <th>Wait (h)</th>
                <th>Handle (h)</th>
                <th>Cranes</th>
                <th>Priority</th>
                <th>Explanation</th>
              </tr>
            </thead>
            <tbody>
              {assignments.map(a => {
                const start = new Date(a.start_time)
                const end = new Date(a.end_time)
                return (
                  <tr key={a.vessel_id}>
                    <td><code style={{ color: 'var(--accent-cyan)', fontSize: 11 }}>{a.vessel_id}</code></td>
                    <td style={{ fontSize: 12 }}>{a.vessel_name}</td>
                    <td><strong style={{ color: 'var(--accent-blue)' }}>{a.berth_id}</strong></td>
                    <td style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--text-secondary)' }}>
                      {start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--text-secondary)' }}>
                      {end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td style={{
                      fontWeight: 700,
                      color: a.waiting_time > 3 ? 'var(--accent-orange)' : 'var(--accent-green)'
                    }}>
                      {a.waiting_time?.toFixed(2)}
                    </td>
                    <td style={{ color: 'var(--text-secondary)' }}>{a.handling_time?.toFixed(1)}</td>
                    <td style={{ textAlign: 'center' }}>{a.cranes_assigned}</td>
                    <td><span className={`priority-badge priority-${a.priority}`}>{a.priority}</span></td>
                    <td style={{ fontSize: 11, color: 'var(--text-muted)', maxWidth: 200, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {a.explanation}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
