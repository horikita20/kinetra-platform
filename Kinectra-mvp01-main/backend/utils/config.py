import os
from pathlib import Path

# Base Directory of the backend project
BASE_DIR = Path(__file__).resolve().parent.parent

class Config:
    # Model configuration
    MODEL_DIR = BASE_DIR / "models"
    MODEL_PATH = os.getenv("MODEL_PATH", str(MODEL_DIR / "yolov8n-pose.onnx"))
    MODEL_URL = "https://huggingface.co/Xenova/yolov8-pose-onnx/resolve/main/yolov8n-pose.onnx"
    
    # Serial configuration for Arduino
    SERIAL_PORT = os.getenv("SERIAL_PORT", "COM3")
    SERIAL_BAUD = int(os.getenv("SERIAL_BAUD", 9600))
    SERIAL_ENABLED = os.getenv("SERIAL_ENABLED", "true").lower() == "true"
    
    # Session summary saving configuration
    SESSIONS_DIR = BASE_DIR / "sessions"
    
    # ONNX Execution Provider Settings
    USE_QNN = os.getenv("USE_QNN", "true").lower() == "true"
    # QNN backend can be QnnHtp.dll (NPU), QnnGpu.dll (GPU) or QnnCpu.dll (CPU)
    QNN_BACKEND_PATH = os.getenv("QNN_BACKEND_PATH", "QnnHtp.dll")
    
    # Ensure necessary directories exist
    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    SESSIONS_DIR.mkdir(parents=True, exist_ok=True)

# Export instantiated configuration
config = Config()
