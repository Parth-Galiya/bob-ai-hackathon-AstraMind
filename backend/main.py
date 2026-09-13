"""
PortFlow AI – FastAPI Backend
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from fastapi import FastAPI, HTTPException, UploadFile, File, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import json
import copy
import io
import csv
from datetime import datetime

from simulation.engine import SimulationEngine
from ml.predictor import CongestionPredictor
from optimization.optimizer import BerthOptimizer, CraneOptimizer, RoutingOptimizer
from services.port_service import PortOperationsService

app = FastAPI(
    title="PortFlow AI API",
    description="Container Congestion Predictor & Port Operations Optimiser",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Global State ──────────────────────────────────────────────────────────────
_state: Dict[str, Any] = {
    "vessels": [],
    "berths": [],
    "cranes": [],
    "yard_zones": [],
    "berth_predictions": [],
    "assignments": [],
    "crane_allocations": [],
    "routing_recommendations": [],
    "alerts": [],
    "plan_72h": [],
    "kpis": {},
    "before_after": {},
    "config": {},
    "initialized": False
}

# ── Services ──────────────────────────────────────────────────────────────────
predictor = CongestionPredictor()
berth_optimizer = BerthOptimizer()
crane_optimizer = CraneOptimizer()
routing_optimizer = RoutingOptimizer()
port_service = PortOperationsService()


def _run_full_pipeline(
    vessels, berths, cranes, yard_zones,
    base_time=None
):
    """Run the complete AI/optimization pipeline"""
    if base_time is None:
        base_time = datetime.now()

    # 1. Predict congestion
    berth_predictions = predictor.predict(vessels, berths, cranes, yard_zones, base_time)

    # 2. Annotate vessel risks
    vessels_with_risk = predictor.predict_vessel_risks(vessels, berths, berth_predictions)

    # 3. Optimize berths
    berth_result = berth_optimizer.optimize(vessels_with_risk, berths, cranes, base_time)
    assignments = berth_result["assignments"]

    # 4. Optimize cranes
    crane_result = crane_optimizer.optimize(vessels_with_risk, berths, cranes, assignments)
    crane_allocations = crane_result["allocations"]
    crane_status = crane_result["crane_status"]

    # 5. Update crane status with allocations
    for crane in cranes:
        allocated_to = None
        for alloc in crane_allocations:
            if any(c["crane_id"] == crane["crane_id"] for c in alloc["cranes"]):
                allocated_to = alloc["vessel_id"]
                break
        crane["assigned_vessel"] = allocated_to
        if allocated_to:
            crane["status"] = "busy"
            crane["utilization"] = 0.75

    # 6. Routing recommendations
    routing_recommendations = routing_optimizer.recommend(
        vessels_with_risk, berths, berth_predictions, assignments, cranes
    )

    # 7. Apply routing recommendations to vessel assignments
    for rec in routing_recommendations[:3]:  # apply top 3
        for a in assignments:
            if a["vessel_id"] == rec["vessel_id"]:
                a["berth_id"] = rec["recommended_berth"]
                a["waiting_time"] = rec["recommended_wait"]
                break

    # 8. Update berth predictions with assignments
    for pred in berth_predictions:
        pred["assigned_vessels"] = [
            a["vessel_id"] for a in assignments if a["berth_id"] == pred["berth_id"]
        ]

    # 9. Generate alerts
    alerts = port_service.generate_alerts(berth_predictions, vessels_with_risk, yard_zones, cranes)

    # 10. KPIs
    kpis = port_service.calculate_kpis(
        vessels_with_risk, berths, cranes, yard_zones, berth_predictions, assignments
    )

    # 11. Before/After
    before_after = port_service.calculate_before_after(
        vessels_with_risk, berths, assignments, berth_predictions, cranes
    )

    # 12. 72h plan
    plan_72h = port_service.generate_72h_plan(
        vessels_with_risk, berths, assignments, crane_allocations, berth_predictions
    )

    return {
        "vessels": vessels_with_risk,
        "berths": berths,
        "cranes": cranes,
        "yard_zones": yard_zones,
        "berth_predictions": berth_predictions,
        "assignments": assignments,
        "crane_allocations": crane_allocations,
        "crane_status": crane_status,
        "routing_recommendations": routing_recommendations,
        "alerts": alerts,
        "kpis": kpis,
        "before_after": before_after,
        "plan_72h": plan_72h,
        "berth_opt_summary": berth_result["summary"],
        "crane_opt_summary": crane_result["summary"],
    }


def _load_demo_data():
    """Initialize with default demo dataset"""
    config = {
        "num_vessels": 50,
        "num_berths": 8,
        "num_cranes": 24,
        "duration_hours": 72,
        "seed": 42,
        "congestion_factor": 1.2
    }
    engine = SimulationEngine(config)
    raw = engine.run()
    result = _run_full_pipeline(
        raw["vessels"], raw["berths"], raw["cranes"], raw["yard_zones"]
    )
    _state.update(result)
    _state["config"] = raw["config"]
    _state["initialized"] = True


# Load demo data on startup
@app.on_event("startup")
async def startup_event():
    _load_demo_data()


# ── Health ────────────────────────────────────────────────────────────────────
@app.get("/api/health")
def health():
    return {"status": "ok", "version": "1.0.0", "initialized": _state["initialized"]}


# ── Dashboard ─────────────────────────────────────────────────────────────────
@app.get("/api/dashboard")
def get_dashboard():
    if not _state["initialized"]:
        _load_demo_data()
    return {
        "kpis": _state["kpis"],
        "before_after": _state["before_after"],
        "critical_berths": [
            p for p in _state["berth_predictions"]
            if p.get("congestion_risk", 0) >= 55
        ],
        "top_alerts": _state["alerts"][:5],
        "routing_summary": {
            "total_recommendations": len(_state["routing_recommendations"]),
            "top_recommendations": _state["routing_recommendations"][:3]
        },
        "yard_summary": {
            "zones": _state["yard_zones"],
            "total_capacity": sum(y["capacity"] for y in _state["yard_zones"]),
            "total_occupancy": sum(y["current_occupancy"] for y in _state["yard_zones"]),
        },
        "resource_utilization": {
            "crane_utilization": _state["kpis"].get("crane_utilization", 0),
            "yard_utilization": _state["kpis"].get("yard_utilization", 0),
            "berth_utilization": round(
                sum(b.get("current_utilization", 0) for b in _state["berths"])
                / max(len(_state["berths"]), 1) * 100, 1
            )
        }
    }


# ── Vessels ───────────────────────────────────────────────────────────────────
@app.get("/api/vessels")
def get_vessels(risk_filter: Optional[str] = None, status: Optional[str] = None):
    vessels = _state["vessels"]
    if risk_filter:
        vessels = [v for v in vessels if v.get("risk_level") == risk_filter]
    if status:
        vessels = [v for v in vessels if v.get("status") == status]
    return {
        "vessels": vessels,
        "total": len(vessels),
        "risk_distribution": {
            "critical": sum(1 for v in _state["vessels"] if v.get("risk_level") == "critical"),
            "high": sum(1 for v in _state["vessels"] if v.get("risk_level") == "high"),
            "medium": sum(1 for v in _state["vessels"] if v.get("risk_level") == "medium"),
            "low": sum(1 for v in _state["vessels"] if v.get("risk_level") == "low"),
        }
    }


# ── Berths ────────────────────────────────────────────────────────────────────
@app.get("/api/berths")
def get_berths():
    return {
        "berths": _state["berths"],
        "predictions": _state["berth_predictions"],
        "total": len(_state["berths"])
    }


# ── Cranes ────────────────────────────────────────────────────────────────────
@app.get("/api/cranes")
def get_cranes():
    return {
        "cranes": _state.get("crane_status", _state["cranes"]),
        "allocations": _state["crane_allocations"],
        "summary": _state.get("crane_opt_summary", {}),
        "total": len(_state["cranes"])
    }


# ── Yard ──────────────────────────────────────────────────────────────────────
@app.get("/api/yard")
def get_yard():
    zones = _state["yard_zones"]
    total_cap = sum(y["capacity"] for y in zones) or 1
    total_occ = sum(y["current_occupancy"] for y in zones)
    util = total_occ / total_cap * 100
    pred_24h = sum(y.get("predicted_24h", util/100) * y["capacity"] for y in zones) / total_cap * 100
    pred_48h = sum(y.get("predicted_48h", util/100) * y["capacity"] for y in zones) / total_cap * 100

    warnings = []
    if pred_24h > 90:
        warnings.append("⚠ Yard capacity expected to exceed 90% within 24 hours. Redirect containers immediately.")
    elif pred_24h > 85:
        warnings.append("⚠ Yard utilization rising above 85% in 24h — prioritize outbound movement.")

    recommendations = []
    if util > 85:
        recommendations.extend([
            "Redirect incoming containers to secondary yard zones",
            "Prioritize outbound container movement",
            "Adjust vessel arrival sequence to reduce simultaneous unloading",
        ])

    return {
        "zones": zones,
        "total_capacity": total_cap,
        "total_occupancy": total_occ,
        "utilization": round(util, 1),
        "predicted_24h": round(pred_24h, 1),
        "predicted_48h": round(pred_48h, 1),
        "available_capacity": total_cap - total_occ,
        "warnings": warnings,
        "recommendations": recommendations
    }


# ── Congestion Prediction ─────────────────────────────────────────────────────
@app.get("/api/congestion/predict")
def predict_congestion():
    return {
        "predictions": _state["berth_predictions"],
        "summary": {
            "critical": sum(1 for p in _state["berth_predictions"] if p.get("congestion_risk", 0) >= 75),
            "high": sum(1 for p in _state["berth_predictions"] if 55 <= p.get("congestion_risk", 0) < 75),
            "medium": sum(1 for p in _state["berth_predictions"] if 30 <= p.get("congestion_risk", 0) < 55),
            "low": sum(1 for p in _state["berth_predictions"] if p.get("congestion_risk", 0) < 30),
        }
    }


@app.post("/api/congestion/predict")
def run_congestion_prediction(body: Optional[Dict] = None):
    preds = predictor.predict(
        _state["vessels"], _state["berths"], _state["cranes"], _state["yard_zones"]
    )
    _state["berth_predictions"] = preds
    return {"predictions": preds, "ran_at": datetime.now().isoformat()}


# ── Optimization: Berths ──────────────────────────────────────────────────────
@app.get("/api/optimization/berths")
def get_berth_optimization():
    return {
        "assignments": _state["assignments"],
        "summary": _state.get("berth_opt_summary", {}),
        "total": len(_state["assignments"])
    }


@app.post("/api/optimization/berths")
def run_berth_optimization():
    result = berth_optimizer.optimize(
        _state["vessels"], _state["berths"], _state["cranes"]
    )
    _state["assignments"] = result["assignments"]
    _state["berth_opt_summary"] = result["summary"]
    return result


# ── Optimization: Cranes ─────────────────────────────────────────────────────
@app.get("/api/optimization/cranes")
def get_crane_optimization():
    return {
        "allocations": _state["crane_allocations"],
        "crane_status": _state.get("crane_status", _state["cranes"]),
        "summary": _state.get("crane_opt_summary", {}),
    }


@app.post("/api/optimization/cranes")
def run_crane_optimization():
    result = crane_optimizer.optimize(
        _state["vessels"], _state["berths"], _state["cranes"], _state["assignments"]
    )
    _state["crane_allocations"] = result["allocations"]
    _state["crane_opt_summary"] = result["summary"]
    return result


# ── Routing ───────────────────────────────────────────────────────────────────
@app.get("/api/routing/recommend")
def get_routing_recommendations():
    return {
        "recommendations": _state["routing_recommendations"],
        "total": len(_state["routing_recommendations"])
    }


@app.post("/api/routing/recommend")
def run_routing_recommendations():
    recs = routing_optimizer.recommend(
        _state["vessels"], _state["berths"],
        _state["berth_predictions"], _state["assignments"], _state["cranes"]
    )
    _state["routing_recommendations"] = recs
    return {"recommendations": recs, "total": len(recs)}


# ── 72-Hour Plan ──────────────────────────────────────────────────────────────
@app.get("/api/plan/72-hours")
def get_72h_plan():
    return {
        "plan": _state["plan_72h"],
        "total_blocks": len(_state["plan_72h"]),
        "total_events": sum(b.get("event_count", 0) for b in _state["plan_72h"])
    }


# ── Simulation ────────────────────────────────────────────────────────────────
class SimConfig(BaseModel):
    num_vessels: int = 50
    num_berths: int = 8
    num_cranes: int = 24
    duration_hours: int = 72
    seed: Optional[int] = None
    congestion_factor: float = 1.0


@app.post("/api/simulation/run")
def run_simulation(config: SimConfig):
    cfg = config.dict()
    engine = SimulationEngine(cfg)
    raw = engine.run()
    result = _run_full_pipeline(
        raw["vessels"], raw["berths"], raw["cranes"], raw["yard_zones"]
    )
    _state.update(result)
    _state["config"] = raw["config"]
    _state["initialized"] = True
    return {
        "message": "Simulation completed successfully",
        "config": cfg,
        "summary": {
            "vessels": len(_state["vessels"]),
            "berths": len(_state["berths"]),
            "cranes": len(_state["cranes"]),
            "yard_zones": len(_state["yard_zones"]),
            "critical_berths": _state["kpis"].get("critical_berths", 0),
            "avg_wait": _state["kpis"].get("avg_waiting_time", 0),
        }
    }


# ── Scenario / What-If ────────────────────────────────────────────────────────
class ScenarioRequest(BaseModel):
    name: str = "Custom Scenario"
    description: str = ""
    vessel_arrival_increase: float = 0.0
    cranes_unavailable: int = 0
    berths_unavailable: List[str] = []
    yard_capacity_decrease: float = 0.0
    early_arrival_vessel: Optional[str] = None
    early_arrival_hours: float = 0.0


@app.post("/api/scenario/run")
def run_scenario(scenario: ScenarioRequest):
    import copy
    from datetime import timedelta

    vessels = copy.deepcopy(_state["vessels"])
    berths = copy.deepcopy(_state["berths"])
    cranes = copy.deepcopy(_state["cranes"])
    yard_zones = copy.deepcopy(_state["yard_zones"])

    # Apply scenario modifications
    if scenario.vessel_arrival_increase > 0:
        import random
        existing_count = len(vessels)
        extras_count = int(existing_count * scenario.vessel_arrival_increase)
        extra_engine = SimulationEngine({
            "num_vessels": extras_count,
            "num_berths": len(berths),
            "num_cranes": len(cranes),
            "duration_hours": 72,
            "seed": 99
        })
        extra_vessels = extra_engine.generate_vessels()
        for ev in extra_vessels:
            ev["vessel_id"] = f"S{ev['vessel_id']}"
        vessels.extend(extra_vessels)

    if scenario.cranes_unavailable > 0:
        count = 0
        for crane in cranes:
            if crane.get("status") != "maintenance" and count < scenario.cranes_unavailable:
                crane["status"] = "maintenance"
                crane["utilization"] = 0
                count += 1

    for bid in scenario.berths_unavailable:
        for berth in berths:
            if berth["berth_id"] == bid:
                berth["status"] = "maintenance"

    if scenario.yard_capacity_decrease > 0:
        for zone in yard_zones:
            zone["capacity"] = int(zone["capacity"] * (1 - scenario.yard_capacity_decrease))
            zone["current_occupancy"] = min(zone["current_occupancy"], zone["capacity"])
            zone["utilization"] = zone["current_occupancy"] / max(zone["capacity"], 1)

    if scenario.early_arrival_vessel and scenario.early_arrival_hours > 0:
        for vessel in vessels:
            if vessel["vessel_id"] == scenario.early_arrival_vessel:
                eta_dt = datetime.fromisoformat(vessel["eta"])
                vessel["eta"] = (eta_dt - timedelta(hours=scenario.early_arrival_hours)).isoformat()
                break

    # Run full pipeline on modified data
    scenario_result = _run_full_pipeline(vessels, berths, cranes, yard_zones)

    # Compare with baseline
    baseline_kpis = _state["kpis"]
    scenario_kpis = scenario_result["kpis"]

    impact = {
        "wait_time_change": round(
            scenario_kpis.get("avg_waiting_time", 0) - baseline_kpis.get("avg_waiting_time", 0), 2
        ),
        "critical_berths_change": (
            scenario_kpis.get("critical_berths", 0) - baseline_kpis.get("critical_berths", 0)
        ),
        "yard_util_change": round(
            scenario_kpis.get("yard_utilization", 0) - baseline_kpis.get("yard_utilization", 0), 1
        ),
        "crane_util_change": round(
            scenario_kpis.get("crane_utilization", 0) - baseline_kpis.get("crane_utilization", 0), 1
        ),
        "vessel_count_change": len(vessels) - len(_state["vessels"])
    }

    # Mitigation recommendations
    mitigations = []
    if impact["wait_time_change"] > 1.5:
        mitigations.append("Activate priority boarding for critical vessels")
        mitigations.append("Consider staggered arrival windows")
    if impact["critical_berths_change"] > 0:
        mitigations.append("Reroute vessels from congested berths to alternates")
    if scenario.cranes_unavailable > 0:
        mitigations.append(f"Redistribute {scenario.cranes_unavailable} crane workload across remaining equipment")
    if scenario.yard_capacity_decrease > 0:
        mitigations.append("Prioritize container outbound movement to external yards")

    return {
        "scenario": scenario.dict(),
        "baseline_kpis": baseline_kpis,
        "scenario_kpis": scenario_kpis,
        "impact": impact,
        "mitigations": mitigations,
        "scenario_predictions": scenario_result["berth_predictions"],
        "scenario_assignments": scenario_result["assignments"],
        "scenario_routing": scenario_result["routing_recommendations"],
    }


# ── Alerts ────────────────────────────────────────────────────────────────────
@app.get("/api/alerts")
def get_alerts():
    return {
        "alerts": _state["alerts"],
        "total": len(_state["alerts"]),
        "unacknowledged": sum(1 for a in _state["alerts"] if not a.get("acknowledged"))
    }


@app.post("/api/alerts/{alert_id}/acknowledge")
def acknowledge_alert(alert_id: str):
    for alert in _state["alerts"]:
        if alert["alert_id"] == alert_id:
            alert["acknowledged"] = True
            return {"message": "Alert acknowledged", "alert_id": alert_id}
    raise HTTPException(status_code=404, detail="Alert not found")


# ── Data Management ───────────────────────────────────────────────────────────
@app.post("/api/data/upload")
async def upload_data(file: UploadFile = File(...)):
    try:
        content = await file.read()
        text = content.decode("utf-8")
        reader = csv.DictReader(io.StringIO(text))
        rows = list(reader)

        if not rows:
            raise HTTPException(status_code=400, detail="Empty CSV file")

        # Detect type
        headers = list(rows[0].keys())
        if "vessel_id" in headers:
            vessels = []
            for r in rows:
                vessels.append({
                    "vessel_id": r.get("vessel_id", f"V{len(vessels)+1}"),
                    "vessel_name": r.get("vessel_name", f"Vessel {len(vessels)+1}"),
                    "eta": r.get("eta", datetime.now().isoformat()),
                    "etd": r.get("etd", datetime.now().isoformat()),
                    "containers": int(r.get("containers", 2000)),
                    "vessel_size": r.get("vessel_size", "medium"),
                    "priority": r.get("priority", "normal"),
                    "destination": r.get("destination", "Unknown"),
                    "required_cranes": int(r.get("required_cranes", 2)),
                    "assigned_berth": r.get("assigned_berth") or None,
                    "status": r.get("status", "en_route"),
                    "waiting_time": float(r.get("waiting_time", 0)),
                    "congestion_risk": 0.0,
                    "risk_level": "low"
                })
            _state["vessels"] = vessels
            return {"message": f"Loaded {len(vessels)} vessels", "type": "vessels"}

        return {"message": "CSV uploaded but type not recognized", "headers": headers}

    except Exception as e:
        raise HTTPException(status_code=400, detail=f"CSV parsing error: {str(e)}")


@app.post("/api/data/reset")
def reset_data():
    _load_demo_data()
    return {"message": "Data reset to demo dataset", "vessels": len(_state["vessels"])}


@app.post("/api/data/generate")
def generate_data(config: SimConfig):
    cfg = config.dict()
    engine = SimulationEngine(cfg)
    raw = engine.run()
    result = _run_full_pipeline(
        raw["vessels"], raw["berths"], raw["cranes"], raw["yard_zones"]
    )
    _state.update(result)
    _state["config"] = raw["config"]
    return {
        "message": "Dataset generated",
        "vessels": len(raw["vessels"]),
        "berths": len(raw["berths"]),
        "cranes": len(raw["cranes"])
    }


# ── AI Copilot ────────────────────────────────────────────────────────────────
class CopilotRequest(BaseModel):
    question: str
    context: Optional[Dict] = None


@app.post("/api/copilot/query")
def copilot_query(request: CopilotRequest):
    if not request.question.strip():
        raise HTTPException(status_code=400, detail="Question cannot be empty")

    context_state = {
        "vessels": _state["vessels"],
        "berths": _state["berths"],
        "berth_predictions": _state["berth_predictions"],
        "assignments": _state["assignments"],
        "yard_zones": _state["yard_zones"],
        "routing_recommendations": _state["routing_recommendations"],
        "kpis": _state["kpis"]
    }

    result = port_service.answer_copilot(request.question, context_state)
    return result


# ── Before/After ─────────────────────────────────────────────────────────────
@app.get("/api/metrics/before-after")
def get_before_after():
    return _state.get("before_after", {})


# ── Config ────────────────────────────────────────────────────────────────────
@app.get("/api/config")
def get_config():
    return _state.get("config", {})


# ── Run ───────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
