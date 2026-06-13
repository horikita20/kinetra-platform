import cv2
import mediapipe as mp
import numpy as np
import json
import sys
import os

# Ensure stdout uses UTF-8 and is unbuffered
sys.stdout.reconfigure(encoding='utf-8')

def calculate_angle(a, b, c):
    v1 = np.array([a['x'] - b['x'], a['y'] - b['y'], a['z'] - b['z']])
    v2 = np.array([c['x'] - b['x'], c['y'] - b['y'], c['z'] - b['z']])
    dot = np.dot(v1, v2)
    mag1 = np.linalg.norm(v1)
    mag2 = np.linalg.norm(v2)
    if mag1 == 0 or mag2 == 0:
        return 0.0
    clamped = np.clip(dot / (mag1 * mag2), -1.0, 1.0)
    return np.degrees(np.arccos(clamped))

def main():
    if len(sys.argv) < 6:
        print("ERROR: Missing arguments. Usage: python analyze_video.py <video_path> <athlete_name> <analysis_type> <skill_level> <dominant_hand>", flush=True)
        sys.exit(1)

    video_path = sys.argv[1]
    athlete_name = sys.argv[2]
    analysis_type = sys.argv[3]
    skill_level = sys.argv[4]
    dominant_hand = sys.argv[5]

    if not os.path.exists(video_path):
        print(f"ERROR: Video file not found at {video_path}", flush=True)
        sys.exit(1)

    # Step 1: Extracting Frames (Starting)
    print("STEP: 1", flush=True)
    print("PROGRESS: 5", flush=True)

    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        print("ERROR: Failed to open video file", flush=True)
        sys.exit(1)

    fps = cap.get(cv2.CAP_PROP_FPS)
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    
    if fps <= 0 or total_frames <= 0:
        print("ERROR: Invalid video metadata (FPS or frames count is 0)", flush=True)
        cap.release()
        sys.exit(1)

    duration = total_frames / fps
    if duration > 60.5: # Allow slight rounding threshold
        print("ERROR: Video must be under 60 seconds", flush=True)
        cap.release()
        sys.exit(1)

    # Initialize MediaPipe Pose
    mp_pose = mp.solutions.pose
    pose = mp_pose.Pose(
        static_image_mode=False,
        model_complexity=1,
        min_detection_confidence=0.5
    )

    is_right = dominant_hand == "right"
    warnings_set = set()
    frames_processed = 0
    
    posture_sum = 0.0
    alignment_sum = 0.0
    stability_sum = 0.0
    efficiency_sum = 0.0

    print("STEP: 2", flush=True)
    print("PROGRESS: 10", flush=True)

    frame_idx = 0
    while cap.isOpened():
        ret, frame = cap.read()
        if not ret:
            break

        # Process every 3rd frame to optimize performance
        if frame_idx % 3 == 0:
            frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            results = pose.process(frame_rgb)

            if results.pose_landmarks:
                landmarks = results.pose_landmarks.landmark
                
                # Extract landmarks (33 in total)
                pose_data = {
                    'nose': landmarks[0],
                    'lShoulder': landmarks[11], 'rShoulder': landmarks[12],
                    'lElbow': landmarks[13], 'rElbow': landmarks[14],
                    'lWrist': landmarks[15], 'rWrist': landmarks[16],
                    'lHip': landmarks[23], 'rHip': landmarks[24],
                    'lKnee': landmarks[25], 'rKnee': landmarks[26],
                    'lAnkle': landmarks[27], 'rAnkle': landmarks[28]
                }
                
                # Convert MediaPipe landmark structures to dict for processing
                p = {}
                for k, lm in pose_data.items():
                    p[k] = {'x': lm.x, 'y': lm.y, 'z': lm.z}

                shoulder = p['rShoulder'] if is_right else p['lShoulder']
                elbow = p['rElbow'] if is_right else p['lElbow']
                wrist = p['rWrist'] if is_right else p['lWrist']
                hip = p['rHip'] if is_right else p['lHip']
                knee = p['rKnee'] if is_right else p['lKnee']
                ankle = p['rAnkle'] if is_right else p['lAnkle']

                elbow_angle = calculate_angle(shoulder, elbow, wrist)
                knee_angle = calculate_angle(hip, knee, ankle)

                mid_hip = {
                    'x': (p['lHip']['x'] + p['rHip']['x']) / 2,
                    'y': (p['lHip']['y'] + p['rHip']['y']) / 2,
                    'z': (p['lHip']['z'] + p['rHip']['z']) / 2
                }
                mid_shoulder = {
                    'x': (p['lShoulder']['x'] + p['rShoulder']['x']) / 2,
                    'y': (p['lShoulder']['y'] + p['rShoulder']['y']) / 2,
                    'z': (p['lShoulder']['z'] + p['rShoulder']['z']) / 2
                }
                vertical_above_hip = {'x': mid_hip['x'], 'y': mid_hip['y'] - 1.0, 'z': mid_hip['z']}
                spine_tilt = calculate_angle(vertical_above_hip, mid_hip, mid_shoulder)

                shoulder_alignment = abs(
                    calculate_angle(p['rShoulder'], p['lShoulder'], {
                        'x': p['rShoulder']['x'],
                        'y': p['lShoulder']['y'],
                        'z': p['lShoulder']['z']
                    })
                )

                hip_level = abs(p['lHip']['y'] - p['rHip']['y'])
                balance_score = max(0.0, min(100.0, 100.0 - hip_level * 500.0))

                warnings = []
                technique_score = 100.0

                if analysis_type == "bowling":
                    if elbow_angle < 80.0:
                        warnings.append("Elbow angle too low")
                    if spine_tilt > 30.0:
                        warnings.append("Excessive spine tilt")
                    if shoulder_alignment > 15.0:
                        warnings.append("Poor shoulder rotation")

                    technique_score = (
                        balance_score * 0.25 +
                        max(0.0, 100.0 - abs(elbow_angle - 95.0)) * 0.25 +
                        max(0.0, 100.0 - spine_tilt * 2.0) * 0.3 +
                        max(0.0, 100.0 - shoulder_alignment * 2.0) * 0.2
                    )
                else: # batting
                    if knee_angle < 120.0:
                        warnings.append("Front knee bent too much")
                    if elbow_angle < 90.0:
                        warnings.append("Low bat lift")

                    technique_score = (
                        balance_score * 0.3 +
                        max(0.0, 100.0 - abs(knee_angle - 150.0) * 0.5) * 0.3 +
                        max(0.0, 100.0 - spine_tilt * 2.0) * 0.2 +
                        max(0.0, 100.0 - shoulder_alignment * 2.0) * 0.2
                    )

                for w in warnings:
                    warnings_set.add(w)

                frames_processed += 1
                
                # Accumulate values
                posture_sum += 50.0 if spine_tilt > 30.0 else 90.0
                alignment_sum += 95.0 if shoulder_alignment < 10.0 else 60.0
                stability_sum += balance_score
                efficiency_sum += technique_score

        frame_idx += 1
        
        # Report progress dynamically (10% to 90%)
        if total_frames > 0:
            pct = int(10 + (frame_idx / total_frames) * 80)
            print(f"PROGRESS: {pct}", flush=True)

            if pct < 35:
                print("STEP: 2", flush=True)  # Detecting Pose
            elif pct < 55:
                print("STEP: 3", flush=True)  # Calculating Angles
            elif pct < 75:
                print("STEP: 4", flush=True)  # Biomechanics Analysis
            elif pct < 90:
                print("STEP: 5", flush=True)  # AI Scoring

    cap.release()
    pose.close()

    # Step 6: Creating Performance Report (Post-processing)
    print("STEP: 6", flush=True)
    print("PROGRESS: 95", flush=True)

    n = max(1, frames_processed)
    avg_posture = int(round(posture_sum / n))
    avg_alignment = int(round(alignment_sum / n))
    avg_stability = int(round(stability_sum / n))
    avg_efficiency = int(round(efficiency_sum / n))

    overall_score = int(round(
        avg_posture * 0.3 +
        avg_alignment * 0.25 +
        avg_stability * 0.25 +
        avg_efficiency * 0.2
    ))

    print("PROGRESS: 100", flush=True)

    # Output final result JSON payload
    result = {
        "frameCount": frames_processed,
        "avgPostureScore": avg_posture,
        "avgAlignmentScore": avg_alignment,
        "avgStabilityScore": avg_stability,
        "avgEfficiencyScore": avg_efficiency,
        "overallScore": overall_score,
        "warnings": list(warnings_set)
    }

    print(f"RESULT: {json.dumps(result)}", flush=True)

if __name__ == "__main__":
    main()
