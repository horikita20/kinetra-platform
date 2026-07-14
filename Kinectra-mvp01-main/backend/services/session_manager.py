import json
import os
from datetime import datetime
from pathlib import Path
from utils.config import config
from models.session import SessionSummary

class SessionManager:
    def __init__(self):
        # In-memory store for active session accumulators
        # format: { session_id: { "athlete_name": ..., "metrics_sum": { ... }, "frame_count": ... } }
        self.active_sessions = {}
        self.sessions_dir = Path(config.SESSIONS_DIR)

    def start_session(self, session_id: str, athlete_name: str, analysis_type: str, skill_level: str = "beginner", dominant_hand: str = "right"):
        """Initializes a new analysis session."""
        self.active_sessions[session_id] = {
            "athlete_name": athlete_name,
            "analysis_type": analysis_type,
            "skill_level": skill_level,
            "dominant_hand": dominant_hand,
            "frame_count": 0,
            "elbow_angle_sum": 0.0,
            "knee_angle_sum": 0.0,
            "spine_tilt_sum": 0.0,
            "shoulder_alignment_sum": 0.0,
            "balance_score_sum": 0.0,
            "technique_score_sum": 0.0,
            "warnings_set": set(),
            "start_time": datetime.utcnow().isoformat()
        }
        print(f"Session {session_id} started for athlete {athlete_name} ({analysis_type}).")

    def update_session(self, session_id: str, metrics: dict):
        """Accumulates metrics for a running session."""
        if session_id not in self.active_sessions:
            return
            
        session = self.active_sessions[session_id]
        session["frame_count"] += 1
        session["elbow_angle_sum"] += metrics["elbow_angle"]
        session["knee_angle_sum"] += metrics["knee_angle"]
        session["spine_tilt_sum"] += metrics["spine_tilt"]
        session["shoulder_alignment_sum"] += metrics["shoulder_alignment"]
        session["balance_score_sum"] += metrics["balance_score"]
        session["technique_score_sum"] += metrics["technique_score"]
        
        for warning in metrics["warnings"]:
            session["warnings_set"].add(warning)

    def end_session(self, session_id: str) -> dict:
        """Ends the session, computes averages, saves the summary to a JSON file, and returns it."""
        if session_id not in self.active_sessions:
            # Check if it was already saved
            summary = self.get_session_summary(session_id)
            if summary:
                return summary
            raise ValueError(f"Session {session_id} not active or not found.")

        session = self.active_sessions[session_id]
        frames = max(1, session["frame_count"])

        # Compute averages
        avg_elbow = session["elbow_angle_sum"] / frames
        avg_knee = session["knee_angle_sum"] / frames
        avg_spine = session["spine_tilt_sum"] / frames
        avg_shoulder = session["shoulder_alignment_sum"] / frames
        avg_balance = session["balance_score_sum"] / frames
        overall = session["technique_score_sum"] / frames

        summary = SessionSummary(
            session_id=session_id,
            athlete_name=session["athlete_name"],
            analysis_type=session["analysis_type"],
            skill_level=session["skill_level"],
            dominant_hand=session["dominant_hand"],
            frame_count=frames,
            avg_elbow_angle=round(avg_elbow, 1),
            avg_knee_angle=round(avg_knee, 1),
            avg_spine_tilt=round(avg_spine, 1),
            avg_shoulder_alignment=round(avg_shoulder, 1),
            avg_balance_score=round(avg_balance, 1),
            overall_score=round(overall, 1),
            warnings=list(session["warnings_set"]),
            timestamp=datetime.utcnow().isoformat(),
            status="completed",
            upload_ready=True
        )

        # Write to JSON file
        file_path = self.sessions_dir / f"session_{session_id}.json"
        try:
            with open(file_path, "w") as f:
                json.dump(summary.dict(), f, indent=4)
            print(f"Saved session summary to {file_path}")
        except Exception as e:
            print(f"Error saving session JSON summary: {e}")

        # Clean up active session
        del self.active_sessions[session_id]
        return summary.dict()

    def get_session_summary(self, session_id: str) -> dict:
        """Retrieves a saved session summary by ID."""
        file_path = self.sessions_dir / f"session_{session_id}.json"
        if file_path.exists():
            try:
                with open(file_path, "r") as f:
                    return json.load(f)
            except Exception as e:
                print(f"Error reading session JSON summary {file_path}: {e}")
        return None

    def list_session_summaries(self) -> list:
        """Lists all saved session summaries."""
        summaries = []
        for file_name in os.listdir(self.sessions_dir):
            if file_name.startswith("session_") and file_name.endswith(".json"):
                file_path = self.sessions_dir / file_name
                try:
                    with open(file_path, "r") as f:
                        summaries.append(json.load(f))
                except Exception as e:
                    print(f"Error loading {file_name}: {e}")
        # Sort by timestamp descending
        summaries.sort(key=lambda x: x.get("timestamp", ""), reverse=True)
        return summaries
