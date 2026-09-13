"""
ML-based congestion prediction using Random Forest / Gradient Boosting
"""
import numpy as np
import pandas as pd
from datetime import datetime, timedelta
from typing import List, Dict, Any, Tuple
from sklearn.ensemble import RandomForestClassifier, GradientBoostingRegressor
from sklearn.preprocessing import LabelEncoder
import joblib
import os
import warnings
warnings.filterwarnings("ignore")

MODEL_PATH = os.path.join(os.path.dirname(__file__), "congestion_model.pkl")


class CongestionPredictor:
    def __init__(self):
        self.regressor = GradientBoostingRegressor(
            n_estimators=100, learning_rate=0.1, max_depth=4, random_state=42
        )
        self.is_trained = False

    def _build_features(self, vessels: List[Dict], berths: List[Dict],
                        cranes: List[Dict], yard_zones: List[Dict],
                        base_time: datetime) -> pd.DataFrame:
        """Build feature matrix for prediction"""
        records = []
        base_ts = base_time.timestamp() if isinstance(base_time, datetime) else \
            datetime.fromisoformat(str(base_time)).timestamp()

        # Aggregate crane availability per berth
        crane_by_berth = {}
        crane_util_by_berth = {}
        for crane in cranes:
            bid = crane["berth_id"]
            crane_by_berth[bid] = crane_by_berth.get(bid, 0) + (
                1 if crane.get("status") == "available" else 0
            )
            crane_util_by_berth[bid] = crane_util_by_berth.get(bid, [])
            crane_util_by_berth[bid].append(crane.get("utilization", 0))

        avg_crane_util = {
            bid: np.mean(vals) for bid, vals in crane_util_by_berth.items()
        }

        # Overall yard utilization
        total_cap = sum(y["capacity"] for y in yard_zones) or 1
        total_occ = sum(y["current_occupancy"] for y in yard_zones)
        yard_util = total_occ / total_cap

        for berth in berths:
            bid = berth["berth_id"]

            # Count vessels arriving soon (within 12h window)
            now_ts = base_ts
            window_12h = 12 * 3600
            window_24h = 24 * 3600

            arrivals_12h = 0
            arrivals_24h = 0
            containers_12h = 0
            priority_score = 0
            size_score = 0
            size_weights = {"small": 1, "medium": 2, "large": 3, "vlcc": 5}
            priority_weights = {"low": 0, "normal": 1, "high": 2, "critical": 4}

            for v in vessels:
                if v.get("assigned_berth") not in [None, bid]:
                    continue
                eta_str = v.get("eta", "")
                try:
                    eta_ts = datetime.fromisoformat(eta_str).timestamp()
                except:
                    continue
                diff = eta_ts - now_ts
                if 0 <= diff <= window_12h:
                    arrivals_12h += 1
                    containers_12h += v.get("containers", 0)
                    priority_score += priority_weights.get(v.get("priority", "normal"), 1)
                    size_score += size_weights.get(v.get("vessel_size", "medium"), 2)
                if 0 <= diff <= window_24h:
                    arrivals_24h += 1

            current_util = berth.get("current_utilization", 0.5)
            avail_cranes = crane_by_berth.get(bid, 0)
            avg_util = avg_crane_util.get(bid, 0.5)
            max_cranes = berth.get("crane_count", 3)

            features = {
                "berth_id": bid,
                "arrival_density_12h": arrivals_12h,
                "arrival_density_24h": arrivals_24h,
                "containers_incoming": containers_12h,
                "current_utilization": current_util,
                "available_cranes": avail_cranes,
                "crane_utilization": avg_util,
                "yard_utilization": yard_util,
                "priority_score": priority_score,
                "vessel_size_score": size_score,
                "berth_capacity": berth.get("capacity", 10000),
                "crane_count": max_cranes,
                "crane_deficit": max(0, arrivals_12h - avail_cranes),
            }
            records.append(features)

        if not records:
            return pd.DataFrame()

        df = pd.DataFrame(records)
        return df

    def _calculate_congestion_score(self, features: Dict[str, float]) -> float:
        """Rule-based + weighted score calculation"""
        score = 0.0

        # Base utilization weight
        util = features.get("current_utilization", 0)
        score += util * 0.30

        # Arrival pressure
        arrivals = features.get("arrival_density_12h", 0)
        score += min(arrivals / 8.0, 1.0) * 0.20

        # Container volume pressure
        containers = features.get("containers_incoming", 0)
        capacity = max(features.get("berth_capacity", 10000), 1)
        score += min(containers / capacity, 1.0) * 0.15

        # Crane availability
        crane_deficit = features.get("crane_deficit", 0)
        score += min(crane_deficit / 5.0, 1.0) * 0.15

        # Crane utilization
        crane_util = features.get("crane_utilization", 0)
        score += crane_util * 0.10

        # Yard pressure
        yard_util = features.get("yard_utilization", 0)
        score += yard_util * 0.10

        return min(score, 1.0)

    def _train_synthetic(self):
        """Train model on synthetically generated labeled data"""
        np.random.seed(42)
        n = 2000
        X = pd.DataFrame({
            "arrival_density_12h": np.random.randint(0, 10, n),
            "arrival_density_24h": np.random.randint(0, 20, n),
            "containers_incoming": np.random.randint(0, 15000, n),
            "current_utilization": np.random.uniform(0, 1, n),
            "available_cranes": np.random.randint(0, 8, n),
            "crane_utilization": np.random.uniform(0, 1, n),
            "yard_utilization": np.random.uniform(0, 1, n),
            "priority_score": np.random.randint(0, 20, n),
            "vessel_size_score": np.random.randint(0, 30, n),
            "berth_capacity": np.random.randint(5000, 25000, n),
            "crane_count": np.random.randint(2, 8, n),
            "crane_deficit": np.random.randint(0, 6, n),
        })
        # Generate labels using rule-based scoring
        y = np.array([
            self._calculate_congestion_score(row.to_dict())
            + np.random.normal(0, 0.05)
            for _, row in X.iterrows()
        ]).clip(0, 1)

        feature_cols = [c for c in X.columns]
        self.regressor.fit(X[feature_cols], y)
        self.is_trained = True
        self.feature_cols = feature_cols

    def predict(self, vessels: List[Dict], berths: List[Dict],
                cranes: List[Dict], yard_zones: List[Dict],
                base_time: Any = None) -> List[Dict]:
        """Predict congestion for each berth"""
        if not self.is_trained:
            self._train_synthetic()

        if base_time is None:
            base_time = datetime.now()
        elif isinstance(base_time, str):
            base_time = datetime.fromisoformat(base_time)

        df = self._build_features(vessels, berths, cranes, yard_zones, base_time)
        if df.empty:
            return []

        berth_ids = df["berth_id"].tolist()
        feature_cols = [c for c in df.columns if c != "berth_id"]
        self.feature_cols = feature_cols

        X = df[feature_cols].fillna(0)
        # ML prediction
        try:
            ml_scores = self.regressor.predict(X)
        except Exception:
            ml_scores = np.array([
                self._calculate_congestion_score(row.to_dict())
                for _, row in X.iterrows()
            ])

        results = []
        for i, (bid, score) in enumerate(zip(berth_ids, ml_scores)):
            clamped = float(np.clip(score, 0, 1))

            if clamped < 0.30:
                risk_level = "low"
            elif clamped < 0.55:
                risk_level = "medium"
            elif clamped < 0.75:
                risk_level = "high"
            else:
                risk_level = "critical"

            # Expected waiting time based on risk
            expected_wait = clamped * 8.0 + float(X.iloc[i]["arrival_density_12h"]) * 0.5

            # 72-hour forecast (hourly)
            forecast = self._generate_forecast(clamped, X.iloc[i].to_dict())

            berth_data = next((b for b in berths if b["berth_id"] == bid), {})
            vessel_list = [
                v["vessel_id"] for v in vessels
                if v.get("assigned_berth") == bid
            ]

            results.append({
                "berth_id": bid,
                "congestion_risk": round(clamped * 100, 1),
                "risk_level": risk_level,
                "expected_wait_hours": round(expected_wait, 1),
                "current_utilization": round(berth_data.get("current_utilization", 0) * 100, 1),
                "arrival_density_12h": int(X.iloc[i]["arrival_density_12h"]),
                "available_cranes": int(X.iloc[i]["available_cranes"]),
                "forecast_72h": forecast,
                "assigned_vessels": vessel_list,
                "features": {
                    "arrival_density": int(X.iloc[i]["arrival_density_12h"]),
                    "containers_incoming": int(X.iloc[i]["containers_incoming"]),
                    "crane_deficit": int(X.iloc[i]["crane_deficit"]),
                    "yard_utilization": round(float(X.iloc[i]["yard_utilization"]) * 100, 1)
                }
            })

        return sorted(results, key=lambda x: x["congestion_risk"], reverse=True)

    def _generate_forecast(self, base_risk: float, features: Dict) -> List[Dict]:
        """Generate hourly forecast for next 72h"""
        forecast = []
        now = datetime.now()
        risk = base_risk

        for h in range(0, 73, 3):
            # Add realistic fluctuation
            noise = np.random.normal(0, 0.03)
            # Day/night pattern
            hour_of_day = (now.hour + h) % 24
            day_factor = 0.05 * np.sin((hour_of_day - 6) * np.pi / 12)
            # Gradual drift
            trend = -0.002 * h  # slight improvement over time
            val = float(np.clip(risk + noise + day_factor + trend, 0, 1))
            forecast.append({
                "hour": h,
                "timestamp": (now + timedelta(hours=h)).strftime("%H:%M"),
                "risk": round(val * 100, 1)
            })

        return forecast

    def predict_vessel_risks(self, vessels: List[Dict], berths: List[Dict],
                             berth_predictions: List[Dict]) -> List[Dict]:
        """Assign risk scores to individual vessels"""
        berth_risk_map = {p["berth_id"]: p for p in berth_predictions}
        size_weights = {"small": 0.8, "medium": 1.0, "large": 1.2, "vlcc": 1.5}
        priority_weights = {"low": 0.8, "normal": 1.0, "high": 1.2, "critical": 1.5}

        vessel_risks = []
        for v in vessels:
            berth_id = v.get("assigned_berth")
            berth_pred = berth_risk_map.get(berth_id, {})
            berth_risk = berth_pred.get("congestion_risk", 30.0) / 100.0

            sw = size_weights.get(v.get("vessel_size", "medium"), 1.0)
            pw = priority_weights.get(v.get("priority", "normal"), 1.0)

            vessel_risk = min(berth_risk * sw, 1.0)
            wait = berth_pred.get("expected_wait_hours", 1.0)
            adj_wait = wait * (1 + (sw - 1) * 0.3)

            if vessel_risk < 0.3:
                risk_level = "low"
                action = "No action required"
            elif vessel_risk < 0.55:
                risk_level = "medium"
                action = "Monitor vessel arrival timing"
            elif vessel_risk < 0.75:
                risk_level = "high"
                action = f"Consider rerouting to alternate berth"
            else:
                risk_level = "critical"
                action = "Immediate rerouting recommended"

            vessel_risks.append({
                **v,
                "congestion_risk": round(vessel_risk * 100, 1),
                "risk_level": risk_level,
                "predicted_wait": round(adj_wait, 1),
                "recommended_action": action
            })

        return vessel_risks
