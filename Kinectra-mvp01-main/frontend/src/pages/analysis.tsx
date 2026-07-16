import { useEffect, useRef, useState, useCallback } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  Activity,
  AlertTriangle,
  Camera,
  CheckCircle2,
  Loader2,
  StopCircle,
  Zap,
  BarChart2,
  Sparkles,
  Info,
  Play,
  Volume2,
  Mic,
  Trash2,
  Maximize2
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useSessionContext } from "@/contexts/SessionContext";
import { useEndSession } from "@workspace/api-client-react";
import { useKinetraAnalysis } from "@/hooks/use-kinetra-analysis";
import { KinectraLogo } from "@/components/layout/KinectraLogo";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent } from "@/components/ui/card";

export default function Analysis() {
  const [, setLocation] = useLocation();
  const { config } = useSessionContext();
  const { toast } = useToast();

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const cameraStartedRef = useRef(false);

  const { isModelLoading, modelError, metrics, startAnalysis, stopAnalysis } =
    useKinetraAnalysis(config.analysisType, config.dominantHand);

  const endSessionMutation = useEndSession();

  const statsRef = useRef({
    frames: 0,
    postureSum: 0,
    alignmentSum: 0,
    stabilitySum: 0,
    efficiencySum: 0,
  });

  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // ───────────────── VOICE, SNAPSHOT, & RECORDING STATES ─────────────────
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);

  const [isSpeaking, setIsSpeaking] = useState(false);
  const [transcript, setTranscript] = useState("Hello! I am Coach Aryan. Ready to begin your session?");
  const lastSpeechTimeRef = useRef<number>(0);
  const lastSnapshotTimeRef = useRef<number>(0);
  const lastUpdateIntervalTimeRef = useRef<number>(0);
  const rotationIndexRef = useRef<number>(0);
  const lastActiveMessageRef = useRef<string>("");

  const [snapshots, setSnapshots] = useState<Array<{
    id: string;
    timestamp: string;
    type: "perfect" | "mistake";
    image: string;
    label: string;
    correction: string;
    score: number;
  }>>([]);

  const [selectedSnapshot, setSelectedSnapshot] = useState<any | null>(null);

  // ───────────────── CAMERA SETUP ─────────────────
  useEffect(() => {
    if (!config.sessionId) {
      setLocation("/setup");
      return;
    }

    if (cameraStartedRef.current) return;
    cameraStartedRef.current = true;

    let stream: MediaStream | null = null;

    const startCamera = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            facingMode: "user",
          },
        });

        const video = videoRef.current;
        if (!video) return;

        video.srcObject = stream;
        await video.play().catch(() => {});

        setHasCameraPermission(true);
      } catch (err) {
        console.error(err);
        setHasCameraPermission(false);
      }
    };

    startCamera();

    return () => {
      stopAnalysis();
      stream?.getTracks().forEach((t) => t.stop());
      cameraStartedRef.current = false;
    };
  }, [config.sessionId, setLocation, stopAnalysis]);

  // ───────────────── START ANALYSIS ─────────────────
  useEffect(() => {
    if (!hasCameraPermission || isModelLoading) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (!video || !canvas) return;

    let cancelled = false;

    const start = async () => {
      await video.play().catch(() => {});

      const waitForFrame = () => {
        if (cancelled) return;

        if (video.videoWidth > 0 && video.videoHeight > 0) {
          startAnalysis(video, canvas);
        } else {
          requestAnimationFrame(waitForFrame);
        }
      };

      waitForFrame();
    };

    start();

    return () => {
      cancelled = true;
    };
  }, [hasCameraPermission, isModelLoading, startAnalysis]);

  // ───────────────── SECONDS TIMER ─────────────────
  useEffect(() => {
    if (!hasCameraPermission || isModelLoading) return;

    const interval = setInterval(() => {
      setElapsedSeconds((s) => s + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [hasCameraPermission, isModelLoading]);

  // ───────────────── STATS ACCUMULATION (ON FRAME) ─────────────────
  useEffect(() => {
    if (!hasCameraPermission || isModelLoading) return;

    // Accumulate metrics on every frame update
    statsRef.current.frames += 1;
    statsRef.current.postureSum += metrics.spineTilt > 30 ? 50 : 90;
    statsRef.current.alignmentSum += metrics.shoulderAlignment < 10 ? 95 : 60;
    statsRef.current.stabilitySum += metrics.balanceScore;
    statsRef.current.efficiencySum += metrics.techniqueScore;
  }, [hasCameraPermission, isModelLoading, metrics]);

  // ───────────────── TTS AND AUTO-SNAPSHOT TRIGGERS ─────────────────
  const speak = useCallback((text: string) => {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    
    const utterance = new SpeechSynthesisUtterance(text);
    const voices = window.speechSynthesis.getVoices();
    const englishVoice = voices.find(
      (v) =>
        v.lang.startsWith("en") &&
        (v.name.includes("Google") || v.name.includes("Microsoft") || v.name.includes("Male"))
    );
    if (englishVoice) {
      utterance.voice = englishVoice;
    }
    
    utterance.onstart = () => {
      setIsSpeaking(true);
      setTranscript(text);
    };
    utterance.onend = () => {
      setIsSpeaking(false);
    };
    utterance.onerror = () => {
      setIsSpeaking(false);
    };
    window.speechSynthesis.speak(utterance);
  }, []);

  const captureSnapshot = useCallback((type: "perfect" | "mistake", label: string, correction: string, score: number) => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;
    const ctx = tempCanvas.getContext("2d");
    if (!ctx) return;

    // Draw video mirrored
    ctx.translate(tempCanvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, tempCanvas.width, tempCanvas.height);
    
    // Draw skeleton on top
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(canvas, 0, 0);

    const dataUrl = tempCanvas.toDataURL("image/jpeg", 0.7);

    setSnapshots((prev) => {
      const newSnapshots = [
        {
          id: Math.random().toString(36).substring(7),
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          type,
          image: dataUrl,
          label,
          correction,
          score,
        },
        ...prev,
      ];
      return newSnapshots.slice(0, 8); // Keep last 8 snapshots
    });
  }, []);

  useEffect(() => {
    if (!hasCameraPermission || isModelLoading) return;

    const now = Date.now();
    // Only update coaching advice and check speech every 3 seconds (3000ms)
    if (now - lastUpdateIntervalTimeRef.current < 3000) return;

    // Normalize shoulder alignment angle (tilt is 0-90, alignment is 180 - tilt)
    const shoulderAngle = metrics.shoulderAlignment > 90 ? metrics.shoulderAlignment : 180 - metrics.shoulderAlignment;

    const candidates = [
      {
        name: "elbow",
        active: metrics.elbowAngle < 140 && metrics.elbowAngle > 0,
        severity: (140 - metrics.elbowAngle) / 140,
        msg: "Straighten your bowling arm",
        label: "Elbow Drop",
        correction: "Lock bowling elbow, aim high next to your ear."
      },
      {
        name: "knee",
        active: metrics.kneeAngle > 50,
        severity: (metrics.kneeAngle - 50) / 50,
        msg: "Drive your knee higher",
        label: "Knee Over-Bend",
        correction: "Straighten lead knee slightly to firm up foundation."
      },
      {
        name: "spine",
        active: metrics.spineTilt > 25,
        severity: (metrics.spineTilt - 25) / 25,
        msg: "Keep your spine upright",
        label: "Spine Tilt",
        correction: "Engage core muscles to prevent leaning sideways."
      },
      {
        name: "shoulder",
        active: shoulderAngle < 160 && shoulderAngle > 0,
        severity: (160 - shoulderAngle) / 160,
        msg: "Align your shoulders",
        label: "Shoulder Rotation",
        correction: "Hold non-bowling shoulder aligned with target."
      },
      {
        name: "balance",
        active: metrics.balanceScore < 70 && metrics.balanceScore > 0,
        severity: (70 - metrics.balanceScore) / 70,
        msg: "Shift weight to front foot",
        label: "Balance Unstable",
        correction: "Focus on stable landing mechanics and plant front foot."
      }
    ];

    const activeDeviations = candidates.filter(c => c.active);
    
    // Sort active deviations by severity descending (worst joint first)
    activeDeviations.sort((a, b) => b.severity - a.severity);

    let targetAdvice = "Excellent technique, keep it up!";
    let isWarning = false;
    let worstJoint = null;

    if (activeDeviations.length > 0) {
      isWarning = true;
      const idx = rotationIndexRef.current % activeDeviations.length;
      worstJoint = activeDeviations[idx];
      targetAdvice = worstJoint.msg;
      rotationIndexRef.current = (rotationIndexRef.current + 1) % activeDeviations.length;
    } else {
      rotationIndexRef.current = 0;
    }

    setTranscript(targetAdvice);

    // Speak only when the advice changes to avoid self-interruptions
    if (targetAdvice !== lastActiveMessageRef.current) {
      speak(targetAdvice);
      lastActiveMessageRef.current = targetAdvice;
    }

    // Trigger auto-snapshots at standard frequency
    const canSnapshot = now - lastSnapshotTimeRef.current > 5000;
    if (canSnapshot) {
      if (isWarning && worstJoint) {
        captureSnapshot("mistake", worstJoint.label, worstJoint.correction, metrics.techniqueScore);
        lastSnapshotTimeRef.current = now;
      } else if (!isWarning && metrics.techniqueScore >= 95) {
        captureSnapshot("perfect", "Perfect Form", "Excellent alignment and balance.", metrics.techniqueScore);
        lastSnapshotTimeRef.current = now;
      }
    }

    lastUpdateIntervalTimeRef.current = now;
  }, [hasCameraPermission, isModelLoading, metrics, speak, captureSnapshot]);

  // ───────────────── RECORDING PIPELINE ─────────────────
  const startRecording = useCallback(() => {
    setIsRecording(true);
    recordedChunksRef.current = [];
    
    const video = videoRef.current;
    if (!video) return;
    
    const stream = video.srcObject as MediaStream;
    if (!stream) return;
    
    try {
      const options = { mimeType: "video/webm;codecs=vp8" };
      const mediaRecorder = new MediaRecorder(stream, options);
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };
      
      mediaRecorder.start(1000);
      mediaRecorderRef.current = mediaRecorder;
      toast({
        title: "Recording Session Started",
        description: "Saving video stream and telemetry data in background.",
      });
    } catch (e) {
      console.error(e);
    }
  }, [toast]);

  const stopRecording = useCallback(() => {
    setIsRecording(false);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    toast({
      title: "Recording Saved",
      description: "Auto-snapshots generated and synced to results report.",
    });
  }, [toast]);

  // ───────────────── END SESSION ─────────────────
  const handleEndSession = useCallback(() => {
    if (!config.sessionId) return;

    stopAnalysis();

    if (isRecording) {
      stopRecording();
    }

    const n = Math.max(1, statsRef.current.frames);

    const avgPosture = Math.round(statsRef.current.postureSum / n);
    const avgAlignment = Math.round(statsRef.current.alignmentSum / n);
    const avgStability = Math.round(statsRef.current.stabilitySum / n);
    const avgEfficiency = Math.round(statsRef.current.efficiencySum / n);

    const overallScore = Math.round(
      avgPosture * 0.3 +
        avgAlignment * 0.25 +
        avgStability * 0.25 +
        avgEfficiency * 0.2
    );

    endSessionMutation.mutate(
      {
        sessionId: config.sessionId,
        data: {
          frameCount: statsRef.current.frames,
          avgPostureScore: avgPosture,
          avgAlignmentScore: avgAlignment,
          avgStabilityScore: avgStability,
          avgEfficiencyScore: avgEfficiency,
          overallScore,
          warnings: metrics.warnings,
          snapshots: JSON.stringify(snapshots), // Save auto-captured snapshots to db!
        },
      },
      {
        onSuccess: () => setLocation(`/results/${config.sessionId}`),
        onError: () =>
          toast({
            variant: "destructive",
            title: "Error ending session",
            description: "Failed to persist analysis session records.",
          }),
      }
    );
  }, [config.sessionId, stopAnalysis, endSessionMutation, metrics.warnings, setLocation, toast, snapshots, isRecording, stopRecording]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  const getStatusColor = (score: number) => {
    if (score >= 80) return "text-emerald-500 bg-emerald-500/10 border-emerald-500/20";
    if (score >= 60) return "text-orange-500 bg-orange-500/10 border-orange-500/20";
    return "text-red-500 bg-red-500/10 border-red-500/20";
  };

  const getScoreLabel = (score: number) => {
    if (score >= 80) return "EXCELLENT";
    if (score >= 60) return "WARNING";
    return "CRITICAL";
  };

  return (
    <div className="h-screen w-full flex flex-col bg-gray-950 font-sans text-gray-100 overflow-y-auto md:overflow-hidden relative pb-20 md:pb-0">
      
      {/* HEADER SECTION */}
      <header className="h-16 border-b border-white/5 bg-gray-900/60 backdrop-blur-md px-6 flex items-center justify-between z-10 shrink-0">
        <div className="flex items-center gap-3">
          <KinectraLogo className="w-9 h-9" />
          <div>
            <h1 className="text-sm font-bold tracking-wider text-gray-200">KINETRA LABS</h1>
            <p className="text-[10px] text-gray-400 font-mono tracking-widest uppercase">
              Autonomous Coaching Hub
            </p>
          </div>
        </div>

        <div className="flex items-center gap-6 font-mono text-xs text-gray-300">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-white/5 border border-white/10">
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            <span className="text-gray-400 uppercase">Athlete:</span>
            <span className="font-bold text-gray-100">{config.athleteName}</span>
          </div>
          
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-white/5 border border-white/10">
            <span className="text-gray-400 uppercase">Discipline:</span>
            <span className="font-bold text-primary capitalize">{config.analysisType}</span>
          </div>

          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-white/5 border border-white/10">
            <span className="text-gray-400 uppercase">Time:</span>
            <span className="font-bold text-gray-100">{formatTime(elapsedSeconds)}</span>
          </div>
        </div>

        <Button 
          variant="destructive" 
          onClick={handleEndSession}
          className="shadow-lg shadow-red-950/20 font-semibold gap-2 border border-red-500/20"
        >
          <StopCircle className="h-4 w-4" /> End Session
        </Button>
      </header>

      {/* WORKSPACE AREA */}
      <div className="flex-1 flex flex-col min-h-0 relative w-full">
        
        {/* SCORE CARD (Mobile Only) */}
        <div className="flex md:hidden items-center justify-between px-4 py-2.5 mx-4 mt-3 bg-gray-900 border border-white/5 rounded-xl shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-gray-400 font-bold tracking-wider uppercase">Form Score</span>
            <span className="text-sm font-bold font-mono text-emerald-500">{metrics.techniqueScore}/100</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-gray-400 font-bold tracking-wider uppercase">Injury Risk</span>
            <span className={`text-[10px] font-bold font-mono py-0.5 px-2 rounded-md ${
              metrics.techniqueScore < 60 ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 
              metrics.techniqueScore < 80 ? 'bg-orange-500/10 text-orange-400 border border-orange-500/20' : 
              'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
            }`}>
              {metrics.techniqueScore < 60 ? 'HIGH' : metrics.techniqueScore < 80 ? 'MEDIUM' : 'LOW'}
            </span>
          </div>
        </div>

        {/* Webcam Feed with Pose Skeleton overlay */}
        <div className="w-full bg-gray-950 p-4 md:p-5 flex flex-col justify-between min-h-0">
          <div className="flex items-center justify-between mb-3 shrink-0">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
              <Camera className="h-3.5 w-3.5 text-primary" /> Live Player Feed
            </span>
            {isRecording && (
              <span className="text-[10px] font-mono text-red-500 bg-red-500/10 px-2 py-0.5 rounded border border-red-500/20 animate-pulse flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                RECORDING
              </span>
            )}
          </div>

          <div className="h-[50vh] md:h-[70vh] min-h-[50vh] md:min-h-[70vh] max-h-[50vh] md:max-h-[70vh] shrink-0 w-full relative rounded-xl overflow-hidden border border-white/10 bg-black flex items-center justify-center shadow-lg">
            <video
              ref={videoRef}
              playsInline
              muted
              className="w-full h-full object-cover scale-x-[-1]"
            />
            <canvas
              ref={canvasRef}
              className="absolute inset-0 w-full h-full object-contain scale-x-[-1] z-10 pointer-events-none"
            />
            {hasCameraPermission === false && (
              <div className="absolute inset-0 flex flex-col items-center justify-center p-4 bg-gray-950/90 text-center">
                <AlertTriangle className="h-8 w-8 text-red-500 mb-2" />
                <p className="text-sm font-semibold">Camera Access Denied</p>
                <p className="text-xs text-gray-400 mt-1">Please enable camera permission in your browser settings.</p>
              </div>
            )}
            {isModelLoading && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-950/90 z-20">
                <Loader2 className="h-8 w-8 text-primary animate-spin mb-3" />
                <p className="text-sm font-semibold text-gray-200">Initializing Core CV Engine...</p>
                <p className="text-xs text-gray-400 mt-1">Downloading pose landmarker packages...</p>
              </div>
            )}
            {modelError && (
              <div className="absolute inset-0 flex flex-col items-center justify-center p-4 bg-gray-950/95 text-center">
                <AlertTriangle className="h-8 w-8 text-red-500 mb-2" />
                <p className="text-sm font-semibold text-red-400">Model Initialisation Error</p>
                <p className="text-xs text-gray-400 mt-1">{modelError}</p>
              </div>
            )}
          </div>
          <div className="mt-2 text-[10px] font-mono text-gray-500 uppercase tracking-wider shrink-0 text-center">
            Real-time client-side coordinate mapping overlaid.
          </div>
        </div>

        {/* MOBILE BIOMECHANICS STATS & CONTROLS */}
        <div className="flex md:hidden flex-col gap-4 px-4 py-3 bg-gray-900/60 border-t border-white/5">
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white/3 border border-white/5 rounded-xl p-2.5 flex flex-col justify-between">
              <span className="text-[10px] text-gray-400 font-bold tracking-wider uppercase">Elbow Angle</span>
              <div className="text-xs font-bold font-mono text-primary mt-1" style={{ fontSize: '12px' }}>{metrics.elbowAngle}°</div>
            </div>
            
            <div className="bg-white/3 border border-white/5 rounded-xl p-2.5 flex flex-col justify-between">
              <span className="text-[10px] text-gray-400 font-bold tracking-wider uppercase">Knee Angle</span>
              <div className="text-xs font-bold font-mono text-gray-200 mt-1" style={{ fontSize: '12px' }}>{metrics.kneeAngle}°</div>
            </div>

            <div className="bg-white/3 border border-white/5 rounded-xl p-2.5 flex flex-col justify-between">
              <span className="text-[10px] text-gray-400 font-bold tracking-wider uppercase">Spine Tilt</span>
              <div className="text-xs font-bold font-mono text-gray-200 mt-1" style={{ fontSize: '12px' }}>{metrics.spineTilt}°</div>
            </div>

            <div className="bg-white/3 border border-white/5 rounded-xl p-2.5 flex flex-col justify-between">
              <span className="text-[10px] text-gray-400 font-bold tracking-wider uppercase">Balance Score</span>
              <div className="text-xs font-bold font-mono text-gray-200 mt-1" style={{ fontSize: '12px' }}>{metrics.balanceScore}%</div>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            {!isRecording ? (
              <Button 
                onClick={startRecording}
                className="bg-red-500 text-white font-semibold flex items-center justify-center gap-2 hover:bg-red-600 shadow-md shadow-red-950/20 w-full"
              >
                <span className="w-2.5 h-2.5 rounded-full bg-white animate-pulse" />
                Record Session
              </Button>
            ) : (
              <Button 
                onClick={stopRecording}
                className="bg-gray-800 border border-white/10 text-white font-semibold flex items-center justify-center gap-2 hover:bg-gray-700 w-full"
              >
                <StopCircle className="h-4 w-4 text-red-500" />
                Stop Recording
              </Button>
            )}

            <Button 
              onClick={handleEndSession}
              variant="outline"
              className="font-semibold w-full"
            >
              <BarChart2 className="h-4 w-4 mr-2" /> View Analysis Report
            </Button>
          </div>
        </div>

      </div>

      {/* METRICS PANEL & ACTION BUTTONS (Desktop Only) */}
      <div className="hidden md:flex h-44 border-t border-white/5 bg-gray-900/60 p-4 gap-6 shrink-0 z-10">
        
        {/* Core Metrics panel widgets */}
        <div className="flex-1 grid grid-cols-6 gap-3 items-center">
          <div className="bg-white/3 border border-white/5 rounded-xl p-2.5 space-y-1">
            <span className="text-[10px] text-gray-400 font-bold block tracking-wider uppercase">Elbow Angle</span>
            <div className="text-lg font-bold font-mono text-primary">{metrics.elbowAngle}°</div>
          </div>
          
          <div className="bg-white/3 border border-white/5 rounded-xl p-2.5 space-y-1">
            <span className="text-[10px] text-gray-400 font-bold block tracking-wider uppercase">Knee Angle</span>
            <div className="text-lg font-bold font-mono text-gray-200">{metrics.kneeAngle}°</div>
          </div>

          <div className="bg-white/3 border border-white/5 rounded-xl p-2.5 space-y-1">
            <span className="text-[10px] text-gray-400 font-bold block tracking-wider uppercase">Spine Tilt</span>
            <div className="text-lg font-bold font-mono text-gray-200">{metrics.spineTilt}°</div>
          </div>

          <div className="bg-white/3 border border-white/5 rounded-xl p-2.5 space-y-1">
            <span className="text-[10px] text-gray-400 font-bold block tracking-wider uppercase">Balance Score</span>
            <div className="text-lg font-bold font-mono text-gray-200">{metrics.balanceScore}%</div>
          </div>

          <div className="bg-white/3 border border-white/5 rounded-xl p-2.5 space-y-1">
            <span className="text-[10px] text-gray-400 font-bold block tracking-wider uppercase">Form Score</span>
            <div className="text-lg font-bold font-mono text-emerald-500">{metrics.techniqueScore}/100</div>
          </div>

          <div className="bg-white/3 border border-white/5 rounded-xl p-2.5 space-y-1">
            <span className="text-[10px] text-gray-400 font-bold block tracking-wider uppercase">Injury Risk</span>
            <div className={`text-xs font-bold font-mono py-0.5 px-2 rounded-md inline-block ${
              metrics.techniqueScore < 60 ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 
              metrics.techniqueScore < 80 ? 'bg-orange-500/10 text-orange-400 border border-orange-500/20' : 
              'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
            }`}>
              {metrics.techniqueScore < 60 ? 'HIGH' : metrics.techniqueScore < 80 ? 'MEDIUM' : 'LOW'}
            </div>
          </div>
        </div>

        {/* Buttons Controls */}
        <div className="w-64 flex flex-col justify-center gap-3 pr-2 border-l border-white/5 pl-6">
          {!isRecording ? (
            <Button 
              onClick={startRecording}
              className="bg-red-500 text-white font-semibold flex items-center justify-center gap-2 hover:bg-red-600 shadow-md shadow-red-950/20"
            >
              <span className="w-2.5 h-2.5 rounded-full bg-white animate-pulse" />
              Record Session
            </Button>
          ) : (
            <Button 
              onClick={stopRecording}
              className="bg-gray-800 border border-white/10 text-white font-semibold flex items-center justify-center gap-2 hover:bg-gray-700"
            >
              <StopCircle className="h-4 w-4 text-red-500" />
              Stop Recording
            </Button>
          )}

          <Button 
            onClick={handleEndSession}
            variant="outline"
            className="font-semibold"
          >
            <BarChart2 className="h-4 w-4 mr-2" /> View Analysis Report
          </Button>
        </div>

      </div>

      {/* SNAPSHOTS BOTTOM GALLERY STRIP */}
      <div className="h-24 border-t border-white/5 bg-gray-950/80 px-6 py-2.5 flex items-center gap-4 shrink-0 overflow-x-auto select-none scrollbar-thin">
        <span className="text-[10px] font-bold text-gray-400 tracking-wider uppercase shrink-0">
          Auto Snapshot Gallery
        </span>
        
        <div className="flex gap-3 min-w-0">
          {snapshots.map((snap) => (
            <div 
              key={snap.id} 
              onClick={() => setSelectedSnapshot(snap)}
              className={`relative h-14 w-24 rounded-lg overflow-hidden border cursor-pointer hover:scale-[1.03] transition-all shrink-0 ${
                snap.type === "perfect" ? "border-emerald-500 bg-emerald-500/5" : "border-red-500 bg-red-500/5"
              }`}
            >
              <img src={snap.image} className="w-full h-full object-cover" />
              <div className={`absolute bottom-0 inset-x-0 text-[8px] font-bold px-1.5 py-0.5 truncate text-center ${
                snap.type === "perfect" ? "bg-emerald-500 text-white" : "bg-red-500 text-white"
              }`}>
                {snap.label}
              </div>
            </div>
          ))}

          {snapshots.length === 0 && (
            <div className="text-[11px] text-gray-500 italic flex items-center">
              Autonomous snapshots will populate here when form deviations or perfect deliveries occur.
            </div>
          )}
        </div>
      </div>

      {/* AI COACH COMPACT BAR */}
      <div className="fixed bottom-4 left-4 right-4 z-50 flex items-center justify-between bg-gray-950/95 backdrop-blur-md border border-orange-500/30 rounded-full px-4 md:px-6 shadow-[0_0_15px_rgba(249,115,22,0.2)] transition-all duration-300" style={{ height: '56px' }}>
        {/* Left side: small animated orange mic/sound icon that pulses when speaking */}
        <div className="flex items-center justify-center shrink-0">
          <div className={`p-2 rounded-full text-orange-500 ${isSpeaking ? 'animate-pulse scale-110' : ''}`}>
            <Mic className="h-4 w-4" />
          </div>
        </div>

        {/* Center: coach feedback text (single line, truncate if too long) */}
        <div className="flex-1 min-w-0 px-3 md:px-4 text-center">
          <p className="text-xs md:text-sm font-medium text-gray-200 truncate whitespace-nowrap">
            {transcript}
          </p>
        </div>

        {/* Right side: small "COACH" label in orange */}
        <div className="shrink-0 flex items-center">
          <span className="text-[10px] md:text-xs font-bold text-orange-500 tracking-wider uppercase font-mono">
            COACH
          </span>
        </div>
      </div>

      {/* DETAILED SNAPSHOT MODAL PREVIEW OVERLAY */}
      <AnimatePresence>
        {selectedSnapshot && (
          <div className="absolute inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-gray-900 border border-white/10 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden relative"
            >
              
              <div className="p-4 border-b border-white/5 flex justify-between items-center bg-gray-950/60">
                <div className="flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${selectedSnapshot.type === 'perfect' ? 'bg-emerald-500' : 'bg-red-500'}`} />
                  <h3 className="font-bold text-sm">📸 Snapshot: {selectedSnapshot.label}</h3>
                </div>
                <Badge variant="outline" className="font-mono text-xs text-gray-400">
                  {selectedSnapshot.timestamp}
                </Badge>
              </div>

              <div className="p-5 space-y-4">
                {/* Img frame */}
                <div className="relative aspect-video rounded-xl overflow-hidden border border-white/10 bg-black">
                  <img src={selectedSnapshot.image} className="w-full h-full object-contain" />
                </div>

                <div className="space-y-2.5 text-sm">
                  <div className="flex justify-between items-center p-2 rounded-lg bg-white/5 border border-white/5 font-mono text-xs">
                    <span>Technique Score at release:</span>
                    <span className={`font-bold ${selectedSnapshot.type === 'perfect' ? 'text-emerald-500' : 'text-red-500'}`}>
                      {selectedSnapshot.score}/100
                    </span>
                  </div>

                  <div className="p-3 bg-white/3 border border-white/5 rounded-lg">
                    <span className="text-xs font-bold text-primary block mb-1">CORRECTION TARGET:</span>
                    <p className="text-xs text-gray-300">{selectedSnapshot.correction}</p>
                  </div>
                </div>
              </div>

              <div className="p-4 border-t border-white/5 bg-gray-950/40 flex justify-end">
                <Button 
                  onClick={() => setSelectedSnapshot(null)}
                  className="font-semibold"
                >
                  Close Preview
                </Button>
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}