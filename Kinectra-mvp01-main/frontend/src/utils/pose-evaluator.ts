export interface Vector3D {
  x: number;
  y: number;
  z: number;
  visibility?: number;
}

export interface KinetraMetrics {
  elbowAngle: number;
  kneeAngle: number;
  shoulderAngle: number;
  hipAngle: number;
  shoulderAlignment: number;
  spineTilt: number;
  postureScore: number;
  balanceScore: number;
  techniqueScore: number;
  warnings: string[];
}

export const DEFAULT_METRICS: KinetraMetrics = {
  elbowAngle: 0,
  kneeAngle: 0,
  shoulderAngle: 0,
  hipAngle: 0,
  shoulderAlignment: 0,
  spineTilt: 0,
  postureScore: 100,
  balanceScore: 100,
  techniqueScore: 100,
  warnings: [],
};

export function calculateAngle(a: Vector3D, b: Vector3D, c: Vector3D): number {
  const v1 = { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
  const v2 = { x: c.x - b.x, y: c.y - b.y, z: c.z - b.z };
  
  const dot = v1.x * v2.x + v1.y * v2.y + v1.z * v2.z;
  const mag1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y + v1.z * v1.z);
  const mag2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y + v2.z * v2.z);
  
  if (mag1 === 0 || mag2 === 0) return 0;
  const clamped = Math.max(-1, Math.min(1, dot / (mag1 * mag2)));
  return (Math.acos(clamped) * 180.0) / Math.PI;
}

export function evaluatePose(
  landmarks: any[],
  analysisType: "bowling" | "batting" | "shooting" | "urdhva_hastasana",
  dominantHand: "right" | "left"
): KinetraMetrics {
  if (!landmarks || landmarks.length === 0) return DEFAULT_METRICS;
  
  // MediaPipe landmarks is an array of 33 keypoints
  const pose = landmarks[0];
  const isRight = dominantHand === "right";

  const lShoulder = pose[11], rShoulder = pose[12];
  const lElbow = pose[13], rElbow = pose[14];
  const lWrist = pose[15], rWrist = pose[16];
  const lHip = pose[23], rHip = pose[24];
  const lKnee = pose[25], rKnee = pose[26];
  const lAnkle = pose[27], rAnkle = pose[28];

  const shoulder = isRight ? rShoulder : lShoulder;
  const elbow = isRight ? rElbow : lElbow;
  const wrist = isRight ? rWrist : lWrist;
  const hip = isRight ? rHip : lHip;
  const knee = isRight ? rKnee : lKnee;
  const ankle = isRight ? rAnkle : lAnkle;

  // Calculate critical angles
  const elbowAngle = calculateAngle(shoulder, elbow, wrist);
  const kneeAngle = calculateAngle(hip, knee, ankle);
  
  // Hip angle: vertex is hip, endpoints are shoulder and knee
  const hipAngle = calculateAngle(shoulder, hip, knee);

  // Shoulder angle: vertex is shoulder, endpoints are hip and elbow
  const shoulderAngle = calculateAngle(hip, shoulder, elbow);

  // Spine Tilt & Shoulder Alignment
  const midHip = {
    x: (lHip.x + rHip.x) / 2,
    y: (lHip.y + rHip.y) / 2,
    z: (lHip.z + rHip.z) / 2,
  };
  const midShoulder = {
    x: (lShoulder.x + rShoulder.x) / 2,
    y: (lShoulder.y + rShoulder.y) / 2,
    z: (lShoulder.z + rShoulder.z) / 2,
  };
  const verticalAboveHip = { x: midHip.x, y: midHip.y - 1, z: midHip.z };
  const spineTilt = calculateAngle(verticalAboveHip, midHip, midShoulder);
  
  // Shoulder alignment relative to horizontal
  const shoulderAlignment = Math.abs(
    calculateAngle(rShoulder, lShoulder, {
      x: rShoulder.x,
      y: lShoulder.y,
      z: lShoulder.z,
    })
  );

  // Balance Score: standard symmetry metrics (hip level difference)
  const hipLevel = Math.abs(lHip.y - rHip.y);
  // Scale-invariant balance
  const hipDx = lHip.x - rHip.x;
  const hipDy = lHip.y - rHip.y;
  const hipDist = Math.sqrt(hipDx * hipDx + hipDy * hipDy);
  let balanceScore = 100;
  if (hipDist > 0) {
    const hipLevelRatio = Math.abs(hipDy) / hipDist;
    balanceScore = Math.max(0, Math.min(100, 100 - hipLevelRatio * 150));
  } else {
    balanceScore = Math.max(0, Math.min(100, 100 - hipLevel * 500));
  }

  // Posture Score (0-100): based on spine tilt stability and shoulder leveling
  const postureDeviation = spineTilt + shoulderAlignment;
  const postureScore = Math.max(0, Math.min(100, 100 - postureDeviation * 1.5));

  // Determine warnings and technique score
  const warnings: string[] = [];
  let techniqueScore = 100;

  if (analysisType === "bowling") {
    if (elbowAngle < 80) warnings.push("Elbow angle too low");
    if (spineTilt > 30) warnings.push("Excessive spine tilt");
    if (shoulderAlignment > 15) warnings.push("Poor shoulder rotation");
    if (hipAngle < 150) warnings.push("Hips bent excessively");

    // Bowling Technique Score weighted formula
    const elbowScore = Math.max(0, 100 - Math.abs(elbowAngle - 95));
    const spineScore = Math.max(0, 100 - spineTilt * 2);
    const alignmentScore = Math.max(0, 100 - shoulderAlignment * 2);
    const hipScore = Math.max(0, 100 - Math.abs(180 - hipAngle) * 1.5);

    techniqueScore =
      balanceScore * 0.20 +
      elbowScore * 0.25 +
      spineScore * 0.25 +
      alignmentScore * 0.15 +
      hipScore * 0.15;
  } else if (analysisType === "batting") {
    if (kneeAngle < 120) warnings.push("Front knee bent too much");
    if (elbowAngle < 90) warnings.push("Low bat lift");
    if (spineTilt > 25) warnings.push("Excessive spine tilt");
    if (hipAngle > 165 || hipAngle < 135) warnings.push("Poor batting stance");

    // Batting Technique Score weighted formula
    const kneeScore = Math.max(0, 100 - Math.abs(kneeAngle - 150) * 0.5);
    const spineScore = Math.max(0, 100 - spineTilt * 2);
    const alignmentScore = Math.max(0, 100 - shoulderAlignment * 2);
    const elbowScore = Math.max(0, 100 - Math.abs(elbowAngle - 100) * 0.8);

    techniqueScore =
      balanceScore * 0.25 +
      kneeScore * 0.25 +
      spineScore * 0.20 +
      alignmentScore * 0.15 +
      elbowScore * 0.15;
  } else if (analysisType === "shooting") {
    // Basketball Shooting follow-through and jump mechanics
    if (elbowAngle < 130) warnings.push("Incomplete follow-through");
    if (spineTilt > 18) warnings.push("Lean during jump shot");
    if (kneeAngle < 100) warnings.push("Excessive knee bend");

    const elbowScore = Math.max(0, 100 - Math.abs(165 - elbowAngle) * 1.5);
    const spineScore = Math.max(0, 100 - spineTilt * 3);
    const alignmentScore = Math.max(0, 100 - shoulderAlignment * 2);
    const kneeScore = Math.max(0, 100 - Math.max(0, 100 - kneeAngle) * 0.8);

    techniqueScore =
      balanceScore * 0.20 +
      elbowScore * 0.30 +
      spineScore * 0.30 +
      alignmentScore * 0.10 +
      kneeScore * 0.10;
  } else if (analysisType === "urdhva_hastasana") {
    // Yoga Urdhva Hastasana (Raised Hands Pose)
    if (shoulderAngle < 145) warnings.push("Raise arms fully overhead");
    if (elbowAngle < 155) warnings.push("Straighten your elbows");
    if (spineTilt > 12) warnings.push("Straighten your spine / torso");
    if (balanceScore < 85) warnings.push("Unstable foot balance");

    const shoulderScore = Math.max(0, 100 - Math.abs(170 - shoulderAngle) * 2.5);
    const elbowScore = Math.max(0, 100 - Math.abs(180 - elbowAngle) * 3);
    const spineScore = Math.max(0, 100 - spineTilt * 4);

    techniqueScore =
      balanceScore * 0.25 +
      shoulderScore * 0.25 +
      elbowScore * 0.25 +
      spineScore * 0.25;
  }

  return {
    elbowAngle: Math.round(elbowAngle),
    kneeAngle: Math.round(kneeAngle),
    shoulderAngle: Math.round(shoulderAngle),
    hipAngle: Math.round(hipAngle),
    shoulderAlignment: Math.round(shoulderAlignment),
    spineTilt: Math.round(spineTilt),
    postureScore: Math.round(postureScore),
    balanceScore: Math.round(balanceScore),
    techniqueScore: Math.max(0, Math.min(100, Math.round(techniqueScore))),
    warnings,
  };
}
