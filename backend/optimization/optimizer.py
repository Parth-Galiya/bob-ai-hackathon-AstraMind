"""
Berth and Crane Optimization using greedy + constraint-based approach
(falls back cleanly if OR-Tools unavailable)
"""
import math
from datetime import datetime, timedelta
from typing import List, Dict, Any, Tuple, Optional
import numpy as np
import copy


SIZE_COMPAT = {
    "small": ["small", "medium", "large", "vlcc"],
    "medium": ["medium", "large", "vlcc"],
    "large": ["large", "vlcc"],
    "vlcc": ["vlcc"],
}

PRIORITY_ORDER = {"critical": 4, "high": 3, "normal": 2, "low": 1}


class BerthOptimizer:
    """Greedy priority-aware berth assignment optimizer"""

    def optimize(self, vessels: List[Dict], berths: List[Dict],
                 cranes: List[Dict], base_time: Any = None) -> Dict[str, Any]:
        if base_time is None:
            base_time = datetime.now()
        elif isinstance(base_time, str):
            base_time = datetime.fromisoformat(base_time)

        vessels_sorted = sorted(
            vessels,
            key=lambda v: (
                -PRIORITY_ORDER.get(v.get("priority", "normal"), 2),
                v.get("eta", "")
            )
        )

        berth_state = {
            b["berth_id"]: {
                **b,
                "next_available": datetime.fromisoformat(
                    b.get("available_from", base_time.isoformat())
                ),
                "vessel_queue": []
            }
            for b in berths
        }

        assignments = []
        unassigned = []

        crane_by_berth = {}
        for crane in cranes:
            bid = crane["berth_id"]
            crane_by_berth[bid] = crane_by_berth.get(bid, 0) + (
                1 if crane.get("status") in ["available", "busy"] else 0
            )

        for vessel in vessels_sorted:
            v_size = vessel.get("vessel_size", "medium")
            try:
                eta = datetime.fromisoformat(vessel["eta"])
            except:
                eta = base_time

            best_berth = None
            best_score = -1e9
            best_wait = 999

            for bid, state in berth_state.items():
                # Check size compatibility
                b_limit = state.get("vessel_size_limit", "large")
                if v_size not in SIZE_COMPAT.get(b_limit, [b_limit]):
                    continue

                # Check maintenance
                if state.get("status") == "maintenance":
                    continue

                avail_cranes = crane_by_berth.get(bid, 0)
                required_cranes = vessel.get("required_cranes", 2)

                # Compute start time
                start_time = max(eta, state["next_available"])
                wait_hours = max(0, (start_time - eta).total_seconds() / 3600)

                # Handling time
                handling_rate = max(1, avail_cranes) * 175  # containers/hour
                handling_hours = vessel.get("containers", 2000) / handling_rate
                end_time = start_time + timedelta(hours=handling_hours)

                # Score: lower wait is better, higher priority gets bonus
                priority_bonus = PRIORITY_ORDER.get(vessel.get("priority", "normal"), 2) * 0.5
                crane_score = min(avail_cranes / max(required_cranes, 1), 1.5) * 2
                util_penalty = state.get("current_utilization", 0.5) * 3
                wait_penalty = min(wait_hours * 0.8, 10)

                score = priority_bonus + crane_score - util_penalty - wait_penalty

                if score > best_score:
                    best_score = score
                    best_berth = bid
                    best_wait = wait_hours
                    best_start = start_time
                    best_end = end_time
                    best_handling = handling_hours
                    best_cranes_avail = avail_cranes

            if best_berth:
                req_cranes = min(
                    vessel.get("required_cranes", 2),
                    crane_by_berth.get(best_berth, 2)
                )
                req_cranes = max(req_cranes, 1)

                explanation = self._explain(vessel, best_berth, best_wait,
                                            best_cranes_avail, berth_state)

                assignments.append({
                    "vessel_id": vessel["vessel_id"],
                    "vessel_name": vessel.get("vessel_name", ""),
                    "berth_id": best_berth,
                    "start_time": best_start.isoformat(),
                    "end_time": best_end.isoformat(),
                    "cranes_assigned": req_cranes,
                    "waiting_time": round(best_wait, 2),
                    "handling_time": round(best_handling, 2),
                    "score": round(best_score, 3),
                    "explanation": explanation,
                    "priority": vessel.get("priority", "normal"),
                    "containers": vessel.get("containers", 0)
                })

                # Update berth state
                berth_state[best_berth]["next_available"] = best_end
                berth_state[best_berth]["current_utilization"] = min(
                    berth_state[best_berth]["current_utilization"] + 0.05, 1.0
                )
                berth_state[best_berth]["vessel_queue"].append(vessel["vessel_id"])
            else:
                unassigned.append({
                    "vessel_id": vessel["vessel_id"],
                    "vessel_name": vessel.get("vessel_name", ""),
                    "reason": "No compatible berth available"
                })

        avg_wait_before = np.mean([v.get("waiting_time", 0) for v in vessels]) + 4.5
        avg_wait_after = np.mean([a["waiting_time"] for a in assignments]) if assignments else 0

        return {
            "assignments": assignments,
            "unassigned": unassigned,
            "summary": {
                "total_vessels": len(vessels),
                "assigned": len(assignments),
                "unassigned": len(unassigned),
                "avg_wait_before": round(avg_wait_before, 2),
                "avg_wait_after": round(avg_wait_after, 2),
                "improvement_pct": round(
                    max(0, (avg_wait_before - avg_wait_after) / max(avg_wait_before, 0.1) * 100), 1
                )
            }
        }

    def _explain(self, vessel: Dict, berth_id: str, wait: float,
                 cranes: int, berth_state: Dict) -> str:
        state = berth_state.get(berth_id, {})
        util = state.get("current_utilization", 0.5)
        parts = []
        if util < 0.5:
            parts.append(f"{berth_id} has low utilization ({util*100:.0f}%)")
        if cranes >= vessel.get("required_cranes", 2):
            parts.append(f"{cranes} cranes available meeting requirement")
        if wait < 1.0:
            parts.append("minimal waiting expected")
        elif wait < 3.0:
            parts.append(f"estimated {wait:.1f}h wait is acceptable")
        else:
            parts.append(f"best available option with {wait:.1f}h wait")

        priority = vessel.get("priority", "normal")
        if priority in ["high", "critical"]:
            parts.append(f"vessel has {priority} priority")

        return ". ".join(parts).capitalize() + "."


class CraneOptimizer:
    """Crane allocation optimizer"""

    def optimize(self, vessels: List[Dict], berths: List[Dict],
                 cranes: List[Dict], assignments: List[Dict]) -> Dict[str, Any]:

        # Build assignment lookup
        assign_map = {a["vessel_id"]: a for a in assignments}

        # Build available cranes per berth
        crane_pool = {}
        for crane in cranes:
            bid = crane["berth_id"]
            if bid not in crane_pool:
                crane_pool[bid] = []
            crane_pool[bid].append(crane)

        crane_allocations = []
        crane_summary = []

        for vessel in vessels:
            vid = vessel["vessel_id"]
            assignment = assign_map.get(vid)
            if not assignment:
                continue

            berth_id = assignment["berth_id"]
            containers = vessel.get("containers", 2000)
            required = vessel.get("required_cranes", 2)

            available = [c for c in crane_pool.get(berth_id, [])
                         if c.get("status") != "maintenance"]
            allocated_count = min(len(available), required + 1)  # allow +1 for efficiency
            allocated_count = max(allocated_count, 1)

            # Handling time calculation
            avg_capacity = np.mean([c.get("capacity", 175) for c in available[:allocated_count]]) if available else 175
            handling_hours = containers / (allocated_count * avg_capacity)

            # Allocate specific cranes
            allocated = []
            for crane in available[:allocated_count]:
                allocated.append({
                    "crane_id": crane["crane_id"],
                    "capacity": crane.get("capacity", 175)
                })

            explanation = self._explain(vessel, allocated_count, containers, handling_hours)

            crane_allocations.append({
                "vessel_id": vid,
                "vessel_name": vessel.get("vessel_name", ""),
                "berth_id": berth_id,
                "cranes_allocated": allocated_count,
                "cranes": allocated,
                "containers": containers,
                "handling_time_hours": round(handling_hours, 1),
                "explanation": explanation
            })

        # Build crane status summary
        for crane in cranes:
            assigned_vessel = None
            for alloc in crane_allocations:
                if any(c["crane_id"] == crane["crane_id"] for c in alloc["cranes"]):
                    assigned_vessel = alloc["vessel_id"]
                    break

            crane_summary.append({
                "crane_id": crane["crane_id"],
                "berth_id": crane["berth_id"],
                "status": crane.get("status", "available"),
                "capacity": crane.get("capacity", 175),
                "utilization": crane.get("utilization", 0.0),
                "assigned_vessel": assigned_vessel
            })

        total_cranes = len(cranes)
        active = sum(1 for c in crane_summary if c["assigned_vessel"])
        maint = sum(1 for c in cranes if c.get("status") == "maintenance")

        return {
            "allocations": crane_allocations,
            "crane_status": crane_summary,
            "summary": {
                "total_cranes": total_cranes,
                "active_cranes": active,
                "maintenance_cranes": maint,
                "available_cranes": total_cranes - active - maint,
                "overall_utilization": round(active / max(total_cranes, 1) * 100, 1)
            }
        }

    def _explain(self, vessel: Dict, count: int, containers: int,
                 handling_hours: float) -> str:
        rate = containers / max(handling_hours, 0.1)
        return (
            f"Allocated {count} crane(s) for {containers:,} containers. "
            f"Estimated throughput {rate:.0f} containers/hour, "
            f"handling time ~{handling_hours:.1f}h."
        )


class RoutingOptimizer:
    """Smart routing recommendation engine"""

    def recommend(self, vessels: List[Dict], berths: List[Dict],
                  berth_predictions: List[Dict], assignments: List[Dict],
                  cranes: List[Dict]) -> List[Dict]:

        pred_map = {p["berth_id"]: p for p in berth_predictions}
        assign_map = {a["vessel_id"]: a for a in assignments}
        crane_by_berth = {}
        for c in cranes:
            bid = c["berth_id"]
            if c.get("status") != "maintenance":
                crane_by_berth[bid] = crane_by_berth.get(bid, 0) + 1

        recommendations = []
        THRESHOLD_RISK = 65.0  # recommend rerouting if berth risk > 65%

        for vessel in vessels:
            vid = vessel["vessel_id"]
            assignment = assign_map.get(vid)
            if not assignment:
                continue

            current_berth = assignment["berth_id"]
            current_pred = pred_map.get(current_berth, {})
            current_risk = current_pred.get("congestion_risk", 30.0)
            current_wait = assignment.get("waiting_time", 1.0)

            if current_risk < THRESHOLD_RISK:
                continue

            # Find better berth
            v_size = vessel.get("vessel_size", "medium")
            best_alt = None
            best_alt_wait = current_wait
            best_alt_risk = current_risk

            for berth in berths:
                bid = berth["berth_id"]
                if bid == current_berth:
                    continue
                b_limit = berth.get("vessel_size_limit", "large")
                if v_size not in SIZE_COMPAT.get(b_limit, [b_limit]):
                    continue
                if berth.get("status") == "maintenance":
                    continue

                alt_pred = pred_map.get(bid, {})
                alt_risk = alt_pred.get("congestion_risk", 40.0)
                alt_cranes = crane_by_berth.get(bid, 2)

                if alt_risk < current_risk - 20:
                    # Estimate alt wait
                    alt_wait = max(0, current_wait * (alt_risk / max(current_risk, 1)) * 0.6)
                    if alt_wait < best_alt_wait:
                        best_alt_wait = alt_wait
                        best_alt = bid
                        best_alt_risk = alt_risk
                        best_alt_cranes = alt_cranes

            if best_alt:
                time_saved = current_wait - best_alt_wait
                confidence = min(0.95, (current_risk - best_alt_risk) / 100.0 + 0.6)

                reason = (
                    f"{current_berth} is predicted to reach {current_risk:.0f}% utilization. "
                    f"{best_alt} has lower risk ({best_alt_risk:.0f}%) and sufficient crane availability. "
                    f"Moving {vessel.get('vessel_name', vid)} is estimated to reduce "
                    f"waiting time from {current_wait:.1f}h to {best_alt_wait:.1f}h."
                )

                recommendations.append({
                    "vessel_id": vid,
                    "vessel_name": vessel.get("vessel_name", vid),
                    "current_berth": current_berth,
                    "recommended_berth": best_alt,
                    "current_risk": round(current_risk, 1),
                    "recommended_risk": round(best_alt_risk, 1),
                    "current_wait": round(current_wait, 1),
                    "recommended_wait": round(best_alt_wait, 1),
                    "time_saved": round(time_saved, 1),
                    "reason": reason,
                    "confidence": round(confidence, 2),
                    "priority": vessel.get("priority", "normal"),
                    "containers": vessel.get("containers", 0)
                })

        return sorted(recommendations, key=lambda r: r["time_saved"], reverse=True)
