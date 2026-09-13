import React, { useState } from 'react'
import { useApp } from '../context/AppContext'
import { portflowApi } from '../services/api'

export default function SmartRouting() {
  const { routing, loading } = useApp()
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState(null)
  const [selectedRec, setSelectedRec] = useState(null)

  const recs = (result || routing)?.recommendations || []

  const handleRun = async () => {
    setRunning(true)
    try {
      const r = await portflowApi.runRouting()
      setResult(r)
    } catch (e) {
      alert('Routing error: ' + e.message)
    } finally {
      setRunning(false)
    }
  }

  const totalSaved = recs.reduce((acc, r) => acc + (r.time_saved || 0), 0)
  const highConfidence = recs.filter(r => r.confidence >= 0.75).length

  return (
    <div style={{ padding: 24 }}>
      <div className="page-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div className="page-title">🗺️ Smart Routing</div>
            <div className="page-subtitle">AI-powered vessel rerouting recommendations to minimize waiting time</div>
          </div>
          <button className="btn btn-primary" onClick={handleRun} disabled={running}>
            {running ? '⏳ Analyzing...' : '▶ Run Analysis'}
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="kpi-grid" style={{ marginBottom: 20 }}>
        <div className="kpi-card">
          <div className="kpi-label">Recommendations</div>
          <div className="kpi-value" style={{ color: 'var(--accent-blue)' }}>{recs.length}</div>
          <div className="kpi-sub">vessels to reroute</div>
          <div className="kpi-accent" style={{ background: 'var(--accent-blue)' }} />
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Total Time Saved</div>
          <div className="kpi-value" style={{ color: 'var(--accent-green)' }}>{totalSaved.toFixed(1)}h</div>
          <div className="kpi-sub">across all rerouted vessels</div>
          <div className="kpi-accent" style={{ background: 'var(--accent-green)' }} />
        </div>
        <div className="kpi-card">
          <div className="kpi-label">High Confidence</div>
          <div className="kpi-value" style={{ color: 'var(--accent-cyan)' }}>{highConfidence}</div>
          <div className="kpi-sub">confidence ≥75%</div>
          <div className="kpi-accent" style={{ background: 'var(--accent-cyan)' }} />
        </div>
      </div>

      {recs.length === 0 ? (
        <div className="card">
          <div className="alert-banner alert-info" style={{ margin: 0 }}>
            <span>✅</span>
            <div>
              <strong>No rerouting required.</strong>
              <div style={{ fontSize: 12, marginTop: 4 }}>
                All vessels are within acceptable congestion thresholds. Run the analysis to check for new recommendations.
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid-2">
          {/* Recommendations List */}
          <div>
            {recs.map((rec, i) => (
              <div
                key={rec.vessel_id}
                className="card"
                style={{
                  marginBottom: 16,
                  cursor: 'pointer',
                  borderLeft: selectedRec?.vessel_id === rec.vessel_id
                    ? '4px solid var(--accent-cyan)'
                    : '4px solid var(--border)',
                  transition: 'border-color 0.2s'
                }}
                onClick={() => setSelectedRec(selectedRec?.vessel_id === rec.vessel_id ? null : rec)}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <strong style={{ fontSize: 15 }}>{rec.vessel_name}</strong>
                      <code style={{ fontSize: 11, color: 'var(--text-muted)' }}>{rec.vessel_id}</code>
                      <span className={`priority-badge priority-${rec.priority}`}>{rec.priority}</span>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                      {rec.containers?.toLocaleString()} containers
                    </div>
                  </div>
                  <div className="improvement positive" style={{ fontSize: 14, padding: '4px 12px' }}>
                    ↓{rec.time_saved?.toFixed(1)}h saved
                  </div>
                </div>

                {/* Before/After Route */}
                <div style={{
                  display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 8,
                  alignItems: 'center', marginBottom: 12
                }}>
                  <div style={{
                    background: 'rgba(255,59,92,0.08)', border: '1px solid rgba(255,59,92,0.2)',
                    borderRadius: 8, padding: '10px 14px', textAlign: 'center'
                  }}>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>CURRENT</div>
                    <div style={{ fontSize: 20, fontWeight: 900, color: 'var(--accent-red)' }}>{rec.current_berth}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Wait: {rec.current_wait?.toFixed(1)}h</div>
                    <div style={{ fontSize: 11, color: 'var(--accent-red)', marginTop: 4 }}>
                      Risk: {rec.current_risk?.toFixed(0)}%
                    </div>
                  </div>
                  <div style={{ textAlign: 'center', fontSize: 20, color: 'var(--accent-cyan)' }}>→</div>
                  <div style={{
                    background: 'rgba(0,217,126,0.08)', border: '1px solid rgba(0,217,126,0.2)',
                    borderRadius: 8, padding: '10px 14px', textAlign: 'center'
                  }}>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>RECOMMENDED</div>
                    <div style={{ fontSize: 20, fontWeight: 900, color: 'var(--accent-green)' }}>{rec.recommended_berth}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Wait: {rec.recommended_wait?.toFixed(1)}h</div>
                    <div style={{ fontSize: 11, color: 'var(--accent-green)', marginTop: 4 }}>
                      Risk: {rec.recommended_risk?.toFixed(0)}%
                    </div>
                  </div>
                </div>

                {/* Confidence */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                    Confidence: {(rec.confidence * 100).toFixed(0)}%
                  </span>
                  <div className="progress-bar" style={{ flex: 1 }}>
                    <div className="progress-fill" style={{
                      width: `${rec.confidence * 100}%`,
                      background: rec.confidence >= 0.75 ? 'var(--accent-green)' : 'var(--accent-yellow)'
                    }} />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Detail Panel */}
          <div>
            {selectedRec ? (
              <div className="card" style={{ position: 'sticky', top: 24 }}>
                <div className="card-header">
                  <div className="card-title">🤖 AI Explanation</div>
                  <span style={{ fontSize: 12, color: 'var(--accent-cyan)' }}>{selectedRec.vessel_id}</span>
                </div>
                <div style={{
                  background: 'var(--bg-primary)', borderRadius: 8, padding: 16,
                  fontSize: 13, lineHeight: 1.7, color: 'var(--text-primary)',
                  border: '1px solid var(--border)', marginBottom: 16
                }}>
                  {selectedRec.reason}
                </div>

                <div className="section-heading">Impact Summary</div>
                <div className="stat-row">
                  <span className="stat-label">Current Berth</span>
                  <span className="stat-value" style={{ color: 'var(--accent-red)' }}>{selectedRec.current_berth}</span>
                </div>
                <div className="stat-row">
                  <span className="stat-label">Recommended Berth</span>
                  <span className="stat-value" style={{ color: 'var(--accent-green)' }}>{selectedRec.recommended_berth}</span>
                </div>
                <div className="stat-row">
                  <span className="stat-label">Wait Time Saved</span>
                  <span className="stat-value" style={{ color: 'var(--accent-green)' }}>
                    {selectedRec.time_saved?.toFixed(1)}h ({((selectedRec.current_wait - selectedRec.recommended_wait) / Math.max(selectedRec.current_wait, 0.01) * 100).toFixed(0)}% reduction)
                  </span>
                </div>
                <div className="stat-row">
                  <span className="stat-label">Risk Reduction</span>
                  <span className="stat-value" style={{ color: 'var(--accent-green)' }}>
                    {selectedRec.current_risk?.toFixed(0)}% → {selectedRec.recommended_risk?.toFixed(0)}%
                  </span>
                </div>
                <div className="stat-row">
                  <span className="stat-label">Confidence</span>
                  <span className="stat-value">{(selectedRec.confidence * 100).toFixed(0)}%</span>
                </div>
              </div>
            ) : (
              <div className="card">
                <div className="empty-state">
                  <div className="empty-state-icon">🗺️</div>
                  <div className="empty-state-title">Select a recommendation</div>
                  <div className="empty-state-text">Click any routing recommendation to see the AI explanation</div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
