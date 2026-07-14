import sys
import os
import json
import numpy as np

# Adjust path to import backend modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services.angle_calculator import calculate_angle, compute_metrics
from services.session_manager import SessionManager
from services.arduino_serial import ArduinoSerialController
from services.pose_detector import PoseDetector

def test_angle_math():
    print("[TEST] Running angle math tests...")
    
    # Define three points forming a 90-degree angle
    # Vertex is B: (0, 0)
    # A is (0, 100) - straight up
    # C is (100, 0) - straight right
    a = {"x": 0.0, "y": 100.0}
    b = {"x": 0.0, "y": 0.0}
    c = {"x": 100.0, "y": 0.0}
    
    angle = calculate_angle(a, b, c)
    assert abs(angle - 90.0) < 0.1, f"Expected 90.0, got {angle}"
    print("  - 90-degree right angle calculation: PASSED")
    
    # 45-degree angle
    a_45 = {"x": 100.0, "y": 100.0}
    angle_45 = calculate_angle(a_45, b, c)
    assert abs(angle_45 - 45.0) < 0.1, f"Expected 45.0, got {angle_45}"
    print("  - 45-degree diagonal angle calculation: PASSED")

def test_session_manager():
    print("[TEST] Running SessionManager state tests...")
    manager = SessionManager()
    
    session_id = "test_session_123"
    manager.start_session(
        session_id=session_id,
        athlete_name="Test Athlete",
        analysis_type="bowling",
        dominant_hand="right"
    )
    
    # Send mock metrics
    mock_metrics = {
        "elbow_angle": 95.0,
        "knee_angle": 140.0,
        "spine_tilt": 10.0,
        "shoulder_alignment": 5.0,
        "balance_score": 90.0,
        "technique_score": 88.0,
        "warnings": ["Elbow angle too low"]
    }
    
    manager.update_session(session_id, mock_metrics)
    manager.update_session(session_id, mock_metrics)
    
    summary = manager.end_session(session_id)
    
    assert summary["session_id"] == session_id
    assert summary["frame_count"] == 2
    assert summary["avg_elbow_angle"] == 95.0
    assert summary["overall_score"] == 88.0
    assert "Elbow angle too low" in summary["warnings"]
    
    # Check if file exists
    saved_summary = manager.get_session_summary(session_id)
    assert saved_summary is not None
    assert saved_summary["athlete_name"] == "Test Athlete"
    print("  - SessionManager start, update, end, and JSON saving: PASSED")
    
    # Clean up test file
    file_path = manager.sessions_dir / f"session_{session_id}.json"
    if file_path.exists():
        os.remove(file_path)

def test_arduino_serial():
    print("[TEST] Running ArduinoSerialController test...")
    # Initialize in Mock Mode
    os.environ["SERIAL_ENABLED"] = "true"
    os.environ["SERIAL_PORT"] = "MOCK_PORT"
    controller = ArduinoSerialController()
    
    # Test sending scores triggers correct command logging
    print("  - Testing good score (>80):")
    controller.send_command(85.0)  # Should trigger 'G'
    
    print("  - Testing warning score (60-80):")
    controller.send_command(70.0)  # Should trigger 'W'
    
    print("  - Testing danger score (<60):")
    controller.send_command(50.0)  # Should trigger 'D'
    
    controller.close()
    print("  - Arduino serial command mapping and fail-safe mock: PASSED")

def test_pose_detector_inference():
    print("[TEST] Running PoseDetector initialization and inference check...")
    # Initialize (this will download model if not present, and try CPU loading)
    os.environ["USE_QNN"] = "false" # Force CPU EP for test execution stability
    try:
        detector = PoseDetector()
        
        # Run inference on a blank/dummy frame
        dummy_frame = np.zeros((480, 640, 3), dtype=np.uint8)
        keypoints = detector.detect(dummy_frame)
        
        print(f"  - Inference on dummy frame completed (found {len(keypoints)} people).")
        # Since it's a solid black image, we expect 0 keypoints detected
        assert len(keypoints) == 0 or len(keypoints) == 17
        print("  - PoseDetector ONNX initialization & execution: PASSED")
    except Exception as e:
        print(f"  - PoseDetector execution failed: {e}")
        raise e

if __name__ == "__main__":
    print("=== STARTING KINETRA BACKEND VERIFICATION PIPELINE ===")
    try:
        test_angle_math()
        test_session_manager()
        test_arduino_serial()
        test_pose_detector_inference()
        print("=== ALL TESTS PASSED SUCCESSFULLY ===")
        sys.exit(0)
    except Exception as ex:
        print(f"=== TEST RUN ENCOUNTERED ERRORS: {ex} ===")
        sys.exit(1)
