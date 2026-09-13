import React, { useState, useRef } from 'react'
import { useApp } from '../context/AppContext'
import { portflowApi } from '../services/api'

export default function DataManagement() {
  const { loadAll } = useApp()
  const [simConfig, setSimConfig] = useState({
    num_vessels: 50,
    num_berths: 8,
    num_cranes: 24,
    duration_hours: 72,
    congestion_factor: 1.0,
    seed: 42,
  })
  const [running, setRunning] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState(null)
  const [error, setError] = useState(null)
  const fileRef = useRef(null)

  const showMsg = (msg, isError = false) => {
    if (isError) setError(msg); else setMessage(msg)
    setTimeout(() => { setMessage(null); setError(null) }, 4000)
  }

  const handleRunSimulation = async () => {
    setRunning(true)
    setError(null)
    try {
      const r = await portflowApi.runSimulation(simConfig)
      await loadAll()
      showMsg(`✅ Simulation complete: ${r.summary?.vessels} vessels, ${r.summary?.berths} berths, ${r.summary?.cranes} cranes`)
    } catch (e) {
      showMsg(e.message, true)
    } finally {
      setRunning(false)
    }
  }

  const handleReset = async () => {
    setRunning(true)
    try {
      await portflowApi.resetData()
      await loadAll()
      showMsg('✅ Reset to default demo dataset')
    } catch (e) {
      showMsg(e.message, true)
    } finally {
      setRunning(false)
    }
  }

  const handleUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const r = await portflowApi.uploadData(formData)
      await loadAll()
      showMsg(`✅ ${r.message}`)
    } catch (e) {
      showMsg(e.message, true)
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  const handleGenerateCSV = () => {
    const headers = 'vessel_id,vessel_name,eta,etd,containers,vessel_size,priority,destination,required_cranes'
    const rows = [
      'V101,MSC Gulsun,2025-01-15T08:00:00,2025-01-16T08:00:00,14000,vlcc,high,Rotterdam,5',
      'V102,Ever Given,2025-01-15T10:00:00,2025-01-16T10:00:00,8000,large,normal,Singapore,4',
      'V103,HMM Algeciras,2025-01-15T12:00:00,2025-01-16T12:00:00,6000,large,normal,Busan,3',
      'V104,Maersk Hamburg,2025-01-15T14:00:00,2025-01-15T20:00:00,3500,medium,critical,Rotterdam,3',
      'V105,OOCL London,2025-01-15T16:00:00,2025-01-16T04:00:00,2200,medium,normal,Hamburg,2',
    ]
    const csv = [headers, ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'sample_vessels.csv'
    a.click()
    URL.revokeObjectURL(url)
    showMsg('✅ Sample CSV downloaded')
  }

  return (
    <div style={{ padding: 24 }}>
      <div className="page-header">
        <div className="page-title">💾 Data Management</div>
        <div className="page-subtitle">Load, generate, and manage port simulation datasets</div>
      </div>

      {message && (
        <div className="alert-banner alert-info" style={{ marginBottom: 16 }}>
          <span>{message}</span>
        </div>
      )}
      {error && (
        <div className="alert-banner alert-critical" style={{ marginBottom: 16 }}>
          <span>🚨</span> {error}
        </div>
      )}

      <div className="grid-2">
        {/* Simulation Config */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">⚙️ Simulation Parameters</div>
          </div>

          <div className="input-group">
            <label className="input-label">
              Vessels: <strong style={{ color: 'var(--accent-cyan)' }}>{simConfig.num_vessels}</strong>
            </label>
            <input type="range" className="form-input" min={10} max={150} step={5}
              value={simConfig.num_vessels}
              onChange={e => setSimConfig(p => ({ ...p, num_vessels: +e.target.value }))} />
          </div>

          <div className="input-group">
            <label className="input-label">
              Berths: <strong style={{ color: 'var(--accent-cyan)' }}>{simConfig.num_berths}</strong>
            </label>
            <input type="range" className="form-input" min={3} max={16} step={1}
              value={simConfig.num_berths}
              onChange={e => setSimConfig(p => ({ ...p, num_berths: +e.target.value }))} />
          </div>

          <div className="input-group">
            <label className="input-label">
              Cranes: <strong style={{ color: 'var(--accent-cyan)' }}>{simConfig.num_cranes}</strong>
            </label>
            <input type="range" className="form-input" min={5} max={50} step={2}
              value={simConfig.num_cranes}
              onChange={e => setSimConfig(p => ({ ...p, num_cranes: +e.target.value }))} />
          </div>

          <div className="input-group">
            <label className="input-label">
              Congestion Factor: <strong style={{ color: 'var(--accent-cyan)' }}>{simConfig.congestion_factor.toFixed(1)}×</strong>
            </label>
            <input type="range" className="form-input" min={0.5} max={3} step={0.1}
              value={simConfig.congestion_factor}
              onChange={e => setSimConfig(p => ({ ...p, congestion_factor: +e.target.value }))} />
          </div>

          <div className="input-group">
            <label className="input-label">Random Seed</label>
            <input type="number" className="form-input" value={simConfig.seed}
              onChange={e => setSimConfig(p => ({ ...p, seed: +e.target.value }))} />
          </div>

          <button className="btn btn-primary" style={{ width: '100%', marginTop: 8 }}
            onClick={handleRunSimulation} disabled={running}>
            {running ? '⏳ Generating...' : '▶ Run Simulation'}
          </button>
        </div>

        {/* Data Actions */}
        <div>
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-header">
              <div className="card-title">📂 Data Actions</div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button className="btn btn-secondary" onClick={handleReset} disabled={running}>
                🔄 Reset to Demo Dataset
              </button>
              <button className="btn btn-secondary" onClick={() => fileRef.current?.click()} disabled={uploading}>
                {uploading ? '⏳ Uploading...' : '📤 Upload Vessel CSV'}
              </button>
              <input ref={fileRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={handleUpload} />
              <button className="btn btn-secondary" onClick={handleGenerateCSV}>
                📥 Download Sample CSV
              </button>
            </div>
          </div>

          {/* CSV Schema */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">📋 CSV Schema</div>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 12 }}>
              Upload a CSV with vessel data. Required columns:
            </div>
            <div style={{ fontFamily: 'monospace', fontSize: 11, background: 'var(--bg-primary)',
              borderRadius: 6, padding: 12, border: '1px solid var(--border)' }}>
              <div style={{ color: 'var(--accent-cyan)', marginBottom: 4 }}>vessel_id, vessel_name, eta, etd</div>
              <div style={{ color: 'var(--accent-green)', marginBottom: 4 }}>containers, vessel_size, priority</div>
              <div style={{ color: 'var(--accent-yellow)', marginBottom: 4 }}>destination, required_cranes</div>
              <div style={{ color: 'var(--text-muted)', marginTop: 8 }}>
                vessel_size: small | medium | large | vlcc<br />
                priority: low | normal | high | critical<br />
                eta/etd: ISO 8601 format (2025-01-15T08:00:00)
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Demo Scenario Info */}
      <div className="card" style={{ marginTop: 20 }}>
        <div className="card-header">
          <div className="card-title">🎯 IBM BoB Demo Scenario</div>
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
          <p>The default demo scenario runs <strong style={{ color: 'var(--text-primary)' }}>50 vessels, 8 berths, 24 cranes</strong> over a 72-hour window with a congestion factor of 1.2×.</p>
          <p style={{ marginTop: 8 }}>This creates realistic congestion waves that trigger all AI features: congestion prediction, berth optimization, crane optimization, smart routing recommendations, and 72-hour planning.</p>
          <p style={{ marginTop: 8 }}>The simulation uses a <strong style={{ color: 'var(--text-primary)' }}>Gradient Boosting</strong> ML model for congestion prediction and a <strong style={{ color: 'var(--text-primary)' }}>greedy priority optimizer</strong> for berth assignment.</p>
        </div>
      </div>
    </div>
  )
}
