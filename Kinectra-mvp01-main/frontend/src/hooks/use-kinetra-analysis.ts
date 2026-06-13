import { useEffect, useRef, useState, useCallback } from "react";
import { PoseLandmarker, FilesetResolver, DrawingUtils } from "@mediapipe/tasks-vision";
import { SessionInputAnalysisType } from "@workspace/api-client-react";

interface Vector3D {
  x: number;
  y: number;
  z: number;
}

export interface KinetraMetrics {
  elbowAngle: number;
  kneeAngle: number;
  shoulderAlignment: number;
  spineTilt: number;
  headStability: number;
  balanceScore: number;
  techniqueScore: number;
  warnings: string[];
}

export interface KinetraAnalysisResult {
  isModelLoading: boolean;
  modelError: string | null;
  metrics: KinetraMetrics;
  startAnalysis: (videoElement: HTMLVideoElement, canvasElement: HTMLCanvasElement) => void;
  stopAnalysis: () => void;
}

const DEFAULT_METRICS: KinetraMetrics = {
  elbowAngle: 0,
  kneeAngle: 0,
  shoulderAlignment: 0,
  spineTilt: 0,
  headStability: 100,
  balanceScore: 100,
  techniqueScore: 100,
  warnings: [],
};

// Singleton cache for the PoseLandmarker to prevent multi-instance / re-creation crash
let sharedPoseLandmarker: PoseLandmarker | null = null;
let sharedPoseLandmarkerPromise: Promise<PoseLandmarker> | null = null;

function calculateAngle(a: Vector3D, b: Vector3D, c: Vector3D): number {
  const v1 = { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
  const v2 = { x: c.x - b.x, y: c.y - b.y, z: c.z - b.z };
  const dot = v1.x * v2.x + v1.y * v2.y + v1.z * v2.z;
  const mag1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y + v1.z * v1.z);
  const mag2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y + v2.z * v2.z);
  if (mag1 === 0 || mag2 === 0) return 0;
  const clamped = Math.max(-1, Math.min(1, dot / (mag1 * mag2)));
  return (Math.acos(clamped) * 180.0) / Math.PI;
}

// Map warning labels to joint coordinates to display dynamic highlight colors on the skeleton canvas
function getConnectionColor(
  start: number,
  end: number,
  warnings: string[],
  dominantHand: string,
  analysisType: SessionInputAnalysisType
): string {
  const isRight = dominantHand === "right";
  const warningSet = new Set(warnings);

  // Elbow Angle: Right (12-14, 14-16), Left (11-13, 13-15)
  const isDominantElbow = isRight
    ? (start === 12 && end === 14) || (start === 14 && end === 16)
    : (start === 11 && end === 13) || (start === 13 && end === 15);

  if (isDominantElbow) {
    if (analysisType === "bowling" && warningSet.has("Elbow angle too low")) {
      return "#ef4444"; // red
    }
    if (analysisType === "batting" && warningSet.has("Low bat lift")) {
      return "#f97316"; // orange
    }
  }

  // Spine/Torso: 11-12, 23-24, 11-23, 12-24
  const isTorso =
    (start === 11 && end === 12) ||
    (start === 23 && end === 24) ||
    (start === 11 && end === 23) ||
    (start === 12 && end === 24);

  if (isTorso) {
    if (analysisType === "bowling" && warningSet.has("Excessive spine tilt")) {
      return "#ef4444"; // red
    }
    if (analysisType === "batting" && warningSet.has("Balance unstable")) {
      return "#f97316"; // orange
    }
  }

  // Shoulders: 11-12
  const isShoulders = (start === 11 && end === 12);
  if (isShoulders) {
    if (analysisType === "bowling" && warningSet.has("Poor shoulder rotation")) {
      return "#f97316"; // orange
    }
  }

  // Knee Angle (lead leg front foot): Right Stance => Left Leg (23-25, 25-27), Left Stance => Right Leg (24-26, 26-28)
  const isFrontKnee = isRight
    ? (start === 23 && end === 25) || (start === 25 && end === 27)
    : (start === 24 && end === 26) || (start === 26 && end === 28);

  if (isFrontKnee) {
    if (analysisType === "batting" && warningSet.has("Front knee bent too much")) {
      return "#ef4444"; // red
    }
  }

  // Default correct posture color: green
  return "#22c55e";
}

function computePoseMetrics(
  landmarks: any[],
  analysisType: SessionInputAnalysisType,
  dominantHand: string
): KinetraMetrics {
  const pose = landmarks[0];
  const isRight = dominantHand === "right";

  const nose = pose[0];
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

  const elbowAngle = calculateAngle(shoulder, elbow, wrist);
  const kneeAngle = calculateAngle(hip, knee, ankle);

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
  const shoulderAlignment = Math.abs(
    calculateAngle(rShoulder, lShoulder, {
      x: rShoulder.x,
      y: lShoulder.y,
      z: lShoulder.z,
    })
  );

  const hipLevel = Math.abs(lHip.y - rHip.y);
  const balanceScore = Math.max(0, Math.min(100, 100 - hipLevel * 500));

  const warnings: string[] = [];
  let techniqueScore = 100;

  if (analysisType === "bowling") {
    if (elbowAngle < 80) warnings.push("Elbow angle too low");
    if (spineTilt > 30) warnings.push("Excessive spine tilt");
    if (shoulderAlignment > 15) warnings.push("Poor shoulder rotation");
    techniqueScore =
      balanceScore * 0.25 +
      Math.max(0, 100 - Math.abs(elbowAngle - 95)) * 0.25 +
      Math.max(0, 100 - spineTilt * 2) * 0.3 +
      Math.max(0, 100 - shoulderAlignment * 2) * 0.2;
  } else {
    if (kneeAngle < 120) warnings.push("Front knee bent too much");
    if (elbowAngle < 90) warnings.push("Low bat lift");
    techniqueScore =
      balanceScore * 0.3 +
      Math.max(0, 100 - Math.abs(kneeAngle - 150) * 0.5) * 0.3 +
      Math.max(0, 100 - spineTilt * 2) * 0.2 +
      Math.max(0, 100 - shoulderAlignment * 2) * 0.2;
  }

  return {
    elbowAngle: Math.round(elbowAngle),
    kneeAngle: Math.round(kneeAngle),
    shoulderAlignment: Math.round(shoulderAlignment),
    spineTilt: Math.round(spineTilt),
    headStability: 95,
    balanceScore: Math.round(balanceScore),
    techniqueScore: Math.max(0, Math.min(100, Math.round(techniqueScore))),
    warnings,
  };
}

export function useKinetraAnalysis(
  analysisType: SessionInputAnalysisType,
  dominantHand: string
): KinetraAnalysisResult {
  const [isModelLoading, setIsModelLoading] = useState(true);
  const [modelError, setModelError] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<KinetraMetrics>(DEFAULT_METRICS);

  const poseLandmarkerRef = useRef<PoseLandmarker | null>(null);
  const rafRef = useRef<number>(0);
  const isRunningRef = useRef(false);
  const lastVideoTimeRef = useRef(-1);
  const graphDeadRef = useRef(false);
  const lastInferenceTimeRef = useRef(0);
  const FPS_INTERVAL = 1000 / 15; // 15 fps

  // Load model once using the singleton promise
  useEffect(() => {
    let cancelled = false;
    async function init() {
      try {
        if (sharedPoseLandmarker) {
          poseLandmarkerRef.current = sharedPoseLandmarker;
          setIsModelLoading(false);
          return;
        }

        if (!sharedPoseLandmarkerPromise) {
          sharedPoseLandmarkerPromise = (async () => {
            const vision = await FilesetResolver.forVisionTasks(
              "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
            );
            return await PoseLandmarker.createFromOptions(vision, {
              baseOptions: {
                modelAssetPath:
                  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
                delegate: "GPU",
              },
              runningMode: "VIDEO",
              numPoses: 1,
            });
          })();
        }

        const landmarker = await sharedPoseLandmarkerPromise;
        sharedPoseLandmarker = landmarker;
        if (!cancelled) {
          poseLandmarkerRef.current = landmarker;
          setIsModelLoading(false);
        }
      } catch (err) {
        sharedPoseLandmarkerPromise = null; // allow retrying
        if (!cancelled) {
          setModelError("Failed to load vision model. Check your network connection.");
          setIsModelLoading(false);
        }
      }
    }
    init();
    return () => {
      cancelled = true;
      cancelAnimationFrame(rafRef.current);
      poseLandmarkerRef.current = null;
    };
  }, []);

  const analyzePose = useCallback(
    (landmarks: any[]) => {
      if (!landmarks || landmarks.length === 0) return DEFAULT_METRICS;
      const res = computePoseMetrics(landmarks, analysisType, dominantHand);
      setMetrics(res);
      return res;
    },
    [analysisType, dominantHand]
  );

  const startAnalysis = useCallback(
    (videoElement: HTMLVideoElement, canvasElement: HTMLCanvasElement) => {
      if (!poseLandmarkerRef.current) return;
      if (isRunningRef.current) return;

      isRunningRef.current = true;
      const ctx = canvasElement.getContext("2d");
      if (!ctx) return;
      const drawingUtils = new DrawingUtils(ctx);

      const loop = () => {
        if (!isRunningRef.current) return;

        const now = performance.now();

        // Strict validation of the video state and width/height to avoid ROI errors
        const videoWidth = videoElement.videoWidth;
        const videoHeight = videoElement.videoHeight;
        const readyState = videoElement.readyState;
        const isPaused = videoElement.paused;
        const hasStream = videoElement.srcObject !== null;

        const ready =
          readyState >= 2 &&
          videoWidth > 0 &&
          videoHeight > 0 &&
          !isPaused &&
          hasStream &&
          poseLandmarkerRef.current;

        if (ready) {
          if (canvasElement.width !== videoWidth || canvasElement.height !== videoHeight) {
            canvasElement.width = videoWidth;
            canvasElement.height = videoHeight;
          }

          const frameChanged = videoElement.currentTime !== lastVideoTimeRef.current;
          const throttleOk = now - lastInferenceTimeRef.current >= FPS_INTERVAL;

          if (frameChanged && throttleOk && !graphDeadRef.current) {
            lastVideoTimeRef.current = videoElement.currentTime;
            lastInferenceTimeRef.current = now;

            try {
              const result = poseLandmarkerRef.current!.detectForVideo(videoElement, now);
              ctx.save();
              ctx.clearRect(0, 0, canvasElement.width, canvasElement.height);

              if (result.landmarks && result.landmarks.length > 0) {
                // Calculate metrics synchronously for visual coupling with connection lines
                const currentMetrics = analyzePose(result.landmarks);
                const currentWarnings = currentMetrics.warnings;

                for (const landmark of result.landmarks) {
                  // Draw each connector with its specific highlight color based on active warnings
                  for (const connection of PoseLandmarker.POSE_CONNECTIONS) {
                    const color = getConnectionColor(
                      connection.start,
                      connection.end,
                      currentWarnings,
                      dominantHand,
                      analysisType
                    );
                    drawingUtils.drawConnectors(landmark, [connection], { color, lineWidth: 4 });
                  }

                  drawingUtils.drawLandmarks(landmark, {
                    color: "#ffffff",
                    lineWidth: 1.5,
                    radius: 3.5,
                  });
                }
              }
              ctx.restore();
            } catch (e) {
              console.error("MediaPipe detection error caught:", e);
              graphDeadRef.current = true;
              lastVideoTimeRef.current = -1;
              setTimeout(() => { graphDeadRef.current = false; }, 500);
            }
          }
        }

        rafRef.current = requestAnimationFrame(loop);
      };

      rafRef.current = requestAnimationFrame(loop);
    },
    [analyzePose, FPS_INTERVAL, dominantHand, analysisType]
  );

  const stopAnalysis = useCallback(() => {
    isRunningRef.current = false;
    cancelAnimationFrame(rafRef.current);
  }, []);

  return { isModelLoading, modelError, metrics, startAnalysis, stopAnalysis };
}
