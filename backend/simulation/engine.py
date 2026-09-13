"""
Simulation Engine – generates realistic synthetic port data
"""
import random
import math
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
import numpy as np

VESSEL_NAMES = [
    "Ever Given", "MSC Gülsün", "HMM Algeciras", "MOL Triumph",
    "OOCL Hong Kong", "CMA CGM Antoine", "MSC Isabella", "Evergreen Emerald",
    "Yang Ming Witness", "ONE Trust", "Cosco Shipping Universe",
    "Maersk Mc-Kinney", "Hapag Colombo", "Evergreen Excellence",
    "MSC Aleria", "CSCL Globe", "Madrid Maersk", "Seaspan Ambition",
    "Triton Empress", "Pacific Champion", "Atlantic Eagle", "Nordic Star",
    "Dragon Pearl", "Golden Gate", "Blue Horizon", "Sea Phoenix",
    "Ocean Titan", "Port Champion", "Wave Runner", "Cargo Express",
    "Neptune Star", "Pacific Trade", "Asia Link", "Euro Bridge",
    "Trans Ocean", "Global Carrier", "Sea Master", "Port Pioneer",
    "Cargo King", "Ocean Pride", "Wave Master", "Sea Falcon",
    "Pacific Sun", "Ocean Star", "Harbor Light", "Sea Eagle",
    "Port Titan", "Ocean Knight", "Sea Dragon", "Pacific Hero"
]

DESTINATIONS = [
    "Rotterdam", "Shanghai", "Singapore", "Antwerp", "Busan",
    "Hong Kong", "Los Angeles", "Hamburg", "Qingdao", "Tianjin",
    "Dubai", "Felixstowe", "Yokohama", "Colombo", "Kaohsiung"
]


class SimulationEngine:
    def __init__(self, config: Dict[str, Any]):
        self.num_vessels = config.get("num_vessels", 50)
        self.num_berths = config.get("num_berths", 8)
        self.num_cranes = config.get("num_cranes", 24)
        self.duration_hours = config.get("duration_hours", 72)
        self.congestion_factor = config.get("congestion_factor", 1.0)
        seed = config.get("seed")
        if seed is not None:
            random.seed(seed)
            np.random.seed(seed)
        else:
            random.seed(42)
            np.random.seed(42)
        self.base_time = datetime.now().replace(minute=0, second=0, microsecond=0)

    def generate_vessels(self) -> List[Dict]:
        vessels = []
        size_map = {
            "small": (300, 1000, 1),
            "medium": (1000, 3000, 2),
            "large": (3000, 6000, 3),
            "vlcc": (6000, 15000, 5)
        }
        sizes = ["small", "medium", "large", "vlcc"]
        size_weights = [0.15, 0.35, 0.35, 0.15]
        priorities = ["low", "normal", "normal", "high", "critical"]

        used_names = set()
        for i in range(self.num_vessels):
            # Pick unique name
            name = random.choice(VESSEL_NAMES)
            suffix = "" if name not in used_names else f" {i+1}"
            used_names.add(name)
            full_name = name + suffix

            size = random.choices(sizes, weights=size_weights)[0]
            min_c, max_c, base_cranes = size_map[size]
            containers = random.randint(min_c, max_c)

            # ETA within next 72 hours, with clustering to create congestion
            hour_offset = self._generate_arrival_hour()
            eta = self.base_time + timedelta(hours=hour_offset)

            # Handling time based on containers and cranes
            priority = random.choice(priorities)
            required_cranes = base_cranes + random.randint(0, 2)
            handling_rate = 180  # containers/hour per crane
            handling_hours = math.ceil(containers / (required_cranes * handling_rate))
            etd = eta + timedelta(hours=max(handling_hours, 4) + random.uniform(0, 2))

            vessels.append({
                "vessel_id": f"V{101 + i}",
                "vessel_name": full_name,
                "eta": eta.isoformat(),
                "etd": etd.isoformat(),
                "containers": containers,
                "vessel_size": size,
                "priority": priority,
                "destination": random.choice(DESTINATIONS),
                "required_cranes": required_cranes,
                "assigned_berth": None,
                "status": "en_route" if hour_offset > 0 else "waiting",
                "waiting_time": 0.0,
                "congestion_risk": 0.0,
                "risk_level": "low",
                "recommended_action": None
            })

        return sorted(vessels, key=lambda v: v["eta"])

    def _generate_arrival_hour(self) -> float:
        """Generate arrival hours with realistic clustering (congestion waves)"""
        # Create congestion windows to make it interesting
        waves = [
            (2, 8, 0.30),   # early morning rush
            (8, 16, 0.40),  # day wave
            (20, 30, 0.20), # next day morning
            (36, 60, 0.10), # spread over days 2-3
        ]
        r = random.random()
        cumulative = 0
        for start, end, weight in waves:
            cumulative += weight
            if r <= cumulative:
                base = random.uniform(start, end)
                # Add jitter
                return max(0, base + random.gauss(0, 1.5)) * self.congestion_factor
        return random.uniform(0, self.duration_hours)

    def generate_berths(self) -> List[Dict]:
        berths = []
        size_limits = ["small", "medium", "large", "vlcc"]

        for i in range(self.num_berths):
            berth_id = f"B{i+1}"
            crane_allocation = max(2, self.num_cranes // self.num_berths)
            if i < 2:
                crane_allocation += 2  # premium berths

            berths.append({
                "berth_id": berth_id,
                "capacity": random.randint(8000, 20000),
                "vessel_size_limit": size_limits[min(i, 3)] if i < 4 else "large",
                "available_from": self.base_time.isoformat(),
                "available_until": (self.base_time + timedelta(hours=self.duration_hours)).isoformat(),
                "crane_count": crane_allocation,
                "current_utilization": random.uniform(0.2, 0.65),
                "status": "available",
                "congestion_risk": 0.0,
                "assigned_vessels": []
            })

        return berths

    def generate_cranes(self, berths: List[Dict]) -> List[Dict]:
        cranes = []
        crane_idx = 1
        per_berth = self.num_cranes // len(berths)
        remainder = self.num_cranes % len(berths)

        for b_idx, berth in enumerate(berths):
            count = per_berth + (1 if b_idx < remainder else 0)
            for c in range(count):
                status = random.choices(
                    ["available", "busy", "maintenance"],
                    weights=[0.5, 0.4, 0.1]
                )[0]
                cranes.append({
                    "crane_id": f"CR{crane_idx:02d}",
                    "berth_id": berth["berth_id"],
                    "status": status,
                    "capacity": random.randint(150, 220),  # containers/hour
                    "available_from": self.base_time.isoformat(),
                    "assigned_vessel": None,
                    "utilization": random.uniform(0.3, 0.85) if status == "busy" else 0.0
                })
                crane_idx += 1

        return cranes

    def generate_yard_zones(self) -> List[Dict]:
        zones = []
        zone_names = ["Alpha", "Bravo", "Charlie", "Delta", "Echo"]
        zone_types = ["import", "export", "transship", "reefer", "hazmat"]
        total_capacity = 50000
        num_zones = min(5, max(3, self.num_berths - 3))

        per_zone = total_capacity // num_zones
        for i in range(num_zones):
            capacity = per_zone + random.randint(-2000, 2000)
            occupancy = int(capacity * random.uniform(0.55, 0.88))
            util = occupancy / capacity

            zones.append({
                "yard_id": f"Y-{zone_names[i]}",
                "capacity": capacity,
                "current_occupancy": occupancy,
                "zone_type": zone_types[i % len(zone_types)],
                "utilization": round(util, 3),
                "predicted_24h": round(min(1.0, util + random.uniform(0.05, 0.15)), 3),
                "predicted_48h": round(min(1.0, util + random.uniform(0.10, 0.22)), 3)
            })

        return zones

    def run(self) -> Dict[str, Any]:
        vessels = self.generate_vessels()
        berths = self.generate_berths()
        cranes = self.generate_cranes(berths)
        yard_zones = self.generate_yard_zones()

        return {
            "vessels": vessels,
            "berths": berths,
            "cranes": cranes,
            "yard_zones": yard_zones,
            "config": {
                "num_vessels": self.num_vessels,
                "num_berths": self.num_berths,
                "num_cranes": self.num_cranes,
                "duration_hours": self.duration_hours,
                "base_time": self.base_time.isoformat()
            }
        }
