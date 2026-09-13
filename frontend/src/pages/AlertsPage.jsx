import React from 'react'
import { useApp } from '../context/AppContext'

const LEVEL_CONFIG = {
  critical: { icon: '🚨', color: 'var(--accent-red)', bg: 'rgba(255,59,92,0.08)', border: 'rgba(255,59,92,0.2)' },
  warning: { icon: '⚠️', color: 'var(--accent-yellow)', bg: 'rgba(255,193,7,0.08)', border: 'rgba(255,193,7,0.2)' },
  info: { icon: 'ℹ️', color: 'var(--accent-blue)', bg: 'rgba(43,127,255,0.08)', border: 'rgba(43,127,255,0.2)' },
}

const CATEGORY_LABEL = {
  berth_congestion: 'Berth Congestion',
  vessel_delays: 'Vessel Delays',
  yard_capacity: 'Yard Capacity',
  crane_shortage: 'Crane Shortage',
  system: 'System',
  berth_utilization: 'Berth Utilization',
}

export default function AlertsPage() {
  const { alerts, acknowledgeAlert } = useApp()

  const active = alerts.filter(a => !a.acknowledged)
  const acknowledged = alerts.filter(a => a.acknowledged)

  const criticals = active.filter(a => a.level === 'critical')
  const warnings = active.filter(a => a.level === 'warning')
  const infos = active.filter(a => a.level === 'info')

  function AlertCard({ alert }) {
    const cfg = LEVEL_CONFIG[alert.level] || LEVEL_CONFIG.info
    return (
      <div style={{
        background: cfg.bg, border: `1px solid ${cfg.border}`,
        borderRadius: 8, padding: 16, marginBottom: 10,
        opacity: alert.acknowledged ? 0.5 : 1,
        borderLeft: `4px solid ${cfg.color}`
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ display: 'flex', gap: 10, flex: 1 }}>
            <span style={{ fontSize: 18 }}>{cfg.icon}</span>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
                  color: cfg.color, letterSpacing: '0.5px' }}>
                  {alert.level}
                </span>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  {CATEGORY_LABEL[alert.category] || alert.category}
                </span>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 'auto' }}>
                  {alert.timestamp}
                </span>
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.5 }}>
                {alert.message}
              </div>
              {alert.data && Object.keys(alert.data).length > 0 && (
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                  {Object.entries(alert.data).map(([k, v]) =>
                    `${k}: ${typeof v === 'number' ? v.toFixed ? v.toFixed(1) : v : v}`
                  ).join(' · ')}
                </div>
              )}
            </div>
          </div>
          {!alert.acknowledged && (
            <button
              className="btn btn-sm"
              style={{ background: 'none', border: `1px solid ${cfg.border}`, color: cfg.color,
                cursor: 'pointer', fontSize: 11, marginLeft: 12, whiteSpace: 'nowrap' }}
              onClick={() => acknowledgeAlert(alert.alert_id)}
            >
              ✓ Ack
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div style={{ padding: 24 }}>
      <div className="page-header">
        <div className="page-title">🔔 Alerts & Notifications</div>
        <div className="page-subtitle">Real-time port operations alerts and anomalies</div>
      </div>

      {/* Summary */}
      <div className="kpi-grid" style={{ marginBottom: 20 }}>
        <div className="kpi-card">
          <div className="kpi-label">🚨 Critical</div>
          <div className="kpi-value" style={{ color: 'var(--accent-red)' }}>{criticals.length}</div>
          <div className="kpi-sub">unacknowledged</div>
          <div className="kpi-accent" style={{ background: 'var(--accent-red)' }} />
        </div>
        <div className="kpi-card">
          <div className="kpi-label">⚠️ Warnings</div>
          <div className="kpi-value" style={{ color: 'var(--accent-yellow)' }}>{warnings.length}</div>
          <div className="kpi-sub">unacknowledged</div>
          <div className="kpi-accent" style={{ background: 'var(--accent-yellow)' }} />
        </div>
        <div className="kpi-card">
          <div className="kpi-label">ℹ️ Info</div>
          <div className="kpi-value" style={{ color: 'var(--accent-blue)' }}>{infos.length}</div>
          <div className="kpi-sub">unacknowledged</div>
          <div className="kpi-accent" style={{ background: 'var(--accent-blue)' }} />
        </div>
        <div className="kpi-card">
          <div className="kpi-label">✓ Resolved</div>
          <div className="kpi-value" style={{ color: 'var(--accent-green)' }}>{acknowledged.length}</div>
          <div className="kpi-sub">acknowledged</div>
          <div className="kpi-accent" style={{ background: 'var(--accent-green)' }} />
        </div>
      </div>

      {/* Active Alerts */}
      {active.length > 0 ? (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-header">
            <div className="card-title">Active Alerts ({active.length})</div>
            <button className="btn btn-sm btn-secondary"
              onClick={() => active.forEach(a => acknowledgeAlert(a.alert_id))}>
              Acknowledge All
            </button>
          </div>
          {criticals.map(a => <AlertCard key={a.alert_id} alert={a} />)}
          {warnings.map(a => <AlertCard key={a.alert_id} alert={a} />)}
          {infos.map(a => <AlertCard key={a.alert_id} alert={a} />)}
        </div>
      ) : (
        <div className="alert-banner alert-info" style={{ marginBottom: 20 }}>
          <span>✅</span> All alerts acknowledged. System is operating normally.
        </div>
      )}

      {/* Acknowledged */}
      {acknowledged.length > 0 && (
        <div className="card">
          <div className="card-header">
            <div className="card-title">Acknowledged ({acknowledged.length})</div>
          </div>
          {acknowledged.map(a => <AlertCard key={a.alert_id} alert={a} />)}
        </div>
      )}
    </div>
  )
}
