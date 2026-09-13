import React, { useState } from 'react'
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine,
  BarChart, Bar, Cell
} from 'recharts'
import { useApp } from '../context/AppContext'
import { portflowApi } from '../services/api'

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

function BerthCard({ pred }) {
  const [expanded, setExpanded] = useState(false)
  const risk = pred.congestion_risk
  const color = getRiskColor(risk)
  const label = getRiskLabel(risk)

  const forecast = pred.forecast_72h?.filter((_, i) => i % 2 === 0) || []

  return (
    <div className="card" style={{ borderLeft: `4px solid ${color}` }}>
      <div
        style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}
        onClick={() => setExpanded(!expanded)}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <span style={{ fontSize: 18, fontWeight: 900, color: 'var(--text-primary)' }}>{pred.berth_id}</span>
            <span className={`risk-badge risk-${label}`}>{label.toUpperCase()}</span>
          </div>
          <div style={{ fontSize: 28, fontWeight: 900, color, marginBottom: 4 }}>
            {risk.toFixed(0)}%
            <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', marginLeft: 8 }}>
              congestion risk
            </span>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Expected Wait</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: risk > 55 ? 'var(--accent-orange)' : 'var(--text-primary)' }}>
            {pred.expected_wait_hours?.toFixed(1)}h
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
            {expanded ? '▲ less' : '▼ forecast'}
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div style={{ margin: '12px 0 6px' }}>
        <div className="progress-bar">
          <div className="progress-fill" style={{ width: `${risk}%`, background: color }} />
        </div>
      </div>

      {/* Stats Row */}
      <div style={{ display: 'flex', gap: 16, fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8 }}>
        <span>⚓ Util: {pred.current_utilization?.toFixed(0)}%</span>
        <span>🏗️ Cranes: {pred.available_cranes}</span>
        <span>📦 Arrivals/12h: {pred.arrival_density_12h}</span>
        {pred.assigned_vessels?.length > 0 && (
          <span>🚢 {pred.assigned_vessels.length} vessel(s)</span>
        )}
      </div>

      {/* Feature Explanation */}
      <div style={{ background: 'var(--bg-primary)', borderRadius: 6, padding: '8px 12px', fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>
        <strong style={{ color: 'var(--text-secondary)' }}>Why this risk?</strong>{' '}
        Arrival density: <strong style={{ color: 'var(--text-primary)' }}>{pred.features?.arrival_density}</strong> vessels/12h,{' '}
        {pred.features?.containers_incoming?.toLocaleString()} containers incoming,{' '}
        crane deficit: <strong style={{ color: risk > 55 ? 'var(--accent-red)' : 'var(--text-primary)' }}>{pred.features?.crane_deficit}</strong>,{' '}
        yard: <strong>{pred.features?.yard_utilization}%</strong>
      </div>

      {/* 72h Forecast Chart */}
      {expanded && forecast.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 8 }}>
            72-Hour Forecast
          </div>
          <ResponsiveContainer width="100%" height={140}>
            <AreaChart data={forecast} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
              <defs>
                <linearGradient id={`grad-${pred.berth_id}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(30,45,74,0.5)" />
              <XAxis dataKey="timestamp" tick={{ fill: '#4a5a7a', fontSize: 9 }} tickLine={false} axisLine={false} interval={4} />
              <YAxis domain={[0, 100]} tick={{ fill: '#4a5a7a', fontSize: 9 }} tickLine={false} axisLine={false} unit="%" />
              <Tooltip
                contentStyle={{ background: '#1a2438', border: '1px solid #1e2d4a', borderRadius: 6, fontSize: 11 }}
                formatter={(v) => [`${v.toFixed(1)}%`, 'Risk']}
              />
              <ReferenceLine y={75} stroke="#ff3b5c" strokeDasharray="4 2" strokeWidth={1} />
              <ReferenceLine y={55} stroke="#ff7b00" strokeDasharray="4 2" strokeWidth={1} />
              <Area type="monotone" dataKey="risk" stroke={color} fill={`url(#grad-${pred.berth_id})`} strokeWidth={2} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}

export default function CongestionPage() {
  const { congestion, loading } = useApp()
  const [running, setRunning] = useState(false)
  const [localPreds, setLocalPreds] = useState(null)

  const predictions = localPreds || congestion?.predictions || []
  const summary = congestion?.summary || {}

  const handleRunPrediction = async () => {
    setRunning(true)
    try {
      const result = await portflowApi.runCongestionPredict()
      setLocalPreds(result.predictions)
    } catch (e) {
      alert('Prediction error: ' + e.message)
    } finally {
      setRunning(false)
    }
  }

  const sortedPredictions = [...predictions].sort((a, b) => b.congestion_risk - a.congestion_risk)

  // Bar chart data
  const barData = sortedPredictions.map(p => ({
    name: p.berth_id,
    risk: p.congestion_risk,
    wait: p.expected_wait_hours,
  }))

  return (
    <div style={{ padding: 24 }}>
      <div className="page-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div className="page-title">📊 Congestion Prediction</div>
            <div className="page-subtitle">ML-powered berth congestion risk scoring using Gradient Boosting model</div>
          </div>
          <button className="btn btn-primary" onClick={handleRunPrediction} disabled={running}>
            {running ? '⏳ Running...' : '▶ Run Prediction'}
          </button>
        </div>
      </div>

      {/* Summary KPIs */}
      <div className="kpi-grid" style={{ marginBottom: 24 }}>
        <div className="kpi-card">
          <div className="kpi-label">🔴 Critical</div>
          <div className="kpi-value" style={{ color: 'var(--risk-critical)' }}>{summary.critical || 0}</div>
          <div className="kpi-sub">berths ≥75%</div>
          <div className="kpi-accent" style={{ background: 'var(--risk-critical)' }} />
        </div>
        <div className="kpi-card">
          <div className="kpi-label">🟠 High</div>
          <div className="kpi-value" style={{ color: 'var(--risk-high)' }}>{summary.high || 0}</div>
          <div className="kpi-sub">berths 55–75%</div>
          <div className="kpi-accent" style={{ background: 'var(--risk-high)' }} />
        </div>
        <div className="kpi-card">
          <div className="kpi-label">🟡 Medium</div>
          <div className="kpi-value" style={{ color: 'var(--risk-medium)' }}>{summary.medium || 0}</div>
          <div className="kpi-sub">berths 30–55%</div>
          <div className="kpi-accent" style={{ background: 'var(--risk-medium)' }} />
        </div>
        <div className="kpi-card">
          <div className="kpi-label">🟢 Low</div>
          <div className="kpi-value" style={{ color: 'var(--risk-low)' }}>{summary.low || 0}</div>
          <div className="kpi-sub">berths &lt;30%</div>
          <div className="kpi-accent" style={{ background: 'var(--risk-low)' }} />
        </div>
      </div>

      {/* Bar Chart Overview */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-header">
          <div className="card-title">Congestion Risk by Berth</div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
            Dashed lines: 75% (critical) and 55% (high) thresholds
          </div>
        </div>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={barData} barSize={32} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(30,45,74,0.7)" />
            <XAxis dataKey="name" tick={{ fill: '#8a9bbf', fontSize: 12 }} axisLine={false} tickLine={false} />
            <YAxis domain={[0, 100]} tick={{ fill: '#8a9bbf', fontSize: 11 }} axisLine={false} tickLine={false} unit="%" />
            <Tooltip
              contentStyle={{ background: '#1a2438', border: '1px solid #1e2d4a', borderRadius: 8, fontSize: 12 }}
              formatter={(v, n) => [n === 'risk' ? `${v.toFixed(1)}%` : `${v.toFixed(1)}h`, n === 'risk' ? 'Risk' : 'Expected Wait']}
            />
            <ReferenceLine y={75} stroke="#ff3b5c" strokeDasharray="5 3" strokeWidth={1.5} />
            <ReferenceLine y={55} stroke="#ff7b00" strokeDasharray="5 3" strokeWidth={1.5} />
            <Bar dataKey="risk" radius={[4, 4, 0, 0]}>
              {barData.map((entry, i) => (
                <Cell key={i} fill={getRiskColor(entry.risk)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
        {[
          { label: 'Low (<30%)', color: '#00d97e' },
          { label: 'Medium (30–55%)', color: '#ffc107' },
          { label: 'High (55–75%)', color: '#ff7b00' },
          { label: 'Critical (≥75%)', color: '#ff3b5c' },
        ].map(l => (
          <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
            <div style={{ width: 12, height: 12, borderRadius: 2, background: l.color }} />
            <span style={{ color: 'var(--text-secondary)' }}>{l.label}</span>
          </div>
        ))}
      </div>

      {/* Berth Cards */}
      <div className="grid-2">
        {loading ? <div className="spinner" /> : sortedPredictions.map(pred => (
          <BerthCard key={pred.berth_id} pred={pred} />
        ))}
      </div>
    </div>
  )
}
