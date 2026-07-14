import base64
import json
import traceback
import cv2
import numpy as np
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from services.pose_detector import PoseDetector
from services.arduino_serial import ArduinoSerialController
from services.angle_calculator import compute_metrics
from routes.session import session_manager

router = APIRouter(tags=["analysis"])

# Shared services, instantiated lazily or during startup
pose_detector = None
arduino_serial = None

def get_pose_detector():
    global pose_detector
    if pose_detector is None:
        pose_detector = PoseDetector()
    return pose_detector

def get_arduino_serial():
    global arduino_serial
    if arduino_serial is None:
        arduino_serial = ArduinoSerialController()
    return arduino_serial

@router.websocket("/api/analysis/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    print("WebSocket client connected to Kinetra Analysis...")
    
    # Cache detector and serial refs
    detector = get_pose_detector()
    serial_ctrl = get_arduino_serial()
    
    try:
        while True:
            # Receive message (JSON or raw string)
            message = await websocket.receive_text()
            
            # Default configuration
            session_id = "default_session"
            analysis_type = "bowling"
            dominant_hand = "right"
            frame_b64 = None
            
            # 1. Parse payload
            try:
                if message.strip().startswith("{"):
                    # JSON payload format
                    payload = json.loads(message)
                    frame_b64 = payload.get("frame")
                    session_id = payload.get("session_id") or payload.get("sessionId") or session_id
                    analysis_type = payload.get("analysis_type") or payload.get("analysisType") or analysis_type
                    dominant_hand = payload.get("dominant_hand") or payload.get("dominantHand") or dominant_hand
                else:
                    # Raw base64 string format
                    frame_b64 = message
            except Exception as pe:
                await websocket.send_json({"error": f"Failed to parse payload: {pe}"})
                continue
                
            if not frame_b64:
                await websocket.send_json({"error": "Missing video frame data."})
                continue
                
            # Remove base64 metadata headers if present (e.g. "data:image/jpeg;base64,")
            if "," in frame_b64:
                frame_b64 = frame_b64.split(",")[1]
                
            # 2. Decode image
            try:
                image_bytes = base64.b64decode(frame_b64)
                nparr = np.frombuffer(image_bytes, np.uint8)
                image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
                if image is None:
                    await websocket.send_json({"error": "OpenCV frame decoding returned None."})
                    continue
            except Exception as de:
                await websocket.send_json({"error": f"Failed to decode base64 frame: {de}"})
                continue
                
            # 3. Detect keypoints
            try:
                keypoints = detector.detect(image)
            except Exception as ie:
                print(f"Inference error: {ie}")
                traceback.print_exc()
                await websocket.send_json({"error": f"Pose inference failed: {ie}"})
                continue
                
            # 4. Compute angles and form score
            metrics = compute_metrics(keypoints, analysis_type, dominant_hand)
            
            # 5. Send serial command to Arduino based on technique score
            try:
                serial_ctrl.send_command(metrics["technique_score"])
            except Exception as se:
                print(f"Failed to transmit serial command: {se}")
                
            # 6. Update session telemetry averages
            session_manager.update_session(session_id, metrics)
            
            # 7. Construct and send response
            response = {
                "landmarks": keypoints,
                "angles": {
                    "elbow_angle": metrics["elbow_angle"],
                    "knee_angle": metrics["knee_angle"],
                    "spine_tilt": metrics["spine_tilt"],
                    "shoulder_alignment": metrics["shoulder_alignment"]
                },
                "warnings": metrics["warnings"],
                "score": {
                    "balance_score": metrics["balance_score"],
                    "technique_score": metrics["technique_score"]
                }
            }
            await websocket.send_json(response)
            
    except WebSocketDisconnect:
        print("WebSocket client disconnected.")
    except Exception as e:
        print(f"WebSocket processing loop error: {e}")
        traceback.print_exc()
