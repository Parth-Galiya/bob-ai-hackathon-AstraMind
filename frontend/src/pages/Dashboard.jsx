import React from 'react'
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  BarChart, Bar, Cell, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis
} from 'recharts'
import { useApp } from '../context/AppContext'
import { useNavigate } from 'react-router-dom'

function getRiskColor(risk) {
  if (risk >= 75) return '#ff3b5c'
  if (risk >= 55) return '#ff7b00'
  if (risk >= 30) return '#ffc107'
  return '#00d97e'
}

function getRiskLabel(risk) {
  if (risk >= 75) return 'critical'
  if (risk >= 55) return 'high'
  if (risk >= 30) return 'medium'
  return 'low'
}

function KPICard({ label, value, sub, color, icon }) {
  return (
    <div className="kpi-card">
      <div className="kpi-label">{icon} {label}</div>
      <div className="kpi-value" style={{ color: color || 'var(--text-primary)' }}>{value}</div>
      {sub && <div className="kpi-sub">{sub}</div>}
      <div className="kpi-accent" style={{ background: color || 'var(--accent-blue)' }} />
    </div>
  )
}

function AlertBanner({ alerts = [] }) {
  const navigate = useNavigate()
  const shown = alerts.filter(a => !a.acknowledged).slice(0, 3)
  if (!shown.length) return null
  return (
    <div style={{ marginBottom: 20 }}>
      {shown.map(a => (
        <div key={a.alert_id} className={`alert-banner alert-${a.level}`}>
          <span className="alert-icon">
            {a.level === 'critical' ? '🚨' : a.level === 'warning' ? '⚠️' : 'ℹ️'}
          </span>
          <span style={{ flex: 1 }}>{a.message}</span>
          <button
            className="btn btn-sm"
            style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', fontSize: 14 }}
            onClick={() => navigate('/alerts')}
          >
            →
          </button>
        </div>
      ))}
    </div>
  )
}

function BerthRiskChart({ predictions = [] }) {
  const data = predictions.map(p => ({
    name: p.berth_id,
    risk: p.congestion_risk,
    fill: getRiskColor(p.congestion_risk)
  }))

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} barSize={28} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(30,45,74,0.7)" />
        <XAxis dataKey="name" tick={{ fill: '#8a9bbf', fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis domain={[0, 100]} tick={{ fill: '#8a9bbf', fontSize: 11 }} axisLine={false} tickLine={false} unit="%" />
        <Tooltip
          contentStyle={{ background: '#1a2438', border: '1px solid #1e2d4a', borderRadius: 8, fontSize: 12 }}
          formatter={(v) => [`${v.toFixed(1)}%`, 'Risk']}
        />
        <Bar dataKey="risk" radius={[4, 4, 0, 0]}>
          {data.map((entry, i) => (
            <Cell key={i} fill={entry.fill} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

function CongestionForecast({ predictions = [] }) {
  if (!predictions[0]?.forecast_72h) return null
  const topBerth = predictions[0]
  const data = topBerth.forecast_72h.filter((_, i) => i % 2 === 0).slice(0, 25)

  return (
    <ResponsiveContainer width="100%" height={200}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id="riskGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#ff3b5c" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#ff3b5c" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(30,45,74,0.7)" />
        <XAxis dataKey="timestamp" tick={{ fill: '#8a9bbf', fontSize: 10 }} axisLine={false} tickLine={false} interval={3} />
        <YAxis domain={[0, 100]} tick={{ fill: '#8a9bbf', fontSize: 10 }} axisLine={false} tickLine={false} unit="%" />
        <Tooltip
          contentStyle={{ background: '#1a2438', border: '1px solid #1e2d4a', borderRadius: 8, fontSize: 12 }}
          formatter={(v) => [`${v.toFixed(1)}%`, `${topBerth.berth_id} Risk`]}
        />
        <Area type="monotone" dataKey="risk" stroke="#ff3b5c" fill="url(#riskGrad)" strokeWidth={2} dot={false} />
      </AreaChart>
    </ResponsiveContainer>
  )
}

function ResourceRadar({ kpis = {} }) {
  const data = [
    { axis: 'Berth Util', value: Math.round(kpis.berths_in_use / Math.max(kpis.total_berths || 8, 1) * 100) },
    { axis: 'Crane Util', value: Math.round(kpis.crane_utilization || 0) },
    { axis: 'Yard Util', value: Math.round(kpis.yard_utilization || 0) },
    { axis: 'Fleet Active', value: Math.round((kpis.active_vessels / Math.max(kpis.total_vessels, 1)) * 100) },
    { axis: 'Congestion', value: Math.round(kpis.congestion_risk_score || 0) },
  ]

  return (
    <ResponsiveContainer width="100%" height={220}>
      <RadarChart data={data} margin={{ top: 10, right: 20, left: 20, bottom: 10 }}>
        <PolarGrid stroke="rgba(30,45,74,0.8)" />
        <PolarAngleAxis dataKey="axis" tick={{ fill: '#8a9bbf', fontSize: 11 }} />
        <PolarRadiusAxis domain={[0, 100]} tick={{ fill: '#4a5a7a', fontSize: 9 }} />
        <Radar name="Port" dataKey="value" stroke="#2b7fff" fill="#2b7fff" fillOpacity={0.2} strokeWidth={2} />
        <Tooltip
          contentStyle={{ background: '#1a2438', border: '1px solid #1e2d4a', borderRadius: 8, fontSize: 12 }}
          formatter={(v) => [`${v}%`, '']}
        />
      </RadarChart>
    </ResponsiveContainer>
  )
}

export default function Dashboard() {
  const { dashboard, loading, error, congestion, beforeAfter, alerts } = useApp()
  const navigate = useNavigate()

  if (loading) return (
    <div style={{ padding: 24 }}>
      <div className="spinner" />
      <p style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>Loading port data...</p>
    </div>
  )

  if (error) return (
    <div style={{ padding: 24 }}>
      <div className="alert-banner alert-critical">
        <span className="alert-icon">🚨</span>
        <div>
          <strong>Connection Error</strong>
          <div style={{ fontSize: 12, marginTop: 4 }}>{error}</div>
          <div style={{ fontSize: 12, marginTop: 4 }}>Make sure the backend is running: <code>cd backend && uvicorn main:app</code></div>
        </div>
      </div>
    </div>
  )

  const kpis = dashboard?.kpis || {}
  const predictions = congestion?.predictions || []
  const ba = beforeAfter || {}
  const topAlerts = (alerts || []).filter(a => !a.acknowledged).slice(0, 4)
  const criticalPredictions = predictions.filter(p => p.congestion_risk >= 55)
  const routing = dashboard?.routing_summary?.top_recommendations || []

  return (
    <div style={{ padding: 24 }}>
      {/* Alert Banner */}
      <AlertBanner alerts={topAlerts} />

      {/* KPI Cards */}
      <div className="kpi-grid">
        <KPICard label="Total Vessels" value={kpis.total_vessels || 0} icon="🚢"
          sub={`${kpis.active_vessels || 0} active`} color="var(--accent-blue)" />
        <KPICard label="Waiting" value={kpis.vessels_waiting || 0} icon="⏳"
          sub="at anchorage" color={kpis.vessels_waiting > 5 ? 'var(--accent-orange)' : 'var(--text-primary)'} />
        <KPICard label="Critical Berths" value={kpis.critical_berths || 0} icon="⚓"
          sub="risk ≥ 75%" color={kpis.critical_berths > 0 ? 'var(--accent-red)' : 'var(--accent-green)'} />
        <KPICard label="Avg Wait" value={`${kpis.avg_waiting_time?.toFixed(1) || 0}h`} icon="🕐"
          sub={`max ${kpis.max_waiting_time?.toFixed(1) || 0}h`}
          color={kpis.avg_waiting_time > 4 ? 'var(--accent-orange)' : 'var(--text-primary)'} />
        <KPICard label="Yard Util" value={`${kpis.yard_utilization?.toFixed(0) || 0}%`} icon="📦"
          sub="of capacity"
          color={kpis.yard_utilization > 85 ? 'var(--accent-red)' : kpis.yard_utilization > 70 ? 'var(--accent-orange)' : 'var(--accent-green)'} />
        <KPICard label="Crane Util" value={`${kpis.crane_utilization?.toFixed(0) || 0}%`} icon="🏗️"
          sub="of fleet" color="var(--accent-cyan)" />
        <KPICard label="Congestion Risk" value={`${kpis.congestion_risk_score?.toFixed(0) || 0}%`} icon="📊"
          sub="overall score"
          color={kpis.congestion_risk_score > 65 ? 'var(--accent-red)' : kpis.congestion_risk_score > 40 ? 'var(--accent-orange)' : 'var(--accent-green)'} />
        <KPICard label="Optimization" value={`+${kpis.optimization_improvement?.toFixed(0) || 0}%`} icon="⚡"
          sub="vs baseline" color="var(--accent-green)" />
      </div>

      {/* Charts Row */}
      <div className="grid-2" style={{ marginBottom: 20 }}>
        <div className="card">
          <div className="card-header">
            <div className="card-title">🔴 Berth Congestion Risk</div>
            <button className="btn btn-secondary btn-sm" onClick={() => navigate('/congestion')}>Details →</button>
          </div>
          {predictions.length > 0 ? (
            <BerthRiskChart predictions={predictions} />
          ) : (
            <div className="empty-state"><div className="empty-state-text">No prediction data</div></div>
          )}
        </div>

        <div className="card">
          <div className="card-header">
            <div className="card-title">📈 72h Congestion Forecast</div>
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              Most critical berth
            </span>
          </div>
          <CongestionForecast predictions={predictions} />
        </div>
      </div>

      {/* Second Row */}
      <div className="grid-2" style={{ marginBottom: 20 }}>
        {/* Critical Berths */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">⚠️ At-Risk Berths</div>
            <button className="btn btn-secondary btn-sm" onClick={() => navigate('/berth-optimizer')}>Optimize →</button>
          </div>
          {criticalPredictions.length === 0 ? (
            <div className="alert-banner alert-info" style={{ margin: 0 }}>
              <span>✅</span> All berths within safe operational parameters.
            </div>
          ) : (
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Berth</th>
                    <th>Risk</th>
                    <th>Status</th>
                    <th>Wait</th>
                    <th>Cranes</th>
                  </tr>
                </thead>
                <tbody>
                  {criticalPredictions.slice(0, 6).map(p => (
                    <tr key={p.berth_id}>
                      <td><strong>{p.berth_id}</strong></td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ width: 48, height: 4, background: 'var(--border)', borderRadius: 2 }}>
                            <div style={{ width: `${p.congestion_risk}%`, height: '100%', background: getRiskColor(p.congestion_risk), borderRadius: 2 }} />
                          </div>
                          <span style={{ color: getRiskColor(p.congestion_risk), fontWeight: 700 }}>
                            {p.congestion_risk.toFixed(0)}%
                          </span>
                        </div>
                      </td>
                      <td>
                        <span className={`risk-badge risk-${getRiskLabel(p.congestion_risk)}`}>
                          {getRiskLabel(p.congestion_risk)}
                        </span>
                      </td>
                      <td style={{ fontFamily: 'monospace', color: 'var(--text-secondary)' }}>
                        {p.expected_wait_hours?.toFixed(1)}h
                      </td>
                      <td style={{ color: 'var(--text-secondary)' }}>{p.available_cranes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Resource Utilization */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">📡 Resource Utilization</div>
          </div>
          <ResourceRadar kpis={kpis} />
        </div>
      </div>

      {/* Before / After + Routing */}
      <div className="grid-2" style={{ marginBottom: 20 }}>
        {/* Before/After */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">⚡ Optimization Impact</div>
            <button className="btn btn-secondary btn-sm" onClick={() => navigate('/berth-optimizer')}>Full Report →</button>
          </div>
          <div>
            <div className="metric-compare">
              <span className="metric-name">Avg Wait Time</span>
              <span className="metric-val before">{ba.before_avg_wait?.toFixed(1) || '—'}h</span>
              <span className="metric-arrow">→</span>
              <span className="metric-val after">{ba.after_avg_wait?.toFixed(1) || '—'}h</span>
              {ba.wait_improvement_pct > 0 && (
                <span className="improvement positive">↓{ba.wait_improvement_pct?.toFixed(0)}%</span>
              )}
            </div>
            <div className="metric-compare">
              <span className="metric-name">Berth Utilization</span>
              <span className="metric-val before">{ba.before_berth_util?.toFixed(0) || '—'}%</span>
              <span className="metric-arrow">→</span>
              <span className="metric-val after">{ba.after_berth_util?.toFixed(0) || '—'}%</span>
              {ba.berth_improvement_pct > 0 && (
                <span className="improvement positive">↓{ba.berth_improvement_pct?.toFixed(0)}%</span>
              )}
            </div>
            <div className="metric-compare">
              <span className="metric-name">Crane Utilization</span>
              <span className="metric-val before">{ba.before_crane_util?.toFixed(0) || '—'}%</span>
              <span className="metric-arrow">→</span>
              <span className="metric-val after">{ba.after_crane_util?.toFixed(0) || '—'}%</span>
              {ba.crane_improvement_pct > 0 && (
                <span className="improvement positive">↑{ba.crane_improvement_pct?.toFixed(0)}%</span>
              )}
            </div>
            <div className="metric-compare">
              <span className="metric-name">Critical Berths</span>
              <span className="metric-val before">{ba.before_critical_berths ?? '—'}</span>
              <span className="metric-arrow">→</span>
              <span className="metric-val after">{ba.after_critical_berths ?? '—'}</span>
              {(ba.before_critical_berths - ba.after_critical_berths) > 0 && (
                <span className="improvement positive">
                  ↓{ba.before_critical_berths - ba.after_critical_berths}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Top Routing Recommendations */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">🗺️ Smart Routing</div>
            <button className="btn btn-secondary btn-sm" onClick={() => navigate('/routing')}>All →</button>
          </div>
          {routing.length === 0 ? (
            <div className="alert-banner alert-info" style={{ margin: 0 }}>
              <span>✅</span> No rerouting required — all vessels are optimally assigned.
            </div>
          ) : (
            routing.slice(0, 3).map((rec, i) => (
              <div key={i} style={{
                padding: '10px 0',
                borderBottom: i < routing.length - 1 ? '1px solid var(--border)' : 'none'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <strong style={{ color: 'var(--text-primary)' }}>{rec.vessel_name}</strong>
                  <span className="improvement positive" style={{ fontSize: 12 }}>
                    -{rec.time_saved?.toFixed(1)}h
                  </span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  {rec.current_berth} → <span style={{ color: 'var(--accent-cyan)' }}>{rec.recommended_berth}</span>
                  &nbsp;| Risk: {rec.current_risk?.toFixed(0)}% → {rec.recommended_risk?.toFixed(0)}%
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
