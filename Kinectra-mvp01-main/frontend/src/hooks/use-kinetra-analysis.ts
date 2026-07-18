import { useEffect, useRef, useState, useCallback } from "react";
import { PoseLandmarker, FilesetResolver, DrawingUtils } from "@mediapipe/tasks-vision";
import { SessionInputAnalysisType } from "@workspace/api-client-react";
import { useSessionContext } from "@/contexts/SessionContext";
import { 
  KinetraMetrics, 
  DEFAULT_METRICS, 
  evaluatePose 
} from "@/utils/pose-evaluator";
import { arduinoHardware } from "@/utils/hardware-placeholder";

export interface KinetraAnalysisResult {
  isModelLoading: boolean;
  modelError: string | null;
  metrics: KinetraMetrics;
  startAnalysis: (videoElement: HTMLVideoElement, canvasElement: HTMLCanvasElement) => void;
  stopAnalysis: () => void;
}

// Singleton cache for the PoseLandmarker to prevent multi-instance / re-creation crash
let sharedPoseLandmarker: PoseLandmarker | null = null;
let sharedPoseLandmarkerPromise: Promise<PoseLandmarker> | null = null;

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
    if (analysisType === "shooting" && warningSet.has("Incomplete follow-through")) {
      return "#f97316"; // orange
    }
    if (analysisType === "urdhva_hastasana" && warningSet.has("Straighten your elbows")) {
      return "#f97316"; // orange
    }
  }

  // Shoulders & Arms: Right (12-14, 14-16), Left (11-13, 13-15), 11-12 (Shoulders)
  const isShoulderExtension =
    (start === 11 && end === 13) ||
    (start === 12 && end === 14) ||
    (start === 11 && end === 12);
  
  if (isShoulderExtension) {
    if (analysisType === "urdhva_hastasana" && warningSet.has("Raise arms fully overhead")) {
      return "#ef4444"; // red
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
    if (analysisType === "shooting" && warningSet.has("Lean during jump shot")) {
      return "#ef4444"; // red
    }
    if (analysisType === "urdhva_hastasana" && warningSet.has("Straighten your spine / torso")) {
      return "#ef4444"; // red
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
    if (analysisType === "shooting" && warningSet.has("Excessive knee bend")) {
      return "#f97316"; // orange
    }
  }

  // Default correct posture color: green
  return "#22c55e";
}


export function useKinetraAnalysis(
  analysisType: SessionInputAnalysisType,
  dominantHand: string,
  poseProcessorInput: "local" | "npu" = "local"
): KinetraAnalysisResult {
  const poseProcessor: "local" | "npu" = "local";
  const { config } = useSessionContext();
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

  // Refs for NPU mode canvas rendering
  const currentCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const currentCanvasCtxRef = useRef<CanvasRenderingContext2D | null>(null);
  const currentDrawingUtilsRef = useRef<DrawingUtils | null>(null);
  const isProcessingFrameRef = useRef(false);
  const currentSessionIdRef = useRef<string | null>(null);

  // Keep latest parameters in refs so WebSocket handler has access without closure stale state
  const currentAnalysisTypeRef = useRef(analysisType);
  const currentDominantHandRef = useRef(dominantHand);
  
  useEffect(() => {
    currentAnalysisTypeRef.current = analysisType;
    currentDominantHandRef.current = dominantHand;
  }, [analysisType, dominantHand]);

  useEffect(() => {
    currentSessionIdRef.current = config.sessionId;
  }, [config.sessionId]);

  const wsRef = useRef<WebSocket | null>(null);

  // Load model OR initialize WebSocket connection based on poseProcessor
  useEffect(() => {
    let cancelled = false;

    if ((poseProcessor as string) === "npu") {
      let socket: WebSocket | null = null;
      let isMounted = true;

      const connect = () => {
        if (!isMounted) return;
        const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
        // Connect directly to backend at port 8000
        const wsUrl = `${protocol}//${window.location.hostname}:8000/api/analysis/ws`;
        console.log(`Connecting to NPU Pose API WebSocket: ${wsUrl}`);
        socket = new WebSocket(wsUrl);

        socket.onopen = () => {
          if (!isMounted) {
            socket?.close();
            return;
          }
          console.log("Kinetra NPU WebSocket connected!");
          setModelError(null);
          setIsModelLoading(false);
        };

        socket.onclose = () => {
          console.log("Kinetra NPU WebSocket connection closed.");
          if (isMounted) {
            // Reconnect in 3s
            setTimeout(connect, 3000);
          }
        };

        socket.onerror = (e) => {
          console.error("Kinetra NPU WebSocket error:", e);
          if (isMounted) {
            setModelError("FastAPI Backend WebSocket connection failed. Verify server is running.");
          }
        };

        socket.onmessage = (event) => {
          if (!isMounted) return;
          try {
            const data = JSON.parse(event.data);
            if (data.error) {
              console.warn("NPU error response:", data.error);
              isProcessingFrameRef.current = false;
              return;
            }

            // Update metrics from backend
            const backendMetrics: KinetraMetrics = {
              elbowAngle: Math.round(data.angles?.elbow_angle || 0),
              kneeAngle: Math.round(data.angles?.knee_angle || 0),
              shoulderAngle: Math.round(data.angles?.shoulder_angle || 0),
              hipAngle: Math.round(data.angles?.hip_angle || 0),
              shoulderAlignment: Math.round(data.angles?.shoulder_alignment || 0),
              spineTilt: Math.round(data.angles?.spine_tilt || 0),
              postureScore: Math.round(data.score?.posture_score || 100),
              balanceScore: Math.round(data.score?.balance_score || 100),
              techniqueScore: Math.round(data.score?.technique_score || 100),
              warnings: data.warnings || [],
            };
            setMetrics(backendMetrics);

            // Draw skeleton overlay
            if (
              data.landmarks &&
              data.landmarks.length > 0 &&
              currentCanvasCtxRef.current &&
              currentCanvasRef.current
            ) {
              const ctx = currentCanvasCtxRef.current;
              const canvas = currentCanvasRef.current;
              ctx.save();
              ctx.clearRect(0, 0, canvas.width, canvas.height);

              // Map YOLO 17 keypoints -> MP 33 keypoints
              const yoloToMpMap: Record<number, number> = {
                0: 0,   // nose
                1: 2,   // left eye
                2: 5,   // right eye
                3: 7,   // left ear
                4: 8,   // right ear
                5: 11,  // left shoulder
                6: 12,  // right shoulder
                7: 13,  // left elbow
                8: 14,  // right elbow
                9: 15,  // left wrist
                10: 16, // right wrist
                11: 23, // left hip
                12: 24, // right hip
                13: 25, // left knee
                14: 26, // right knee
                15: 27, // left ankle
                16: 28, // right ankle
              };

              const mpLandmarks = Array(33).fill(null).map(() => ({ x: 0, y: 0, z: 0, visibility: 0 }));
              data.landmarks.forEach((kp: any, idx: number) => {
                const mpIdx = yoloToMpMap[idx];
                if (mpIdx !== undefined) {
                  mpLandmarks[mpIdx] = {
                    x: kp.x / canvas.width,
                    y: kp.y / canvas.height,
                    z: 0,
                    visibility: kp.confidence
                  };
                }
              });

              const currentWarnings = backendMetrics.warnings;
              const drawingUtils = currentDrawingUtilsRef.current;

              if (drawingUtils) {
                // Draw links
                for (const connection of PoseLandmarker.POSE_CONNECTIONS) {
                  const color = getConnectionColor(
                    connection.start,
                    connection.end,
                    currentWarnings,
                    currentDominantHandRef.current,
                    currentAnalysisTypeRef.current
                  );
                  const startLandmark = mpLandmarks[connection.start];
                  const endLandmark = mpLandmarks[connection.end];
                  if (
                    startLandmark &&
                    endLandmark &&
                    (startLandmark.x !== 0 || startLandmark.y !== 0) &&
                    (endLandmark.x !== 0 || endLandmark.y !== 0)
                  ) {
                    drawingUtils.drawConnectors(mpLandmarks, [connection], { color, lineWidth: 4 });
                  }
                }

                // Draw node circles
                const validLandmarks = mpLandmarks.filter(lm => lm.x !== 0 || lm.y !== 0);
                drawingUtils.drawLandmarks(validLandmarks, {
                  color: "#ffffff",
                  lineWidth: 1.5,
                  radius: 3.5,
                });
              }
              ctx.restore();
            }

            isProcessingFrameRef.current = false;
          } catch (err) {
            console.error("Failed parsing message:", err);
            isProcessingFrameRef.current = false;
          }
        };

        wsRef.current = socket;
      };

      setIsModelLoading(true);
      connect();

      return () => {
        isMounted = false;
        if (socket) {
          socket.close();
        }
        wsRef.current = null;
      };
    } else {
      // Local MediaPipe initialization (Option B)
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
          sharedPoseLandmarkerPromise = null;
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
    }
  }, [poseProcessor]);

  const analyzePose = useCallback(
    (landmarks: any[]) => {
      if (!landmarks || landmarks.length === 0) return DEFAULT_METRICS;
      const res = evaluatePose(landmarks, analysisType as any, dominantHand as "left" | "right");
      setMetrics(res);
      return res;
    },
    [analysisType, dominantHand]
  );

  const startAnalysis = useCallback(
    (videoElement: HTMLVideoElement, canvasElement: HTMLCanvasElement) => {
      if (isRunningRef.current) return;
      if (poseProcessor === "local" && !poseLandmarkerRef.current) return;

      isRunningRef.current = true;
      const ctx = canvasElement.getContext("2d");
      if (!ctx) return;
      const drawingUtils = new DrawingUtils(ctx);

      // Save references for WebSocket NPU loop drawing
      currentCanvasRef.current = canvasElement;
      currentCanvasCtxRef.current = ctx;
      currentDrawingUtilsRef.current = drawingUtils;
      isProcessingFrameRef.current = false;

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
          hasStream;

        if (ready) {
          if (canvasElement.width !== videoWidth || canvasElement.height !== videoHeight) {
            canvasElement.width = videoWidth;
            canvasElement.height = videoHeight;
          }

          const frameChanged = videoElement.currentTime !== lastVideoTimeRef.current;
          const throttleOk = now - lastInferenceTimeRef.current >= FPS_INTERVAL;

          if (frameChanged && throttleOk) {
            lastVideoTimeRef.current = videoElement.currentTime;
            lastInferenceTimeRef.current = now;

            if ((poseProcessor as string) === "npu") {
              // WebSocket streaming mode
              if (
                wsRef.current &&
                wsRef.current.readyState === WebSocket.OPEN &&
                !isProcessingFrameRef.current
              ) {
                isProcessingFrameRef.current = true;

                // Draw frame to capture canvas
                const captureCanvas = document.createElement("canvas");
                captureCanvas.width = videoWidth;
                captureCanvas.height = videoHeight;
                const captureCtx = captureCanvas.getContext("2d");
                if (captureCtx) {
                  captureCtx.drawImage(videoElement, 0, 0, videoWidth, videoHeight);
                  const base64Frame = captureCanvas.toDataURL("image/jpeg", 0.6);

                  const payload = {
                    frame: base64Frame,
                    session_id: currentSessionIdRef.current || "default_session",
                    analysis_type: analysisType,
                    dominant_hand: dominantHand,
                  };
                  wsRef.current.send(JSON.stringify(payload));
                } else {
                  isProcessingFrameRef.current = false;
                }
              }
            } else if (poseLandmarkerRef.current && !graphDeadRef.current) {
              // Local Browser MediaPipe Mode
              try {
                const result = poseLandmarkerRef.current.detectForVideo(videoElement, now);
                ctx.save();
                ctx.clearRect(0, 0, canvasElement.width, canvasElement.height);

                if (result.landmarks && result.landmarks.length > 0) {
                  const currentMetrics = analyzePose(result.landmarks);
                  const currentWarnings = currentMetrics.warnings;

                  for (const landmark of result.landmarks) {
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
        }

        rafRef.current = requestAnimationFrame(loop);
      };

      rafRef.current = requestAnimationFrame(loop);
    },
    [analyzePose, FPS_INTERVAL, dominantHand, analysisType, poseProcessor]
  );

  const stopAnalysis = useCallback(() => {
    isRunningRef.current = false;
    cancelAnimationFrame(rafRef.current);
    currentCanvasRef.current = null;
    currentCanvasCtxRef.current = null;
    currentDrawingUtilsRef.current = null;
    isProcessingFrameRef.current = false;
    arduinoHardware.setLedStatus("off");
  }, []);

  // Sync Arduino status (searching / active / success / warning) based on app state
  const lastBuzzerTimeRef = useRef(0);
  useEffect(() => {
    if (isModelLoading) {
      arduinoHardware.setLedStatus("searching");
      return;
    }

    if (!isRunningRef.current) {
      arduinoHardware.setLedStatus("off");
      return;
    }

    if (metrics.warnings.length > 0) {
      arduinoHardware.setLedStatus("warning");
      const now = Date.now();
      if (now - lastBuzzerTimeRef.current > 4000) {
        lastBuzzerTimeRef.current = now;
        arduinoHardware.triggerBuzzer("warning_alarm");
      }
    } else if (metrics.techniqueScore >= 90) {
      arduinoHardware.setLedStatus("success");
      const now = Date.now();
      if (now - lastBuzzerTimeRef.current > 6000) {
        lastBuzzerTimeRef.current = now;
        arduinoHardware.triggerBuzzer("success_chime");
      }
    } else {
      arduinoHardware.setLedStatus("active");
    }
  }, [isModelLoading, metrics.warnings, metrics.techniqueScore]);

  return { isModelLoading, modelError, metrics, startAnalysis, stopAnalysis };
}
