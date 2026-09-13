import React, { useState } from 'react'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts'
import { useApp } from '../context/AppContext'
import { portflowApi } from '../services/api'

export default function CraneOptimizer() {
  const { craneOpt, loading } = useApp()
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState(null)

  const data = result || craneOpt
  const allocations = data?.allocations || []
  const craneStatus = data?.crane_status || []
  const summary = data?.summary || {}

  const handleOptimize = async () => {
    setRunning(true)
    try {
      const r = await portflowApi.runCraneOptimization()
      setResult(r)
    } catch (e) {
      alert('Crane optimization error: ' + e.message)
    } finally {
      setRunning(false)
    }
  }

  const statusGroups = {
    busy: craneStatus.filter(c => c.status === 'busy' || c.assigned_vessel),
    available: craneStatus.filter(c => c.status === 'available' && !c.assigned_vessel),
    maintenance: craneStatus.filter(c => c.status === 'maintenance'),
  }

  const chartData = allocations.slice(0, 20).map(a => ({
    name: a.vessel_id,
    cranes: a.cranes_allocated,
    handling: a.handling_time_hours,
    containers: a.containers,
  }))

  const berthGroups = {}
  for (const c of craneStatus) {
    if (!berthGroups[c.berth_id]) berthGroups[c.berth_id] = []
    berthGroups[c.berth_id].push(c)
  }

  return (
    <div style={{ padding: 24 }}>
      <div className="page-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div className="page-title">🏗️ Crane Optimizer</div>
            <div className="page-subtitle">Optimal crane allocation per vessel based on container volume and berth capacity</div>
          </div>
          <button className="btn btn-primary" onClick={handleOptimize} disabled={running}>
            {running ? '⏳ Optimizing...' : '▶ Optimize Cranes'}
          </button>
        </div>
      </div>

      {/* Summary */}
      <div className="kpi-grid" style={{ marginBottom: 20 }}>
        <div className="kpi-card">
          <div className="kpi-label">Total Cranes</div>
          <div className="kpi-value">{summary.total_cranes || craneStatus.length}</div>
          <div className="kpi-sub">in fleet</div>
          <div className="kpi-accent" style={{ background: 'var(--accent-blue)' }} />
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Active</div>
          <div className="kpi-value" style={{ color: 'var(--accent-green)' }}>
            {statusGroups.busy.length}
          </div>
          <div className="kpi-sub">cranes deployed</div>
          <div className="kpi-accent" style={{ background: 'var(--accent-green)' }} />
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Available</div>
          <div className="kpi-value" style={{ color: 'var(--accent-cyan)' }}>
            {statusGroups.available.length}
          </div>
          <div className="kpi-sub">ready to deploy</div>
          <div className="kpi-accent" style={{ background: 'var(--accent-cyan)' }} />
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Maintenance</div>
          <div className="kpi-value" style={{ color: 'var(--accent-orange)' }}>
            {statusGroups.maintenance.length}
          </div>
          <div className="kpi-sub">offline</div>
          <div className="kpi-accent" style={{ background: 'var(--accent-orange)' }} />
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Fleet Utilization</div>
          <div className="kpi-value" style={{ color: 'var(--accent-purple)' }}>
            {summary.overall_utilization || Math.round(statusGroups.busy.length / Math.max(craneStatus.length, 1) * 100)}%
          </div>
          <div className="kpi-sub">of total fleet</div>
          <div className="kpi-accent" style={{ background: 'var(--accent-purple)' }} />
        </div>
      </div>

      <div className="grid-2" style={{ marginBottom: 20 }}>
        {/* Crane Fleet by Berth */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">Crane Status by Berth</div>
          </div>
          {Object.entries(berthGroups).map(([bid, cranelist]) => (
            <div key={bid} style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent-cyan)', marginBottom: 8 }}>{bid}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {cranelist.map(c => {
                  const isBusy = c.status === 'busy' || c.assigned_vessel
                  const isMaint = c.status === 'maintenance'
                  return (
                    <div key={c.crane_id}
                      title={c.assigned_vessel ? `Assigned: ${c.assigned_vessel}` : c.status}
                      style={{
                        padding: '4px 8px',
                        borderRadius: 4,
                        fontSize: 11,
                        fontWeight: 700,
                        background: isMaint ? 'rgba(255,123,0,0.1)' : isBusy ? 'rgba(0,217,126,0.1)' : 'rgba(43,127,255,0.1)',
                        color: isMaint ? 'var(--accent-orange)' : isBusy ? 'var(--accent-green)' : 'var(--accent-blue)',
                        border: `1px solid ${isMaint ? 'rgba(255,123,0,0.2)' : isBusy ? 'rgba(0,217,126,0.2)' : 'rgba(43,127,255,0.2)'}`,
                        cursor: 'default',
                      }}
                    >
                      {c.crane_id}
                      {isMaint ? ' 🔧' : isBusy ? ' ●' : ''}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Allocation Chart */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">Cranes per Vessel (Top 20)</div>
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={chartData} barSize={16} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(30,45,74,0.7)" />
              <XAxis dataKey="name" tick={{ fill: '#8a9bbf', fontSize: 9 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#8a9bbf', fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ background: '#1a2438', border: '1px solid #1e2d4a', borderRadius: 8, fontSize: 12 }}
                formatter={(v, n) => [n === 'cranes' ? `${v} crane(s)` : `${v.toFixed(1)}h`, n === 'cranes' ? 'Cranes' : 'Handling']}
              />
              <Bar dataKey="cranes" name="cranes" fill="var(--accent-cyan)" radius={[2, 2, 0, 0]} />
              <Bar dataKey="handling" name="handling" fill="rgba(43,127,255,0.5)" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Allocations Table */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">Crane Allocations per Vessel</div>
          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{allocations.length} vessels</span>
        </div>
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Vessel</th>
                <th>Name</th>
                <th>Berth</th>
                <th>Containers</th>
                <th>Cranes</th>
                <th>Handling Time</th>
                <th>Explanation</th>
              </tr>
            </thead>
            <tbody>
              {allocations.map(a => (
                <tr key={a.vessel_id}>
                  <td><code style={{ color: 'var(--accent-cyan)', fontSize: 11 }}>{a.vessel_id}</code></td>
                  <td style={{ fontSize: 12 }}>{a.vessel_name}</td>
                  <td><strong style={{ color: 'var(--accent-blue)' }}>{a.berth_id}</strong></td>
                  <td style={{ fontFamily: 'monospace' }}>{a.containers?.toLocaleString()}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 3 }}>
                      {Array.from({ length: a.cranes_allocated }).map((_, i) => (
                        <div key={i} style={{ width: 12, height: 12, borderRadius: 2, background: 'var(--accent-cyan)' }} />
                      ))}
                    </div>
                  </td>
                  <td style={{
                    fontWeight: 700,
                    color: a.handling_time_hours > 10 ? 'var(--accent-orange)' : 'var(--accent-green)'
                  }}>
                    {a.handling_time_hours?.toFixed(1)}h
                  </td>
                  <td style={{ fontSize: 11, color: 'var(--text-muted)', maxWidth: 220 }}>
                    {a.explanation}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
