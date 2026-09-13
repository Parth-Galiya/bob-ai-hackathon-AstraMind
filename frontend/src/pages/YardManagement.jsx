import React from 'react'
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  BarChart, Bar, Cell
} from 'recharts'
import { useApp } from '../context/AppContext'

function getUtilColor(util) {
  if (util >= 90) return '#ff3b5c'
  if (util >= 80) return '#ff7b00'
  if (util >= 65) return '#ffc107'
  return '#00d97e'
}

export default function YardManagement() {
  const { yard, loading } = useApp()

  if (loading) return <div style={{ padding: 24 }}><div className="spinner" /></div>
  if (!yard) return <div style={{ padding: 24 }}>No yard data available.</div>

  const zones = yard.zones || []
  const warnings = yard.warnings || []
  const recs = yard.recommendations || []

  const chartData = [
    { name: 'Current', util: yard.utilization },
    { name: '+24h', util: yard.predicted_24h },
    { name: '+48h', util: yard.predicted_48h },
  ]

  const zoneChartData = zones.map(z => ({
    name: z.yard_id,
    current: +(z.utilization * 100).toFixed(1),
    pred24: +(z.predicted_24h * 100).toFixed(1),
    pred48: +(z.predicted_48h * 100).toFixed(1),
  }))

  // Time-series forecast (synthetic, based on current trend)
  const trendData = Array.from({ length: 25 }, (_, i) => {
    const base = yard.utilization
    const hours = i * 3
    const drift = hours / 72 * (yard.predicted_48h - base)
    const noise = (Math.random() - 0.5) * 1.5
    return {
      time: `${hours}h`,
      utilization: +(base + drift + noise).toFixed(1)
    }
  })

  return (
    <div style={{ padding: 24 }}>
      <div className="page-header">
        <div className="page-title">📦 Yard Management</div>
        <div className="page-subtitle">Container yard capacity monitoring and congestion prediction</div>
      </div>

      {/* Warnings */}
      {warnings.map((w, i) => (
        <div key={i} className={`alert-banner ${yard.utilization > 90 ? 'alert-critical' : 'alert-warning'}`}
          style={{ marginBottom: 12 }}>
          <span className="alert-icon">⚠️</span>
          <span>{w}</span>
        </div>
      ))}

      {/* KPIs */}
      <div className="kpi-grid" style={{ marginBottom: 20 }}>
        <div className="kpi-card">
          <div className="kpi-label">Total Capacity</div>
          <div className="kpi-value">{(yard.total_capacity / 1000).toFixed(0)}K</div>
          <div className="kpi-sub">containers</div>
          <div className="kpi-accent" style={{ background: 'var(--accent-blue)' }} />
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Current Occupancy</div>
          <div className="kpi-value">{(yard.total_occupancy / 1000).toFixed(0)}K</div>
          <div className="kpi-sub">containers in yard</div>
          <div className="kpi-accent" style={{ background: getUtilColor(yard.utilization) }} />
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Utilization Now</div>
          <div className="kpi-value" style={{ color: getUtilColor(yard.utilization) }}>
            {yard.utilization?.toFixed(1)}%
          </div>
          <div className="kpi-sub">current</div>
          <div className="kpi-accent" style={{ background: getUtilColor(yard.utilization) }} />
        </div>
        <div className="kpi-card">
          <div className="kpi-label">+24h Forecast</div>
          <div className="kpi-value" style={{ color: getUtilColor(yard.predicted_24h) }}>
            {yard.predicted_24h?.toFixed(1)}%
          </div>
          <div className="kpi-sub">predicted</div>
          <div className="kpi-accent" style={{ background: getUtilColor(yard.predicted_24h) }} />
        </div>
        <div className="kpi-card">
          <div className="kpi-label">+48h Forecast</div>
          <div className="kpi-value" style={{ color: getUtilColor(yard.predicted_48h) }}>
            {yard.predicted_48h?.toFixed(1)}%
          </div>
          <div className="kpi-sub">predicted</div>
          <div className="kpi-accent" style={{ background: getUtilColor(yard.predicted_48h) }} />
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Available Space</div>
          <div className="kpi-value" style={{ color: 'var(--accent-green)' }}>
            {((yard.available_capacity || 0) / 1000).toFixed(0)}K
          </div>
          <div className="kpi-sub">containers free</div>
          <div className="kpi-accent" style={{ background: 'var(--accent-green)' }} />
        </div>
      </div>

      {/* Charts */}
      <div className="grid-2" style={{ marginBottom: 20 }}>
        <div className="card">
          <div className="card-header">
            <div className="card-title">72-Hour Utilization Forecast</div>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={trendData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="yardGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#2b7fff" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#2b7fff" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(30,45,74,0.7)" />
              <XAxis dataKey="time" tick={{ fill: '#8a9bbf', fontSize: 10 }} axisLine={false} tickLine={false} interval={3} />
              <YAxis domain={[50, 100]} tick={{ fill: '#8a9bbf', fontSize: 10 }} axisLine={false} tickLine={false} unit="%" />
              <Tooltip
                contentStyle={{ background: '#1a2438', border: '1px solid #1e2d4a', borderRadius: 8, fontSize: 12 }}
                formatter={(v) => [`${v.toFixed(1)}%`, 'Utilization']}
              />
              <Area type="monotone" dataKey="utilization" stroke="#2b7fff" fill="url(#yardGrad)" strokeWidth={2} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <div className="card-header">
            <div className="card-title">Zone Utilization Comparison</div>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={zoneChartData} barSize={16} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(30,45,74,0.7)" />
              <XAxis dataKey="name" tick={{ fill: '#8a9bbf', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis domain={[0, 100]} tick={{ fill: '#8a9bbf', fontSize: 10 }} axisLine={false} tickLine={false} unit="%" />
              <Tooltip
                contentStyle={{ background: '#1a2438', border: '1px solid #1e2d4a', borderRadius: 8, fontSize: 12 }}
                formatter={(v, n) => [`${v.toFixed(1)}%`, n]}
              />
              <Bar dataKey="current" name="Current" fill="#2b7fff" radius={[2, 2, 0, 0]} />
              <Bar dataKey="pred24" name="+24h" fill="#ffc107" radius={[2, 2, 0, 0]} />
              <Bar dataKey="pred48" name="+48h" fill="#ff7b00" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Zone Details */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header">
          <div className="card-title">Yard Zone Details</div>
        </div>
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Zone</th>
                <th>Type</th>
                <th>Capacity</th>
                <th>Occupancy</th>
                <th>Current</th>
                <th>+24h</th>
                <th>+48h</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {zones.map(z => {
                const util = z.utilization * 100
                const pred24 = z.predicted_24h * 100
                const pred48 = z.predicted_48h * 100
                return (
                  <tr key={z.yard_id}>
                    <td><strong>{z.yard_id}</strong></td>
                    <td style={{ textTransform: 'capitalize', color: 'var(--text-secondary)' }}>{z.zone_type}</td>
                    <td style={{ fontFamily: 'monospace' }}>{z.capacity.toLocaleString()}</td>
                    <td style={{ fontFamily: 'monospace' }}>{z.current_occupancy.toLocaleString()}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 48, height: 4, background: 'var(--border)', borderRadius: 2 }}>
                          <div style={{ width: `${util}%`, height: '100%', background: getUtilColor(util), borderRadius: 2 }} />
                        </div>
                        <span style={{ color: getUtilColor(util), fontWeight: 700, fontSize: 12 }}>
                          {util.toFixed(1)}%
                        </span>
                      </div>
                    </td>
                    <td style={{ color: getUtilColor(pred24), fontWeight: 700 }}>{pred24.toFixed(1)}%</td>
                    <td style={{ color: getUtilColor(pred48), fontWeight: 700 }}>{pred48.toFixed(1)}%</td>
                    <td>
                      <span className={`risk-badge risk-${util >= 90 ? 'critical' : util >= 80 ? 'high' : util >= 65 ? 'medium' : 'low'}`}>
                        {util >= 90 ? 'critical' : util >= 80 ? 'high' : util >= 65 ? 'medium' : 'low'}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recommendations */}
      {recs.length > 0 && (
        <div className="card">
          <div className="card-header">
            <div className="card-title">🤖 Recommendations</div>
          </div>
          {recs.map((rec, i) => (
            <div key={i} style={{ display: 'flex', gap: 10, padding: '8px 0', borderBottom: i < recs.length - 1 ? '1px solid var(--border)' : 'none' }}>
              <span style={{ color: 'var(--accent-cyan)' }}>→</span>
              <span style={{ fontSize: 13 }}>{rec}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
