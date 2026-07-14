import math

def calculate_angle(a: dict, b: dict, c: dict) -> float:
    """
    Calculates the 2D angle (in degrees) formed by points a, b (vertex), and c.
    Points are dicts with keys 'x' and 'y'.
    """
    # Vector ba
    ba_x = a['x'] - b['x']
    ba_y = a['y'] - b['y']
    
    # Vector bc
    bc_x = c['x'] - b['x']
    bc_y = c['y'] - b['y']
    
    # Dot product
    dot_product = ba_x * bc_x + ba_y * bc_y
    
    # Magnitudes
    mag_ba = math.sqrt(ba_x**2 + ba_y**2)
    mag_bc = math.sqrt(bc_x**2 + bc_y**2)
    
    if mag_ba == 0 or mag_bc == 0:
        return 0.0
        
    cos_theta = dot_product / (mag_ba * mag_bc)
    # Clamp cos_theta to avoid floating point errors out of range [-1, 1]
    cos_theta = max(-1.0, min(1.0, cos_theta))
    
    angle_rad = math.acos(cos_theta)
    return math.degrees(angle_rad)

def compute_metrics(keypoints: list, analysis_type: str, dominant_hand: str) -> dict:
    """
    Computes angles and scoring metrics from YOLOv8 keypoints list.
    YOLOv8 pose returns 17 keypoints:
    0: nose, 1-4: eyes/ears, 5: l_shoulder, 6: r_shoulder, 7: l_elbow, 8: r_elbow,
    9: l_wrist, 10: r_wrist, 11: l_hip, 12: r_hip, 13: l_knee, 14: r_knee,
    15: l_ankle, 16: r_ankle.
    """
    # Default values if no person is detected or keypoints list is empty
    default_metrics = {
        "elbow_angle": 0.0,
        "knee_angle": 0.0,
        "spine_tilt": 0.0,
        "shoulder_alignment": 0.0,
        "balance_score": 100.0,
        "technique_score": 100.0,
        "warnings": []
    }
    
    if not keypoints or len(keypoints) < 17:
        return default_metrics

    # Check confidences to see if we have valid landmarks
    # For critical joints, check if confidence is reasonable
    l_shoulder = keypoints[5]
    r_shoulder = keypoints[6]
    l_elbow = keypoints[7]
    r_elbow = keypoints[8]
    l_wrist = keypoints[9]
    r_wrist = keypoints[10]
    l_hip = keypoints[11]
    r_hip = keypoints[12]
    l_knee = keypoints[13]
    r_knee = keypoints[14]
    l_ankle = keypoints[15]
    r_ankle = keypoints[16]

    is_right = dominant_hand.lower() == "right"

    # Select dominant arm and leg keypoints
    shoulder = r_shoulder if is_right else l_shoulder
    elbow = r_elbow if is_right else l_elbow
    wrist = r_wrist if is_right else l_wrist
    hip = r_hip if is_right else l_hip
    knee = r_knee if is_right else l_knee
    ankle = r_ankle if is_right else l_ankle

    # Calculate Elbow and Knee angles
    elbow_angle = calculate_angle(shoulder, elbow, wrist)
    knee_angle = calculate_angle(hip, knee, ankle)

    # Calculate Spine Tilt
    # Mid hip and shoulder coordinates
    mid_hip = {
        "x": (l_hip['x'] + r_hip['x']) / 2.0,
        "y": (l_hip['y'] + r_hip['y']) / 2.0
    }
    mid_shoulder = {
        "x": (l_shoulder['x'] + r_shoulder['x']) / 2.0,
        "y": (l_shoulder['y'] + r_shoulder['y']) / 2.0
    }
    # Vertical line going up from mid_hip (in image coordinates, y decreases going up)
    vertical_above_hip = {
        "x": mid_hip["x"],
        "y": mid_hip["y"] - 100.0
    }
    spine_tilt = calculate_angle(vertical_above_hip, mid_hip, mid_shoulder)

    # Calculate Shoulder Alignment
    # Angle of shoulder line relative to horizontal
    dx = l_shoulder['x'] - r_shoulder['x']
    dy = l_shoulder['y'] - r_shoulder['y']
    shoulder_alignment = abs(math.degrees(math.atan2(dy, dx)))
    # Map shoulder alignment relative to horizontal
    if shoulder_alignment > 90:
        shoulder_alignment = abs(180 - shoulder_alignment)

    # Calculate Balance Score
    # Scale hip level by hip distance to remain scale-invariant
    hip_dx = l_hip['x'] - r_hip['x']
    hip_dy = l_hip['y'] - r_hip['y']
    hip_dist = math.sqrt(hip_dx**2 + hip_dy**2)
    
    if hip_dist > 0:
        # Scale-invariant hip level ratio
        hip_level_ratio = abs(hip_dy) / hip_dist
        balance_score = max(0.0, min(100.0, 100.0 - hip_level_ratio * 150.0))
    else:
        balance_score = 100.0

    # Calculate technique score and warnings
    warnings = []
    technique_score = 100.0

    if analysis_type.lower() == "bowling":
        # Bowling technique rules
        if elbow_angle < 80:
            warnings.append("Elbow angle too low")
        if spine_tilt > 30:
            warnings.append("Excessive spine tilt")
        if shoulder_alignment > 15:
            warnings.append("Poor shoulder rotation")
            
        # Overall score formula
        elbow_score = max(0.0, 100.0 - abs(elbow_angle - 95.0))
        spine_score = max(0.0, 100.0 - spine_tilt * 2.0)
        alignment_score = max(0.0, 100.0 - shoulder_alignment * 2.0)
        
        technique_score = (
            balance_score * 0.25 +
            elbow_score * 0.25 +
            spine_score * 0.30 +
            alignment_score * 0.20
        )
    else:
        # Batting technique rules
        if knee_angle < 120:
            warnings.append("Front knee bent too much")
        if elbow_angle < 90:
            warnings.append("Low bat lift")
            
        # Overall score formula
        knee_score = max(0.0, 100.0 - abs(knee_angle - 150.0) * 0.5)
        spine_score = max(0.0, 100.0 - spine_tilt * 2.0)
        alignment_score = max(0.0, 100.0 - shoulder_alignment * 2.0)
        
        technique_score = (
            balance_score * 0.30 +
            knee_score * 0.30 +
            spine_score * 0.20 +
            alignment_score * 0.20
        )

    return {
        "elbow_angle": round(elbow_angle, 1),
        "knee_angle": round(knee_angle, 1),
        "spine_tilt": round(spine_tilt, 1),
        "shoulder_alignment": round(shoulder_alignment, 1),
        "balance_score": round(balance_score, 1),
        "technique_score": round(max(0.0, min(100.0, technique_score)), 1),
        "warnings": warnings
    }
