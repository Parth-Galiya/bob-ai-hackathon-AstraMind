import React, { useState } from 'react'
import { useApp } from '../context/AppContext'

/* ─── colour helpers ──────────────────────────────────────────────── */
function getRiskColor(risk) {
  if (risk >= 75) return '#ff3b5c'
  if (risk >= 55) return '#ff7b00'
  if (risk >= 30) return '#ffc107'
  return '#00d97e'
}
function getRiskLabel(risk) {
  if (risk >= 75) return 'Critical'
  if (risk >= 55) return 'High'
  if (risk >= 30) return 'Medium'
  return 'Low'
}

/* ─── Static schematic layout (no real GPS) ──────────────────────── */
// Each berth has a fixed SVG position.  We overlay real prediction data.
const BERTH_LAYOUT = [
  { id: 'B1', x: 120, y: 160, w: 100, h: 44 },
  { id: 'B2', x: 120, y: 220, w: 100, h: 44 },
  { id: 'B3', x: 120, y: 280, w: 100, h: 44 },
  { id: 'B4', x: 120, y: 340, w: 100, h: 44 },
  { id: 'B5', x: 340, y: 160, w: 100, h: 44 },
  { id: 'B6', x: 340, y: 220, w: 100, h: 44 },
  { id: 'B7', x: 340, y: 280, w: 100, h: 44 },
  { id: 'B8', x: 340, y: 340, w: 100, h: 44 },
]

/* yard zone boxes */
const YARD_LAYOUT = [
  { id: 'Y-Alpha',   x: 570, y: 140, w: 90, h: 70 },
  { id: 'Y-Bravo',   x: 570, y: 220, w: 90, h: 70 },
  { id: 'Y-Charlie', x: 570, y: 300, w: 90, h: 70 },
  { id: 'Y-Delta',   x: 670, y: 140, w: 90, h: 70 },
  { id: 'Y-Echo',    x: 670, y: 220, w: 90, h: 70 },
]

/* crane icons (small circles near their berth) */
function craneX(bx, bw, i) { return bx + 8 + i * 14 }
function craneY(by) { return by + 52 }

/* ─── Tooltip component ──────────────────────────────────────────── */
function BerthTooltip({ berth, pred, onClose }) {
  if (!berth) return null
  const risk = pred?.congestion_risk ?? 0
  return (
    <div style={{
      position: 'absolute', top: 20, right: 20, zIndex: 100,
      background: 'var(--bg-card)', border: '1px solid var(--border-light)',
      borderRadius: 10, padding: 18, width: 260,
      boxShadow: 'var(--shadow-lg)'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
        <strong style={{ color: 'var(--text-primary)', fontSize: 15 }}>Berth {berth.id}</strong>
        <button onClick={onClose} style={{
          background: 'none', border: 'none', color: 'var(--text-secondary)',
          cursor: 'pointer', fontSize: 16, lineHeight: 1
        }}>✕</button>
      </div>

      {/* Risk bar */}
      <div style={{ marginBottom: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
          <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>Congestion Risk</span>
          <span style={{ color: getRiskColor(risk), fontWeight: 700 }}>{risk.toFixed(0)}%</span>
        </div>
        <div style={{ height: 6, background: 'var(--border)', borderRadius: 3 }}>
          <div style={{ width: `${risk}%`, height: '100%', background: getRiskColor(risk), borderRadius: 3 }} />
        </div>
        <div style={{ marginTop: 4, textAlign: 'right' }}>
          <span className={`risk-badge risk-${getRiskLabel(risk).toLowerCase()}`}>
            {getRiskLabel(risk)}
          </span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 12px', fontSize: 12 }}>
        <div style={{ color: 'var(--text-secondary)' }}>Utilization</div>
        <div style={{ color: 'var(--text-primary)', textAlign: 'right' }}>
          {pred?.current_utilization?.toFixed(0) ?? '—'}%
        </div>
        <div style={{ color: 'var(--text-secondary)' }}>Expected Wait</div>
        <div style={{ color: 'var(--text-primary)', textAlign: 'right' }}>
          {pred?.expected_wait_hours?.toFixed(1) ?? '—'}h
        </div>
        <div style={{ color: 'var(--text-secondary)' }}>Avail. Cranes</div>
        <div style={{ color: 'var(--text-primary)', textAlign: 'right' }}>
          {pred?.available_cranes ?? '—'}
        </div>
        <div style={{ color: 'var(--text-secondary)' }}>Vessels</div>
        <div style={{ color: 'var(--text-primary)', textAlign: 'right' }}>
          {pred?.assigned_vessels?.length ?? 0}
        </div>
      </div>

      {risk >= 75 && (
        <div style={{
          marginTop: 10, padding: '8px 10px', background: 'rgba(255,59,92,0.1)',
          border: '1px solid rgba(255,59,92,0.3)', borderRadius: 6, fontSize: 12, color: '#ff3b5c'
        }}>
          ⚠ Critical congestion — immediate intervention required
        </div>
      )}
    </div>
  )
}

/* ─── Yard Tooltip ───────────────────────────────────────────────── */
function YardTooltip({ zone, onClose }) {
  if (!zone) return null
  const util = (zone.utilization * 100).toFixed(0)
  const pred24 = (zone.predicted_24h * 100).toFixed(0)
  return (
    <div style={{
      position: 'absolute', bottom: 20, right: 20, zIndex: 100,
      background: 'var(--bg-card)', border: '1px solid var(--border-light)',
      borderRadius: 10, padding: 16, width: 230,
      boxShadow: 'var(--shadow-lg)'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
        <strong style={{ color: 'var(--text-primary)', fontSize: 14 }}>
          {zone.yard_id} Yard
        </strong>
        <button onClick={onClose} style={{
          background: 'none', border: 'none', color: 'var(--text-secondary)',
          cursor: 'pointer', fontSize: 15, lineHeight: 1
        }}>✕</button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5px 10px', fontSize: 12 }}>
        <div style={{ color: 'var(--text-secondary)' }}>Type</div>
        <div style={{ color: 'var(--text-primary)', textAlign: 'right', textTransform: 'capitalize' }}>{zone.zone_type}</div>
        <div style={{ color: 'var(--text-secondary)' }}>Capacity</div>
        <div style={{ color: 'var(--text-primary)', textAlign: 'right' }}>{zone.capacity?.toLocaleString()}</div>
        <div style={{ color: 'var(--text-secondary)' }}>Occupancy</div>
        <div style={{ color: 'var(--text-primary)', textAlign: 'right' }}>{zone.current_occupancy?.toLocaleString()}</div>
        <div style={{ color: 'var(--text-secondary)' }}>Current</div>
        <div style={{ color: getRiskColor(+util * 0.8), textAlign: 'right', fontWeight: 700 }}>{util}%</div>
        <div style={{ color: 'var(--text-secondary)' }}>24h Forecast</div>
        <div style={{ color: getRiskColor(+pred24 * 0.9), textAlign: 'right', fontWeight: 700 }}>{pred24}%</div>
      </div>
    </div>
  )
}

/* ─── Main Page ──────────────────────────────────────────────────── */
export default function PortMap() {
  const { congestion, yard, cranes, loading } = useApp()
  const [selectedBerth, setSelectedBerth] = useState(null)
  const [selectedYard, setSelectedYard] = useState(null)

  const predictions = congestion?.predictions || []
  const yardZones = yard?.zones || []
  const craneList = cranes || []

  // Build lookup maps
  const predMap = {}
  predictions.forEach(p => { predMap[p.berth_id] = p })

  const yardMap = {}
  yardZones.forEach(y => { yardMap[y.yard_id] = y })

  const craneCounts = {}
  craneList.forEach(c => {
    craneCounts[c.berth_id] = (craneCounts[c.berth_id] || 0) + 1
  })

  const selectedPred = selectedBerth ? predMap[selectedBerth.id] : null
  const selectedZone = selectedYard ? yardMap[selectedYard.id] : null

  // Add extra berth rows for simulations with > 8 berths
  const extraBerths = predictions
    .map(p => p.berth_id)
    .filter(bid => !BERTH_LAYOUT.find(b => b.id === bid))
    .map((bid, i) => ({
      id: bid,
      x: 120 + (i % 2 === 0 ? 0 : 220),
      y: 420 + Math.floor(i / 2) * 60,
      w: 100, h: 44
    }))

  const allBerths = [...BERTH_LAYOUT, ...extraBerths]
  const svgHeight = 480 + Math.ceil(extraBerths.length / 2) * 60

  return (
    <div style={{ padding: 24 }}>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ color: 'var(--text-primary)', marginBottom: 4 }}>⚓ Port Schematic Map</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
          Interactive port visualization — click any berth or yard zone for details.
          <span style={{
            marginLeft: 12, padding: '2px 8px', background: 'rgba(43,127,255,0.1)',
            border: '1px solid rgba(43,127,255,0.3)', borderRadius: 4, fontSize: 11
          }}>
            ⚡ Simulated Layout
          </span>
        </p>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
        {[
          { color: '#00d97e', label: 'Low (< 30%)' },
          { color: '#ffc107', label: 'Medium (30–55%)' },
          { color: '#ff7b00', label: 'High (55–75%)' },
          { color: '#ff3b5c', label: 'Critical (≥ 75%)' },
        ].map(l => (
          <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
            <div style={{ width: 12, height: 12, borderRadius: 2, background: l.color }} />
            <span style={{ color: 'var(--text-secondary)' }}>{l.label}</span>
          </div>
        ))}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#00c4e8', border: '1px solid #1e2d4a' }} />
          <span style={{ color: 'var(--text-secondary)' }}>Crane</span>
        </div>
      </div>

      <div className="card" style={{ position: 'relative', overflow: 'hidden', padding: 0 }}>
        {/* Berth/Yard Tooltips */}
        {selectedBerth && (
          <BerthTooltip
            berth={selectedBerth}
            pred={selectedPred}
            onClose={() => setSelectedBerth(null)}
          />
        )}
        {selectedYard && !selectedBerth && (
          <YardTooltip
            zone={selectedZone}
            onClose={() => setSelectedYard(null)}
          />
        )}

        <svg
          viewBox={`0 0 800 ${svgHeight}`}
          style={{ width: '100%', height: 'auto', display: 'block' }}
          onClick={() => { setSelectedBerth(null); setSelectedYard(null) }}
        >
          {/* Water background */}
          <rect x="0" y="0" width="800" height={svgHeight} fill="#0a1628" />

          {/* Quay wall (left side) */}
          <rect x="100" y="140" width="16" height={svgHeight - 160} fill="#1e2d4a" rx="2" />

          {/* Quay wall (right side) */}
          <rect x="320" y="140" width="16" height={svgHeight - 160} fill="#1e2d4a" rx="2" />

          {/* Water area labels */}
          <text x="56" y={svgHeight / 2} textAnchor="middle" fill="#1e3a5a" fontSize="11"
            transform={`rotate(-90, 56, ${svgHeight / 2})`}
          >HARBOR APPROACH CHANNEL</text>

          {/* Title labels */}
          <text x="170" y="128" textAnchor="middle" fill="#4a5a7a" fontSize="11" letterSpacing="1">TERMINAL A</text>
          <text x="390" y="128" textAnchor="middle" fill="#4a5a7a" fontSize="11" letterSpacing="1">TERMINAL B</text>
          <text x="620" y="128" textAnchor="middle" fill="#4a5a7a" fontSize="11" letterSpacing="1">YARD ZONES</text>

          {/* ── Berths ── */}
          {allBerths.map(berth => {
            const pred = predMap[berth.id]
            const risk = pred?.congestion_risk ?? 0
            const color = getRiskColor(risk)
            const isSelected = selectedBerth?.id === berth.id
            const craneCount = craneCounts[berth.id] || 0
            const vessels = pred?.assigned_vessels || []

            return (
              <g key={berth.id}
                onClick={e => { e.stopPropagation(); setSelectedBerth(berth); setSelectedYard(null) }}
                style={{ cursor: 'pointer' }}
              >
                {/* Berth box */}
                <rect
                  x={berth.x} y={berth.y} width={berth.w} height={berth.h}
                  fill={`${color}18`}
                  stroke={isSelected ? '#fff' : color}
                  strokeWidth={isSelected ? 2 : 1.5}
                  rx="4"
                />
                {/* Risk fill indicator on left edge */}
                <rect
                  x={berth.x} y={berth.y}
                  width={5} height={berth.h}
                  fill={color} rx="4"
                />
                {/* Berth label */}
                <text x={berth.x + 14} y={berth.y + 15}
                  fill={color} fontSize="12" fontWeight="700"
                >{berth.id}</text>
                {/* Risk % */}
                <text x={berth.x + 14} y={berth.y + 30}
                  fill="#8a9bbf" fontSize="10"
                >{risk.toFixed(0)}% {getRiskLabel(risk)}</text>
                {/* Vessel dots */}
                {vessels.slice(0, 5).map((v, vi) => (
                  <circle key={vi}
                    cx={berth.x + berth.w - 12 - vi * 10}
                    cy={berth.y + berth.h / 2}
                    r={3.5}
                    fill="#2b7fff"
                    opacity={0.8}
                  />
                ))}
                {/* Cranes */}
                {Array.from({ length: Math.min(craneCount, 5) }).map((_, ci) => (
                  <g key={ci}>
                    <circle
                      cx={craneX(berth.x, berth.w, ci)}
                      cy={craneY(berth.y)}
                      r={4}
                      fill="#00c4e8"
                      stroke="#1e2d4a"
                      strokeWidth={1}
                    />
                    <line
                      x1={craneX(berth.x, berth.w, ci)}
                      y1={craneY(berth.y) - 4}
                      x2={craneX(berth.x, berth.w, ci)}
                      y2={berth.y + berth.h}
                      stroke="#00c4e8"
                      strokeWidth={1}
                      opacity={0.5}
                    />
                  </g>
                ))}
              </g>
            )
          })}

          {/* ── Yard Zones ── */}
          {YARD_LAYOUT.map(zone => {
            const z = yardMap[zone.id]
            const util = z ? z.utilization * 100 : 60
            const color = getRiskColor(util * 0.85)
            const isSelected = selectedYard?.id === zone.id

            return (
              <g key={zone.id}
                onClick={e => { e.stopPropagation(); setSelectedYard(zone); setSelectedBerth(null) }}
                style={{ cursor: 'pointer' }}
              >
                <rect
                  x={zone.x} y={zone.y} width={zone.w} height={zone.h}
                  fill={`${color}12`}
                  stroke={isSelected ? '#fff' : color}
                  strokeWidth={isSelected ? 2 : 1}
                  rx="4"
                  strokeDasharray="4 2"
                />
                {/* Fill bar */}
                <rect
                  x={zone.x + 4} y={zone.y + zone.h - 10}
                  width={(zone.w - 8) * Math.min(util / 100, 1)}
                  height={5}
                  fill={color} rx="2"
                />
                <rect
                  x={zone.x + 4} y={zone.y + zone.h - 10}
                  width={zone.w - 8} height={5}
                  fill="none" stroke={color} strokeWidth={1} rx="2" opacity={0.3}
                />
                <text x={zone.x + zone.w / 2} y={zone.y + 18}
                  textAnchor="middle" fill={color} fontSize="10" fontWeight="700"
                >{zone.id.replace('Y-', '')}</text>
                <text x={zone.x + zone.w / 2} y={zone.y + 34}
                  textAnchor="middle" fill="#8a9bbf" fontSize="9"
                >{util.toFixed(0)}%</text>
                <text x={zone.x + zone.w / 2} y={zone.y + 48}
                  textAnchor="middle" fill="#4a5a7a" fontSize="9"
                >{z?.zone_type || 'general'}</text>
              </g>
            )
          })}

          {/* Vessels in harbor (waiting ships) */}
          {predictions
            .filter(p => p.congestion_risk >= 55)
            .slice(0, 4)
            .map((p, i) => (
              <g key={i}>
                <ellipse cx={50} cy={180 + i * 50} rx={18} ry={9}
                  fill="rgba(255,123,0,0.2)" stroke="#ff7b00" strokeWidth={1} />
                <text x={50} y={184 + i * 50} textAnchor="middle" fill="#ff7b00" fontSize="8">⚓</text>
              </g>
            ))
          }
          {predictions.filter(p => p.congestion_risk >= 55).length > 0 && (
            <text x={50} y={160} textAnchor="middle" fill="#4a5a7a" fontSize="9">
              WAITING
            </text>
          )}

          {/* ── Compass rose ── */}
          <g transform="translate(740, 60)">
            <circle cx={0} cy={0} r={18} fill="none" stroke="#1e2d4a" strokeWidth={1} />
            <text x={0} y={-20} textAnchor="middle" fill="#4a5a7a" fontSize="9">N</text>
            <line x1={0} y1={-15} x2={0} y2={-2} stroke="#4a5a7a" strokeWidth={1} />
            <polygon points="0,-15 -3,-5 3,-5" fill="#4a5a7a" />
          </g>

          {/* Scale bar */}
          <g transform="translate(600, 430)">
            <line x1={0} y1={0} x2={80} y2={0} stroke="#1e2d4a" strokeWidth={2} />
            <line x1={0} y1={-4} x2={0} y2={4} stroke="#1e2d4a" strokeWidth={1.5} />
            <line x1={80} y1={-4} x2={80} y2={4} stroke="#1e2d4a" strokeWidth={1.5} />
            <text x={40} y={14} textAnchor="middle" fill="#4a5a7a" fontSize="9">500m (schematic)</text>
          </g>

          {/* Simulated label watermark */}
          <text x={400} y={svgHeight - 10} textAnchor="middle" fill="#1e2d4a" fontSize="9">
            ⚡ SIMULATED PORT LAYOUT — Data from PortFlow AI Demo Dataset
          </text>
        </svg>
      </div>

      {/* Stats row below map */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 12, marginTop: 16 }}>
        {predictions.map(p => (
          <div key={p.berth_id} className="card" style={{ padding: '12px 16px', cursor: 'pointer' }}
            onClick={() => setSelectedBerth(allBerths.find(b => b.id === p.berth_id) || { id: p.berth_id, x: 0, y: 0 })}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <strong style={{ color: 'var(--text-primary)' }}>{p.berth_id}</strong>
              <span className={`risk-badge risk-${getRiskLabel(p.congestion_risk).toLowerCase()}`}>
                {getRiskLabel(p.congestion_risk)}
              </span>
            </div>
            <div style={{ height: 4, background: 'var(--border)', borderRadius: 2, marginBottom: 4 }}>
              <div style={{
                width: `${p.congestion_risk}%`, height: '100%',
                background: getRiskColor(p.congestion_risk), borderRadius: 2
              }} />
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'flex', justifyContent: 'space-between' }}>
              <span>{p.congestion_risk.toFixed(0)}% risk</span>
              <span>{p.expected_wait_hours?.toFixed(1)}h wait</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
