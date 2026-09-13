import React, { useState, useRef, useEffect } from 'react'
import { useApp } from '../context/AppContext'
import { portflowApi } from '../services/api'

const SUGGESTED_QUESTIONS = [
  'Why is Berth B3 congested?',
  'Which vessel should be rerouted?',
  'What are the critical risks in the next 24 hours?',
  'How can we reduce waiting time?',
  'Explain today\'s 72-hour plan',
  'Which berth has the most available capacity?',
  'What is the yard capacity situation?',
]

function Message({ msg }) {
  if (msg.type === 'user') {
    return (
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <div className="msg-user">{msg.text}</div>
      </div>
    )
  }
  if (msg.type === 'typing') {
    return (
      <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
        <div className="msg-ai">
          <div className="msg-ai-typing">
            <span /><span /><span />
          </div>
        </div>
      </div>
    )
  }
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-start', gap: 8 }}>
      <div style={{
        width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
        background: 'linear-gradient(135deg, var(--accent-blue), var(--accent-cyan))',
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14
      }}>🤖</div>
      <div className="msg-ai">
        <div>{msg.text}</div>
        {msg.timestamp && (
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>
            {msg.timestamp}
          </div>
        )}
      </div>
    </div>
  )
}

export default function Copilot() {
  const { dashboard } = useApp()
  const [messages, setMessages] = useState([
    {
      type: 'ai',
      text: "Hello, I'm PortFlow Copilot 🤖 — your AI port operations assistant. I can answer questions about vessel assignments, berth congestion, crane allocation, yard capacity, and the 72-hour operations plan. Ask me anything about current port conditions.",
      timestamp: new Date().toLocaleTimeString()
    }
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = async (text) => {
    if (!text.trim() || loading) return
    const q = text.trim()
    setInput('')

    setMessages(prev => [...prev, { type: 'user', text: q }])
    setMessages(prev => [...prev, { type: 'typing' }])
    setLoading(true)

    try {
      const result = await portflowApi.queryCopilot(q)
      setMessages(prev => [
        ...prev.filter(m => m.type !== 'typing'),
        { type: 'ai', text: result.answer, timestamp: result.timestamp }
      ])
    } catch (e) {
      setMessages(prev => [
        ...prev.filter(m => m.type !== 'typing'),
        { type: 'ai', text: `Sorry, I encountered an error: ${e.message}`, timestamp: new Date().toLocaleTimeString() }
      ])
    } finally {
      setLoading(false)
      inputRef.current?.focus()
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  const kpis = dashboard?.kpis || {}

  return (
    <div style={{ padding: 24 }}>
      <div className="page-header">
        <div className="page-title">🤖 PortFlow Copilot</div>
        <div className="page-subtitle">AI-powered operations assistant — ask anything about current port conditions</div>
      </div>

      <div className="grid-2">
        {/* Chat */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', minHeight: 520 }}>
          <div className="card-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{
                width: 10, height: 10, borderRadius: '50%',
                background: 'var(--accent-green)', animation: 'pulse 2s infinite'
              }} />
              <div className="card-title">PortFlow Copilot</div>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Context-aware AI</div>
          </div>

          {/* Messages */}
          <div className="copilot-messages" style={{ flex: 1 }}>
            {messages.map((msg, i) => (
              <Message key={i} msg={msg} />
            ))}
            <div ref={bottomRef} />
          </div>

          {/* Suggestions */}
          <div className="suggestion-chips">
            {SUGGESTED_QUESTIONS.slice(0, 4).map(q => (
              <button key={q} className="chip" onClick={() => sendMessage(q)}>
                {q}
              </button>
            ))}
          </div>

          {/* Input */}
          <div className="copilot-input-area">
            <input
              ref={inputRef}
              type="text"
              placeholder="Ask about berths, vessels, cranes, yard, or the 72h plan…"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={loading}
            />
            <button
              className="btn btn-primary btn-sm"
              onClick={() => sendMessage(input)}
              disabled={loading || !input.trim()}
            >
              {loading ? '⏳' : 'Send'}
            </button>
          </div>
        </div>

        {/* Context Panel */}
        <div>
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-header">
              <div className="card-title">📊 Live Context</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Data powering Copilot</div>
            </div>
            <div className="stat-row">
              <span className="stat-label">Total Vessels</span>
              <span className="stat-value">{kpis.total_vessels || 0}</span>
            </div>
            <div className="stat-row">
              <span className="stat-label">Avg Wait Time</span>
              <span className="stat-value">{kpis.avg_waiting_time?.toFixed(1) || 0}h</span>
            </div>
            <div className="stat-row">
              <span className="stat-label">Critical Berths</span>
              <span className="stat-value" style={{ color: kpis.critical_berths > 0 ? 'var(--accent-red)' : 'inherit' }}>
                {kpis.critical_berths || 0}
              </span>
            </div>
            <div className="stat-row">
              <span className="stat-label">Yard Utilization</span>
              <span className="stat-value">{kpis.yard_utilization?.toFixed(1) || 0}%</span>
            </div>
            <div className="stat-row">
              <span className="stat-label">Crane Utilization</span>
              <span className="stat-value">{kpis.crane_utilization?.toFixed(1) || 0}%</span>
            </div>
            <div className="stat-row">
              <span className="stat-label">Congestion Risk</span>
              <span className="stat-value" style={{ color: (kpis.congestion_risk_score || 0) > 60 ? 'var(--accent-orange)' : 'inherit' }}>
                {kpis.congestion_risk_score?.toFixed(0) || 0}%
              </span>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <div className="card-title">💡 Sample Questions</div>
            </div>
            {SUGGESTED_QUESTIONS.map(q => (
              <button
                key={q}
                style={{
                  display: 'block', width: '100%', textAlign: 'left',
                  padding: '8px 0', background: 'none', border: 'none',
                  borderBottom: '1px solid var(--border)', color: 'var(--text-secondary)',
                  fontSize: 13, cursor: 'pointer', transition: 'color 0.15s'
                }}
                onClick={() => sendMessage(q)}
                onMouseEnter={e => e.target.style.color = 'var(--accent-cyan)'}
                onMouseLeave={e => e.target.style.color = 'var(--text-secondary)'}
              >
                → {q}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
