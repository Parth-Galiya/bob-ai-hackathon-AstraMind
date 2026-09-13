import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { portflowApi } from '../services/api'

const AppContext = createContext(null)

export function AppProvider({ children }) {
  const [dashboard, setDashboard] = useState(null)
  const [vessels, setVessels] = useState([])
  const [berths, setBerths] = useState([])
  const [cranes, setCranes] = useState([])
  const [yard, setYard] = useState(null)
  const [congestion, setCongestion] = useState(null)
  const [berthOpt, setBerthOpt] = useState(null)
  const [craneOpt, setCraneOpt] = useState(null)
  const [routing, setRouting] = useState(null)
  const [plan72h, setPlan72h] = useState(null)
  const [alerts, setAlerts] = useState([])
  const [beforeAfter, setBeforeAfter] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [lastUpdated, setLastUpdated] = useState(null)
  const [simTime, setSimTime] = useState(new Date())

  const loadAll = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [
        dashData,
        vesselData,
        berthData,
        craneData,
        yardData,
        congData,
        berthOptData,
        craneOptData,
        routingData,
        planData,
        alertData,
        baData
      ] = await Promise.all([
        portflowApi.getDashboard(),
        portflowApi.getVessels(),
        portflowApi.getBerths(),
        portflowApi.getCranes(),
        portflowApi.getYard(),
        portflowApi.getCongestion(),
        portflowApi.getBerthOptimization(),
        portflowApi.getCraneOptimization(),
        portflowApi.getRouting(),
        portflowApi.get72hPlan(),
        portflowApi.getAlerts(),
        portflowApi.getBeforeAfter(),
      ])

      setDashboard(dashData)
      setVessels(vesselData?.vessels || [])
      setBerths(berthData?.berths || [])
      setCranes(craneData?.cranes || [])
      setYard(yardData)
      setCongestion(congData)
      setBerthOpt(berthOptData)
      setCraneOpt(craneOptData)
      setRouting(routingData)
      setPlan72h(planData)
      setAlerts(alertData?.alerts || [])
      setBeforeAfter(baData)
      setLastUpdated(new Date())
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  const runSimulation = useCallback(async (config) => {
    setLoading(true)
    setError(null)
    try {
      await portflowApi.runSimulation(config)
      await loadAll()
      return true
    } catch (e) {
      setError(e.message)
      return false
    } finally {
      setLoading(false)
    }
  }, [loadAll])

  const acknowledgeAlert = useCallback(async (id) => {
    try {
      await portflowApi.acknowledgeAlert(id)
      setAlerts(prev => prev.map(a => a.alert_id === id ? { ...a, acknowledged: true } : a))
    } catch (e) {}
  }, [])

  // Tick sim time
  useEffect(() => {
    const t = setInterval(() => setSimTime(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  // Load on mount
  useEffect(() => { loadAll() }, [loadAll])

  const criticalAlerts = alerts.filter(a => !a.acknowledged && a.level === 'critical')

  return (
    <AppContext.Provider value={{
      dashboard, vessels, berths, cranes, yard, congestion,
      berthOpt, craneOpt, routing, plan72h, alerts,
      beforeAfter, loading, error, lastUpdated, simTime,
      criticalAlerts,
      loadAll, runSimulation, acknowledgeAlert,
      setVessels, setBerths, setCranes, setAlerts
    }}>
      {children}
    </AppContext.Provider>
  )
}

export const useApp = () => {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be inside AppProvider')
  return ctx
}

export default AppContext
