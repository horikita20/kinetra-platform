import uuid
from fastapi import APIRouter, HTTPException
from models.session import StartSessionRequest, SessionStartResponse, SessionSummary
from services.session_manager import SessionManager

router = APIRouter(prefix="/api/session", tags=["session"])

# Initialize or import shared session manager
# We can create a singleton instance here or import it
session_manager = SessionManager()

@router.post("/start", response_model=SessionStartResponse)
async def start_session(request: StartSessionRequest):
    """Starts a new analysis session for an athlete."""
    session_id = str(uuid.uuid4())
    try:
        session_manager.start_session(
            session_id=session_id,
            athlete_name=request.athleteName,
            analysis_type=request.analysisType,
            skill_level=request.skillLevel,
            dominant_hand=request.dominantHand
        )
        return SessionStartResponse(id=session_id, sessionId=session_id, status="active")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to start session: {e}")

@router.post("/{session_id}/end")
async def end_session_path(session_id: str):
    """Ends the session by ID (path parameter) and returns the compiled summary."""
    try:
        summary = session_manager.end_session(session_id)
        return summary
    except ValueError as ve:
        raise HTTPException(status_code=404, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to end session: {e}")

@router.post("/end")
async def end_session_body(payload: dict):
    """Ends the session by ID (body parameter) for flex compatibility with different frontends."""
    session_id = payload.get("sessionId") or payload.get("session_id")
    if not session_id:
        raise HTTPException(status_code=400, detail="Missing session ID in payload.")
    try:
        summary = session_manager.end_session(session_id)
        return summary
    except ValueError as ve:
        raise HTTPException(status_code=404, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to end session: {e}")

@router.get("/{session_id}")
async def get_session(session_id: str):
    """Gets the saved summary of a completed session."""
    summary = session_manager.get_session_summary(session_id)
    if not summary:
        raise HTTPException(status_code=404, detail=f"Session summary for {session_id} not found.")
    return summary

@router.get("")
async def list_sessions():
    """Lists recent session summaries."""
    try:
        return session_manager.list_session_summaries()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list sessions: {e}")
