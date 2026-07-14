import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routes import session, analysis

app = FastAPI(
    title="Kinetra AI Backend",
    description="Python FastAPI Pose Estimation, Biomechanics Analysis, and Serial Arduino signaling server.",
    version="1.0.0"
)

# Configure CORS for frontend web connectivity
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Adjust for specific domains in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register endpoints and routers
app.include_router(session.router)
app.include_router(analysis.router)

@app.get("/api/health")
async def health_check():
    """Simple health check endpoint."""
    return {"status": "running"}

@app.on_event("startup")
async def startup_event():
    """Initializes heavy services at server startup (Model & Serial)."""
    print("Starting Kinetra backend server lifecycle...")
    
    # Pre-initialize services to warm them up
    try:
        detector = analysis.get_pose_detector()
        print("Warmup: Pose Detector initialized.")
    except Exception as e:
        print(f"Warmup warning: Pose detector initialization failed during startup: {e}")
        
    try:
        serial_ctrl = analysis.get_arduino_serial()
        print("Warmup: Arduino Serial Controller initialized.")
    except Exception as e:
        print(f"Warmup warning: Arduino serial initialization failed during startup: {e}")

@app.on_event("shutdown")
async def shutdown_event():
    """Releases hardware resources (like COM ports) on shutdown."""
    print("Stopping Kinetra backend server lifecycle...")
    try:
        serial_ctrl = analysis.get_arduino_serial()
        serial_ctrl.close()
    except Exception as e:
        print(f"Shutdown error closing serial: {e}")

if __name__ == "__main__":
    # Start uvicorn server locally on port 8000
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
