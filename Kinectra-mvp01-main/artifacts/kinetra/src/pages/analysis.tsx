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
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useSessionContext } from "@/contexts/SessionContext";
import { useEndSession } from "@workspace/api-client-react";
import { useKinetraAnalysis } from "@/hooks/use-kinetra-analysis";
import { KinectraLogo } from "@/components/layout/KinectraLogo";

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

  // ───────────────── END SESSION ─────────────────
  const handleEndSession = useCallback(() => {
    if (!config.sessionId) return;

    stopAnalysis();

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
  }, [config.sessionId, stopAnalysis, endSessionMutation, metrics.warnings, setLocation, toast]);

  // Format elapsed time (MM:SS)
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  // Status mapping
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
    <div className="h-screen w-full flex flex-col bg-gray-950 font-sans text-gray-100 overflow-hidden">
      
      {/* HEADER SECTION */}
      <header className="h-16 border-b border-white/5 bg-gray-900/60 backdrop-blur-md px-6 flex items-center justify-between z-10 shrink-0">
        <div className="flex items-center gap-3">
          <KinectraLogo className="w-9 h-9" />
          <div>
            <h1 className="text-sm font-bold tracking-wider text-gray-200">KINETRA LABS</h1>
            <p className="text-[10px] text-gray-400 font-mono tracking-widest uppercase">
              Real-time Motion Assessment
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
            <span className="text-gray-400 uppercase">Mode:</span>
            <span className="font-bold text-primary capitalize">{config.analysisType}</span>
          </div>

          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-white/5 border border-white/10">
            <span className="text-gray-400 uppercase">Elapsed:</span>
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

      {/* THREE-COLUMN WORKSPACE */}
      <div className="flex flex-1 min-h-0 relative">
        
        {/* COLUMN 1: LIVE RAW CAMERA */}
        <div className="w-1/3 border-r border-white/5 bg-gray-900/40 p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3 shrink-0">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
              <Camera className="h-3.5 w-3.5 text-primary" /> Live Capture
            </span>
            <span className="text-[10px] font-mono text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
              HD STREAM
            </span>
          </div>

          <div className="flex-1 min-h-0 w-full relative rounded-xl overflow-hidden border border-white/10 bg-black flex items-center justify-center shadow-inner">
            <video
              ref={videoRef}
              playsInline
              muted
              className="w-full h-full object-cover scale-x-[-1]"
            />
            {hasCameraPermission === false && (
              <div className="absolute inset-0 flex flex-col items-center justify-center p-4 bg-gray-950/90 text-center">
                <AlertTriangle className="h-8 w-8 text-red-500 mb-2" />
                <p className="text-sm font-semibold">Camera Access Denied</p>
                <p className="text-xs text-gray-400 mt-1">Please enable camera permission in your browser settings.</p>
              </div>
            )}
            {isModelLoading && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-950/80">
                <Loader2 className="h-8 w-8 text-primary animate-spin mb-3" />
                <p className="text-sm font-semibold text-gray-200">Initializing Engine...</p>
                <p className="text-xs text-gray-400 mt-1">Loading MediaPipe Pose models (WASM)</p>
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
          <div className="mt-3 text-[10px] font-mono text-gray-500 uppercase tracking-wider shrink-0 text-center">
            Raw visual inputs feed directly to client-side ML pipe.
          </div>
        </div>

        {/* COLUMN 2: SKELETON TRACKING */}
        <div className="w-1/3 border-r border-white/5 bg-gray-900/60 p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3 shrink-0">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
              <Zap className="h-3.5 w-3.5 text-primary" /> Joint Skeleton
            </span>
            <span className="text-[10px] font-mono text-gray-400">
              15 FPS · WEBASSEMBLY
            </span>
          </div>

          <div className="flex-1 min-h-0 w-full relative rounded-xl overflow-hidden border border-white/10 bg-gradient-to-b from-gray-950 to-gray-900 flex items-center justify-center shadow-inner">
            {/* Grid background to emphasize tech/measurement feel */}
            <div 
              className="absolute inset-0 opacity-10 pointer-events-none"
              style={{
                backgroundImage: "radial-gradient(circle, #F28C28 1px, transparent 1px)",
                backgroundSize: "24px 24px",
              }}
            />
            <canvas
              ref={canvasRef}
              className="w-full h-full object-contain scale-x-[-1] z-10"
            />
            {!isModelLoading && !modelError && (
              <div className="absolute bottom-4 left-4 z-20 flex flex-col gap-1">
                <div className="flex items-center gap-2 text-[10px] font-mono">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block border border-emerald-400" />
                  <span>POSTURE CORRECT</span>
                </div>
                <div className="flex items-center gap-2 text-[10px] font-mono">
                  <span className="w-2.5 h-2.5 rounded-full bg-orange-500 inline-block border border-orange-400" />
                  <span>WARNING</span>
                </div>
                <div className="flex items-center gap-2 text-[10px] font-mono">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block border border-red-400" />
                  <span>CRITICAL FAULT</span>
                </div>
              </div>
            )}
          </div>
          <div className="mt-3 text-[10px] font-mono text-gray-500 uppercase tracking-wider shrink-0 text-center">
            Body keypoints resolved from 33 landmark points.
          </div>
        </div>

        {/* COLUMN 3: METRICS DASHBOARD */}
        <div className="w-1/3 bg-gray-900/80 p-5 flex flex-col min-h-0">
          <div className="flex items-center justify-between mb-4 shrink-0">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
              <BarChart2 className="h-3.5 w-3.5 text-primary" /> Metrics Panel
            </span>
            <span className="text-[10px] font-mono text-gray-400">
              FRAME COUNT: {statsRef.current.frames}
            </span>
          </div>

          <div className="flex-1 overflow-y-auto space-y-4 pr-1 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
            
            {/* TECHNIQUE SCORE CIRCULAR HEADER */}
            <div className="flex gap-4 p-4 rounded-xl border border-white/5 bg-white/3 shrink-0 items-center justify-between relative overflow-hidden">
              <div className="absolute right-0 top-0 translate-x-2 -translate-y-2 opacity-5 pointer-events-none">
                <Sparkles className="h-24 w-24 text-primary" />
              </div>
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-gray-400 tracking-wider block uppercase">Technique Score</span>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-extrabold text-primary font-mono">{metrics.techniqueScore}</span>
                  <span className="text-gray-400 text-sm">/100</span>
                </div>
              </div>
              <div className={`text-[10px] font-bold font-mono px-2.5 py-1.5 rounded-md border ${getStatusColor(metrics.techniqueScore)}`}>
                {getScoreLabel(metrics.techniqueScore)}
              </div>
            </div>

            {/* BALANCE SCORE CARD */}
            <div className="p-4 rounded-xl border border-white/5 bg-white/3 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-gray-300">Balance & Body Stability</span>
                <span className="font-mono font-bold text-primary">{metrics.balanceScore}%</span>
              </div>
              <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-primary to-orange-500 transition-all duration-300 rounded-full"
                  style={{ width: `${metrics.balanceScore}%` }}
                />
              </div>
            </div>

            {/* BIOMECHANICAL ANGLES GRID */}
            <div className="grid grid-cols-2 gap-3">
              
              {/* Elbow Angle */}
              <div className="p-3.5 rounded-xl border border-white/5 bg-white/3 space-y-1.5">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Elbow Angle</span>
                <div className="text-2xl font-bold font-mono text-gray-100">{metrics.elbowAngle}°</div>
                <div className="text-[9px] text-gray-500 font-mono">
                  {config.analysisType === "bowling" ? "Ideal: 80°-110°" : "Ideal: 90°+"}
                </div>
              </div>

              {/* Knee Angle */}
              <div className="p-3.5 rounded-xl border border-white/5 bg-white/3 space-y-1.5">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Knee Angle</span>
                <div className="text-2xl font-bold font-mono text-gray-100">{metrics.kneeAngle}°</div>
                <div className="text-[9px] text-gray-500 font-mono">
                  {config.analysisType === "bowling" ? "Stride stance" : "Ideal: 120°+"}
                </div>
              </div>

              {/* Spine Tilt */}
              <div className="p-3.5 rounded-xl border border-white/5 bg-white/3 space-y-1.5">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Spine Tilt</span>
                <div className="text-2xl font-bold font-mono text-gray-100">{metrics.spineTilt}°</div>
                <div className="text-[9px] text-gray-500 font-mono">
                  {config.analysisType === "bowling" ? "Ideal: 0°-20°" : "Torso balance"}
                </div>
              </div>

              {/* Shoulder Rotation */}
              <div className="p-3.5 rounded-xl border border-white/5 bg-white/3 space-y-1.5">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Shoulder Align</span>
                <div className="text-2xl font-bold font-mono text-gray-100">{metrics.shoulderAlignment}°</div>
                <div className="text-[9px] text-gray-500 font-mono">
                  Ideal alignment: &lt;15°
                </div>
              </div>
            </div>

            {/* DIAGNOSTIC ALERTS AREA */}
            <div className="flex-1 flex flex-col min-h-[140px]">
              <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                <Info className="h-3 w-3 text-primary" /> Active Diagnostics
              </div>
              
              <div className="flex-1 border border-white/5 rounded-xl bg-white/2 p-3 space-y-2 overflow-y-auto">
                <AnimatePresence mode="popLayout">
                  {metrics.warnings.map((warn, idx) => (
                    <motion.div
                      key={warn}
                      initial={{ opacity: 0, y: 8, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className="flex items-center gap-2 p-2.5 rounded-lg border border-red-500/20 bg-red-500/5 text-red-400 text-xs shrink-0"
                    >
                      <AlertTriangle className="h-4 w-4 shrink-0 text-red-500" />
                      <span>{warn}</span>
                    </motion.div>
                  ))}
                  {metrics.warnings.length === 0 && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="h-full flex flex-col items-center justify-center text-center text-gray-500 text-xs py-6"
                    >
                      <CheckCircle2 className="h-5 w-5 text-emerald-500 mb-1" />
                      <span className="font-semibold text-gray-400">Postural Metrics Nominal</span>
                      <span className="text-[10px] text-gray-500 mt-0.5">Biomechanics align with model targets.</span>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}