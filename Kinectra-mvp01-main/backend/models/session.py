from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime

class StartSessionRequest(BaseModel):
    athleteName: str = Field(..., example="John Doe")
    analysisType: str = Field(..., example="bowling", description="Should be 'bowling' or 'batting'")
    skillLevel: Optional[str] = Field("beginner", example="intermediate")
    dominantHand: Optional[str] = Field("right", example="left")

class SessionStartResponse(BaseModel):
    sessionId: str
    status: str

class MetricUpdate(BaseModel):
    elbow_angle: float
    knee_angle: float
    spine_tilt: float
    shoulder_alignment: float
    balance_score: float
    technique_score: float
    warnings: List[str]

class SessionSummary(BaseModel):
    session_id: str
    athlete_name: str
    analysis_type: str
    skill_level: str
    dominant_hand: str
    frame_count: int
    avg_elbow_angle: float
    avg_knee_angle: float
    avg_spine_tilt: float
    avg_shoulder_alignment: float
    avg_balance_score: float
    overall_score: float
    warnings: List[str]
    timestamp: str = Field(default_factory=lambda: datetime.utcnow().isoformat())
    status: str = "completed"
    upload_ready: bool = True
