import React, { useState } from 'react'
import { useApp } from '../context/AppContext'
import { portflowApi } from '../services/api'

const PRESET_SCENARIOS = [
  {
    name: '20% Vessel Surge',
    description: 'Simulate a 20% increase in vessel arrivals',
    icon: '📈',
    config: { name: '20% Vessel Surge', vessel_arrival_increase: 0.2 }
  },
  {
    name: '2 Cranes Down',
    description: 'Two cranes become unavailable for maintenance',
    icon: '🔧',
    config: { name: '2 Cranes Down', cranes_unavailable: 2 }
  },
  {
    name: 'B3 Offline',
    description: 'Berth B3 becomes unavailable',
    icon: '⛔',
    config: { name: 'B3 Offline', berths_unavailable: ['B3'] }
  },
  {
    name: 'Yard -15%',
    description: 'Yard capacity reduced by 15%',
    icon: '📦',
    config: { name: 'Yard -15%', yard_capacity_decrease: 0.15 }
  },
  {
    name: 'Combined Crisis',
    description: '20% more vessels + 2 cranes down',
    icon: '🚨',
    config: { name: 'Combined Crisis', vessel_arrival_increase: 0.2, cranes_unavailable: 2 }
  }
]

export default function WhatIf() {
  const { vessels } = useApp()
  const [scenario, setScenario] = useState({
    name: 'Custom Scenario',
    description: '',
    vessel_arrival_increase: 0,
    cranes_unavailable: 0,
    berths_unavailable: [],
    yard_capacity_decrease: 0,
    early_arrival_vessel: '',
    early_arrival_hours: 0
  })
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)

  const handlePreset = (preset) => {
    setScenario(prev => ({ ...prev, ...preset.config, description: preset.description }))
    setResult(null)
  }

  const handleRun = async () => {
    setRunning(true)
    setError(null)
    setResult(null)
    try {
      const payload = {
        ...scenario,
        berths_unavailable: typeof scenario.berths_unavailable === 'string'
          ? scenario.berths_unavailable.split(',').map(s => s.trim()).filter(Boolean)
          : scenario.berths_unavailable,
        early_arrival_vessel: scenario.early_arrival_vessel || null
      }
      const r = await portflowApi.runScenario(payload)
      setResult(r)
    } catch (e) {
      setError(e.message)
    } finally {
      setRunning(false)
    }
  }

  const getImpactColor = (val, inverse = false) => {
    const isPositive = inverse ? val < 0 : val > 0
    if (val === 0) return 'var(--text-secondary)'
    return isPositive ? 'var(--accent-red)' : 'var(--accent-green)'
  }

  const baseline = result?.baseline_kpis || {}
  const scenario_kpis = result?.scenario_kpis || {}
  const impact = result?.impact || {}
  const mitigations = result?.mitigations || []

  return (
    <div style={{ padding: 24 }}>
      <div className="page-header">
        <div className="page-title">🔮 What-If Simulation</div>
        <div className="page-subtitle">Simulate operational changes and see predicted impact before implementing</div>
      </div>

      {/* Preset Scenarios */}
      <div className="section-heading">Quick Presets</div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20 }}>
        {PRESET_SCENARIOS.map(p => (
          <button key={p.name} className="btn btn-secondary" onClick={() => handlePreset(p)}>
            {p.icon} {p.name}
          </button>
        ))}
      </div>

      <div className="grid-2" style={{ marginBottom: 20 }}>
        {/* Scenario Builder */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">⚙️ Configure Scenario</div>
          </div>

          <div className="input-group">
            <label className="input-label">Scenario Name</label>
            <input className="form-input" value={scenario.name}
              onChange={e => setScenario(p => ({ ...p, name: e.target.value }))} />
          </div>

          <div className="input-group">
            <label className="input-label">
              Vessel Arrival Increase: <strong style={{ color: 'var(--accent-cyan)' }}>
                +{Math.round(scenario.vessel_arrival_increase * 100)}%
              </strong>
            </label>
            <input type="range" className="form-input" min={0} max={1} step={0.05}
              value={scenario.vessel_arrival_increase}
              onChange={e => setScenario(p => ({ ...p, vessel_arrival_increase: +e.target.value }))} />
          </div>

          <div className="input-group">
            <label className="input-label">
              Cranes Unavailable: <strong style={{ color: 'var(--accent-cyan)' }}>{scenario.cranes_unavailable}</strong>
            </label>
            <input type="range" className="form-input" min={0} max={8} step={1}
              value={scenario.cranes_unavailable}
              onChange={e => setScenario(p => ({ ...p, cranes_unavailable: +e.target.value }))} />
          </div>

          <div className="input-group">
            <label className="input-label">Berths Unavailable (comma-separated)</label>
            <input className="form-input" placeholder="e.g. B3, B5"
              value={Array.isArray(scenario.berths_unavailable)
                ? scenario.berths_unavailable.join(', ')
                : scenario.berths_unavailable}
              onChange={e => setScenario(p => ({ ...p, berths_unavailable: e.target.value }))} />
          </div>

          <div className="input-group">
            <label className="input-label">
              Yard Capacity Decrease: <strong style={{ color: 'var(--accent-cyan)' }}>
                -{Math.round(scenario.yard_capacity_decrease * 100)}%
              </strong>
            </label>
            <input type="range" className="form-input" min={0} max={0.5} step={0.05}
              value={scenario.yard_capacity_decrease}
              onChange={e => setScenario(p => ({ ...p, yard_capacity_decrease: +e.target.value }))} />
          </div>

          <div className="input-group">
            <label className="input-label">Early Arrival Vessel ID</label>
            <input className="form-input" placeholder="e.g. V104"
              value={scenario.early_arrival_vessel}
              onChange={e => setScenario(p => ({ ...p, early_arrival_vessel: e.target.value }))} />
          </div>

          <div className="input-group">
            <label className="input-label">
              Hours Early: <strong style={{ color: 'var(--accent-cyan)' }}>{scenario.early_arrival_hours}</strong>
            </label>
            <input type="range" className="form-input" min={0} max={12} step={1}
              value={scenario.early_arrival_hours}
              onChange={e => setScenario(p => ({ ...p, early_arrival_hours: +e.target.value }))} />
          </div>

          <button className="btn btn-primary" style={{ width: '100%' }}
            onClick={handleRun} disabled={running}>
            {running ? '⏳ Running Simulation...' : '▶ Run What-If Analysis'}
          </button>

          {error && (
            <div className="alert-banner alert-critical" style={{ marginTop: 12 }}>
              <span>🚨</span> {error}
            </div>
          )}
        </div>

        {/* Results */}
        <div>
          {!result ? (
            <div className="card">
              <div className="empty-state" style={{ padding: '48px 20px' }}>
                <div className="empty-state-icon">🔮</div>
                <div className="empty-state-title">Configure & Run a Scenario</div>
                <div className="empty-state-text">
                  Select a preset or customize the scenario, then click "Run What-If Analysis"
                  to see the predicted impact.
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="card" style={{ marginBottom: 16 }}>
                <div className="card-header">
                  <div className="card-title">📊 Scenario Impact</div>
                  <span className="risk-badge risk-critical">{result.scenario?.name}</span>
                </div>

                <div className="scenario-impact">
                  <div className="impact-card">
                    <div className="impact-value" style={{ color: getImpactColor(impact.wait_time_change) }}>
                      {impact.wait_time_change >= 0 ? '+' : ''}{impact.wait_time_change?.toFixed(1)}h
                    </div>
                    <div className="impact-label">Wait Time</div>
                  </div>
                  <div className="impact-card">
                    <div className="impact-value" style={{ color: getImpactColor(impact.critical_berths_change) }}>
                      {impact.critical_berths_change >= 0 ? '+' : ''}{impact.critical_berths_change}
                    </div>
                    <div className="impact-label">Critical Berths</div>
                  </div>
                  <div className="impact-card">
                    <div className="impact-value" style={{ color: getImpactColor(impact.yard_util_change) }}>
                      {impact.yard_util_change >= 0 ? '+' : ''}{impact.yard_util_change?.toFixed(1)}%
                    </div>
                    <div className="impact-label">Yard Util Δ</div>
                  </div>
                  <div className="impact-card">
                    <div className="impact-value" style={{ color: getImpactColor(impact.vessel_count_change) }}>
                      {impact.vessel_count_change >= 0 ? '+' : ''}{impact.vessel_count_change}
                    </div>
                    <div className="impact-label">Vessels Added</div>
                  </div>
                </div>
              </div>

              {/* Before vs After Table */}
              <div className="card" style={{ marginBottom: 16 }}>
                <div className="card-header">
                  <div className="card-title">Baseline vs Scenario</div>
                </div>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Metric</th>
                      <th>Baseline</th>
                      <th>Scenario</th>
                      <th>Δ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { label: 'Avg Wait Time', bKey: 'avg_waiting_time', sKey: 'avg_waiting_time', unit: 'h', inverse: false },
                      { label: 'Critical Berths', bKey: 'critical_berths', sKey: 'critical_berths', unit: '', inverse: false },
                      { label: 'Yard Utilization', bKey: 'yard_utilization', sKey: 'yard_utilization', unit: '%', inverse: false },
                      { label: 'Crane Utilization', bKey: 'crane_utilization', sKey: 'crane_utilization', unit: '%', inverse: false },
                      { label: 'Delayed Vessels', bKey: 'delayed_vessels', sKey: 'delayed_vessels', unit: '', inverse: false },
                    ].map(row => {
                      const bVal = baseline[row.bKey] || 0
                      const sVal = scenario_kpis[row.sKey] || 0
                      const delta = sVal - bVal
                      const color = delta > 0 ? 'var(--accent-red)' : delta < 0 ? 'var(--accent-green)' : 'var(--text-secondary)'
                      return (
                        <tr key={row.label}>
                          <td style={{ color: 'var(--text-secondary)' }}>{row.label}</td>
                          <td style={{ fontFamily: 'monospace' }}>{bVal.toFixed ? bVal.toFixed(1) : bVal}{row.unit}</td>
                          <td style={{ fontFamily: 'monospace', fontWeight: 700 }}>
                            {sVal.toFixed ? sVal.toFixed(1) : sVal}{row.unit}
                          </td>
                          <td style={{ color, fontWeight: 700, fontFamily: 'monospace' }}>
                            {delta > 0 ? '+' : ''}{delta.toFixed ? delta.toFixed(1) : delta}{row.unit}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mitigations */}
              {mitigations.length > 0 && (
                <div className="card">
                  <div className="card-header">
                    <div className="card-title">🛡️ Recommended Mitigations</div>
                  </div>
                  {mitigations.map((m, i) => (
                    <div key={i} style={{ display: 'flex', gap: 8, padding: '8px 0', borderBottom: i < mitigations.length - 1 ? '1px solid var(--border)' : 'none' }}>
                      <span style={{ color: 'var(--accent-cyan)' }}>→</span>
                      <span style={{ fontSize: 13 }}>{m}</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
