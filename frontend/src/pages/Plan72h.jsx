import React, { useState } from 'react'
import { useApp } from '../context/AppContext'

const EVENT_COLORS = {
  arrival: '#2b7fff',
  departure: '#00d97e',
  crane_assignment: '#00c4e8',
  intervention: '#ff3b5c',
  info: '#8a9bbf',
}

const RISK_COLORS = {
  critical: '#ff3b5c',
  high: '#ff7b00',
  medium: '#ffc107',
  low: '#00d97e',
  info: '#8a9bbf',
}

function EventIcon({ type }) {
  return {
    arrival: '🛳️',
    departure: '⛵',
    crane_assignment: '🏗️',
    intervention: '⚠️',
    info: 'ℹ️',
  }[type] || '•'
}

function TimeBlock({ block, expanded, onToggle }) {
  const riskColor = block.congestion_level >= 75 ? '#ff3b5c'
    : block.congestion_level >= 55 ? '#ff7b00'
    : block.congestion_level >= 30 ? '#ffc107' : '#00d97e'

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div
        style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
        onClick={onToggle}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 8,
            background: `${riskColor}22`, border: `1px solid ${riskColor}44`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 18
          }}>
            {block.congestion_level >= 75 ? '🔴' : block.congestion_level >= 55 ? '🟠' : '🟢'}
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)' }}>{block.label}</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              {block.event_count} events · Congestion: {block.congestion_level?.toFixed(0)}%
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 2 }}>Yard</div>
            <div style={{ fontWeight: 700, color: 'var(--text-secondary)' }}>{block.yard_utilization?.toFixed(0)}%</div>
          </div>
          <div style={{ fontSize: 16, color: 'var(--text-muted)' }}>{expanded ? '▲' : '▼'}</div>
        </div>
      </div>

      {expanded && (
        <div style={{ marginTop: 16 }}>
          <div style={{ height: 1, background: 'var(--border)', marginBottom: 12 }} />
          {block.events.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', fontSize: 13, padding: '8px 0' }}>No events in this window.</div>
          ) : (
            block.events.map((ev, i) => (
              <div key={i} className="timeline-event">
                <div className="timeline-time">{ev.time}</div>
                <div className="timeline-dot" style={{
                  background: RISK_COLORS[ev.risk_level] || EVENT_COLORS[ev.event_type] || '#8a9bbf'
                }} />
                <div className="timeline-content">
                  <EventIcon type={ev.event_type} /> {ev.description}
                  {ev.berth_id && ev.event_type !== 'intervention' && (
                    <span style={{ color: 'var(--accent-cyan)', marginLeft: 8, fontSize: 11 }}>
                      [{ev.berth_id}]
                    </span>
                  )}
                  {ev.containers && (
                    <span style={{ color: 'var(--text-muted)', marginLeft: 8, fontSize: 11 }}>
                      {ev.containers?.toLocaleString()} TEU
                    </span>
                  )}
                  {ev.waiting_time > 0 && (
                    <span style={{
                      marginLeft: 8, fontSize: 11,
                      color: ev.waiting_time > 3 ? 'var(--accent-red)' : 'var(--text-muted)'
                    }}>
                      wait: {ev.waiting_time}h
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}

function GanttChart({ berthOpt }) {
  const assignments = berthOpt?.assignments || []
  if (!assignments.length) return null

  const berthIds = [...new Set(assignments.map(a => a.berth_id))].sort()
  const now = new Date()
  const windowHours = 24

  const colors = ['#2b7fff', '#00c4e8', '#00d97e', '#ffc107', '#ff7b00', '#7c5cd8', '#ff3b5c', '#5f8fff']

  return (
    <div className="card" style={{ marginBottom: 20 }}>
      <div className="card-header">
        <div className="card-title">📊 Gantt — Berth Occupancy (Next 24h)</div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Each block = one vessel. Click to see details.</div>
      </div>
      <div className="gantt-container">
        {/* Time axis */}
        <div style={{ display: 'flex', marginLeft: 80, marginBottom: 4 }}>
          {Array.from({ length: 13 }, (_, i) => i * 2).map(h => (
            <div key={h} style={{ flex: 1, fontSize: 10, color: 'var(--text-muted)', textAlign: 'center' }}>
              {h}h
            </div>
          ))}
        </div>
        {berthIds.map(bid => {
          const berthAssignments = assignments.filter(a => a.berth_id === bid)
          return (
            <div key={bid} className="gantt-row">
              <div className="gantt-label">{bid}</div>
              <div className="gantt-track">
                {berthAssignments.map((a, idx) => {
                  const start = new Date(a.start_time)
                  const end = new Date(a.end_time)
                  const offsetHours = (start - now) / 3600000
                  const durationHours = (end - start) / 3600000

                  const leftPct = Math.max(0, (offsetHours / windowHours) * 100)
                  const widthPct = Math.min(100 - leftPct, (durationHours / windowHours) * 100)

                  if (widthPct <= 0 || leftPct >= 100) return null

                  return (
                    <div
                      key={idx}
                      className="gantt-block"
                      title={`${a.vessel_name} (${a.vessel_id}) — ${a.waiting_time?.toFixed(1)}h wait`}
                      style={{
                        left: `${leftPct}%`,
                        width: `${Math.max(widthPct, 2)}%`,
                        background: colors[idx % colors.length] + '33',
                        border: `1px solid ${colors[idx % colors.length]}88`,
                        color: colors[idx % colors.length],
                      }}
                    >
                      {widthPct > 8 ? a.vessel_id : ''}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function Plan72h() {
  const { plan72h, berthOpt, loading } = useApp()
  const [expanded, setExpanded] = useState({ 0: true, 1: false, 2: false, 3: false })

  const blocks = plan72h?.plan || []
  const totalEvents = plan72h?.total_events || 0

  const arrivals = blocks.reduce((acc, b) => acc + (b.events?.filter(e => e.event_type === 'arrival').length || 0), 0)
  const departures = blocks.reduce((acc, b) => acc + (b.events?.filter(e => e.event_type === 'departure').length || 0), 0)
  const interventions = blocks.reduce((acc, b) => acc + (b.events?.filter(e => e.event_type === 'intervention').length || 0), 0)

  return (
    <div style={{ padding: 24 }}>
      <div className="page-header">
        <div className="page-title">📅 72-Hour Operations Plan</div>
        <div className="page-subtitle">AI-generated operational timeline with vessel movements, berth assignments, and interventions</div>
      </div>

      {/* KPIs */}
      <div className="kpi-grid" style={{ marginBottom: 20 }}>
        <div className="kpi-card">
          <div className="kpi-label">Total Events</div>
          <div className="kpi-value">{totalEvents}</div>
          <div className="kpi-sub">in 72h window</div>
          <div className="kpi-accent" style={{ background: 'var(--accent-blue)' }} />
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Arrivals</div>
          <div className="kpi-value" style={{ color: 'var(--accent-blue)' }}>{arrivals}</div>
          <div className="kpi-sub">vessel arrivals</div>
          <div className="kpi-accent" style={{ background: 'var(--accent-blue)' }} />
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Departures</div>
          <div className="kpi-value" style={{ color: 'var(--accent-green)' }}>{departures}</div>
          <div className="kpi-sub">vessel departures</div>
          <div className="kpi-accent" style={{ background: 'var(--accent-green)' }} />
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Interventions</div>
          <div className="kpi-value" style={{ color: interventions > 0 ? 'var(--accent-red)' : 'var(--text-primary)' }}>{interventions}</div>
          <div className="kpi-sub">congestion alerts</div>
          <div className="kpi-accent" style={{ background: 'var(--accent-red)' }} />
        </div>
      </div>

      {/* Gantt */}
      <GanttChart berthOpt={berthOpt} />

      {/* Time Blocks */}
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)' }}>Timeline Blocks</div>
        <button className="btn btn-secondary btn-sm" onClick={() => {
          const allExpanded = Object.values(expanded).every(v => v)
          const next = {}
          blocks.forEach((_, i) => { next[i] = !allExpanded })
          setExpanded(next)
        }}>
          {Object.values(expanded).every(v => v) ? 'Collapse All' : 'Expand All'}
        </button>
      </div>

      {loading ? <div className="spinner" /> : blocks.map((block, i) => (
        <TimeBlock
          key={i}
          block={block}
          expanded={!!expanded[i]}
          onToggle={() => setExpanded(prev => ({ ...prev, [i]: !prev[i] }))}
        />
      ))}
    </div>
  )
}
