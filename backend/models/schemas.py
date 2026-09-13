from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum


class VesselSize(str, Enum):
    SMALL = "small"
    MEDIUM = "medium"
    LARGE = "large"
    VLCC = "vlcc"


class VesselPriority(str, Enum):
    LOW = "low"
    NORMAL = "normal"
    HIGH = "high"
    CRITICAL = "critical"


class BerthStatus(str, Enum):
    AVAILABLE = "available"
    OCCUPIED = "occupied"
    MAINTENANCE = "maintenance"


class CraneStatus(str, Enum):
    AVAILABLE = "available"
    BUSY = "busy"
    MAINTENANCE = "maintenance"


class RiskLevel(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class Vessel(BaseModel):
    vessel_id: str
    vessel_name: str
    eta: str  # ISO datetime string
    etd: str
    containers: int
    vessel_size: VesselSize
    priority: VesselPriority
    destination: str
    required_cranes: int
    assigned_berth: Optional[str] = None
    status: str = "en_route"
    waiting_time: float = 0.0
    congestion_risk: float = 0.0
    risk_level: RiskLevel = RiskLevel.LOW
    recommended_action: Optional[str] = None


class Berth(BaseModel):
    berth_id: str
    capacity: int
    vessel_size_limit: VesselSize
    available_from: str
    available_until: str
    crane_count: int
    current_utilization: float
    status: BerthStatus = BerthStatus.AVAILABLE
    congestion_risk: float = 0.0
    assigned_vessels: List[str] = []


class Crane(BaseModel):
    crane_id: str
    berth_id: str
    status: CraneStatus
    capacity: int  # containers per hour
    available_from: str
    assigned_vessel: Optional[str] = None
    utilization: float = 0.0


class YardZone(BaseModel):
    yard_id: str
    capacity: int
    current_occupancy: int
    zone_type: str = "general"
    utilization: float = 0.0
    predicted_24h: float = 0.0
    predicted_48h: float = 0.0


class SimulationConfig(BaseModel):
    num_vessels: int = Field(50, ge=10, le=200)
    num_berths: int = Field(8, ge=3, le=20)
    num_cranes: int = Field(24, ge=5, le=60)
    duration_hours: int = Field(72, ge=12, le=168)
    seed: Optional[int] = None
    congestion_factor: float = Field(1.0, ge=0.5, le=3.0)


class ScenarioConfig(BaseModel):
    name: str
    description: str
    vessel_arrival_increase: float = 0.0  # percentage e.g. 0.2 = +20%
    cranes_unavailable: int = 0
    berths_unavailable: List[str] = []
    yard_capacity_decrease: float = 0.0  # percentage e.g. 0.15 = -15%
    early_arrival_vessel: Optional[str] = None
    early_arrival_hours: float = 0.0


class CopilotQuery(BaseModel):
    question: str
    context: Optional[Dict[str, Any]] = None


class BerthAssignment(BaseModel):
    vessel_id: str
    berth_id: str
    start_time: str
    end_time: str
    cranes_assigned: int
    waiting_time: float
    score: float
    explanation: str


class RoutingRecommendation(BaseModel):
    vessel_id: str
    vessel_name: str
    current_berth: str
    recommended_berth: str
    current_wait: float
    recommended_wait: float
    time_saved: float
    reason: str
    confidence: float


class Alert(BaseModel):
    alert_id: str
    level: str  # critical, warning, info
    category: str
    message: str
    timestamp: str
    acknowledged: bool = False
    data: Optional[Dict[str, Any]] = None


class PlanEvent(BaseModel):
    time: str
    event_type: str
    vessel_id: Optional[str]
    vessel_name: Optional[str]
    berth_id: Optional[str]
    cranes: Optional[int]
    description: str
    risk_level: Optional[str] = None


class TimeBlock(BaseModel):
    label: str
    start_hour: int
    end_hour: int
    events: List[PlanEvent]
    congestion_level: float
    yard_utilization: float


class DashboardKPIs(BaseModel):
    total_vessels: int
    vessels_waiting: int
    active_vessels: int
    berths_in_use: int
    avg_waiting_time: float
    max_waiting_time: float
    yard_utilization: float
    crane_utilization: float
    congestion_risk_score: float
    critical_berths: int
    delayed_vessels: int
    optimization_improvement: float
    simulation_time: str


class BeforeAfterMetrics(BaseModel):
    before_avg_wait: float
    after_avg_wait: float
    before_berth_util: float
    after_berth_util: float
    before_crane_util: float
    after_crane_util: float
    before_critical_berths: int
    after_critical_berths: int
    wait_improvement_pct: float
    berth_improvement_pct: float
    crane_improvement_pct: float
