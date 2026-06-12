import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, CheckCircle2, AlertCircle, RefreshCw } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface ProcessingScreenProps {
  jobId: string;
  onCancel: () => void;
}

interface JobStatusResponse {
  jobId: string;
  status: "pending" | "processing" | "completed" | "failed";
  progress: number;
  step: number;
  message?: string;
  sessionId?: string;
}

const STEPS = [
  { id: 1, label: "Extracting Frames" },
  { id: 2, label: "Detecting Athlete Pose" },
  { id: 3, label: "Calculating Joint Angles" },
  { id: 4, label: "Running Biomechanics Analysis" },
  { id: 5, label: "Generating Technique Score" },
  { id: 6, label: "Creating Performance Report" },
];

export default function ProcessingScreen({ jobId, onCancel }: ProcessingScreenProps) {
  const [, setLocation] = useLocation();
  const [job, setJob] = useState<JobStatusResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let intervalId: NodeJS.Timeout;

    const pollStatus = async () => {
      try {
        const response = await fetch(`/api/video/job/${jobId}`);
        if (!response.ok) {
          throw new Error("Failed to fetch job status");
        }
        const data: JobStatusResponse = await response.json();
        setJob(data);

        if (data.status === "completed" && data.sessionId) {
          clearInterval(intervalId);
          // Small delay for final step success feeling
          setTimeout(() => {
            setLocation(`/results/${data.sessionId}`);
          }, 800);
        } else if (data.status === "failed") {
          clearInterval(intervalId);
          setError(data.message || "An error occurred during video analysis.");
        }
      } catch (err) {
        console.error(err);
        clearInterval(intervalId);
        setError("Unable to connect to analysis server. Please try again.");
      }
    };

    // Run initial poll
    pollStatus();

    // Poll every 600ms
    intervalId = setInterval(pollStatus, 600);

    return () => clearInterval(intervalId);
  }, [jobId, setLocation]);

  const progress = job?.progress || 0;
  const currentStep = job?.step || 1;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-950/95 backdrop-blur-md p-4 font-sans text-gray-100">
      <div 
        className="absolute inset-0 opacity-5 pointer-events-none"
        style={{
          backgroundImage: "radial-gradient(circle, #F28C28 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
      />

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-lg"
      >
        <Card className="bg-gray-900 border border-white/10 shadow-2xl relative overflow-hidden">
          {/* Animated decorative top glow */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-[2px] bg-gradient-to-r from-transparent via-primary to-transparent opacity-60" />
          
          <CardContent className="p-8 space-y-6">
            
            {/* Header Status */}
            <div className="text-center space-y-2">
              <span className="text-[10px] font-bold font-mono tracking-widest text-primary uppercase bg-primary/10 border border-primary/20 px-3 py-1 rounded-full">
                {error ? "Processing Failed" : `Analyzing Form (${progress}%)`}
              </span>
              <h2 className="text-2xl font-extrabold tracking-tight mt-3 text-gray-100">
                {error ? "Form Analysis Interrupted" : "Running Biomechanical Check"}
              </h2>
              <p className="text-xs text-gray-400">
                {error 
                  ? "We encountered an issue reading or scoring your video."
                  : "Usually takes 5–15 seconds depending on file length."}
              </p>
            </div>

            {/* Error View */}
            {error ? (
              <div className="space-y-4">
                <div className="flex items-start gap-3 p-4 rounded-xl border border-red-500/20 bg-red-500/5 text-red-400 text-sm">
                  <AlertCircle className="h-5 w-5 shrink-0 text-red-500 mt-0.5" />
                  <div>
                    <span className="font-semibold block text-red-300">Analysis Error</span>
                    <span className="text-xs mt-1 block">{error}</span>
                  </div>
                </div>
                
                <div className="flex justify-end gap-3 pt-2">
                  <Button variant="ghost" onClick={onCancel} className="text-gray-400 hover:text-white">
                    Cancel
                  </Button>
                  <Button onClick={onCancel} className="bg-primary hover:bg-primary/90 text-white font-semibold gap-1.5">
                    <RefreshCw className="h-4 w-4" /> Try Again
                  </Button>
                </div>
              </div>
            ) : (
              // Active Process View
              <div className="space-y-6">
                
                {/* Progress Bar */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-[11px] font-mono text-gray-400">
                    <span>PROGRESS MODULE</span>
                    <span className="font-bold text-primary">{progress}%</span>
                  </div>
                  <Progress value={progress} className="h-2.5 bg-white/5" />
                </div>

                {/* Steps Checklist */}
                <div className="border border-white/5 rounded-xl bg-white/2 divide-y divide-white/5 p-4 space-y-2.5">
                  {STEPS.map((step) => {
                    const isCompleted = step.id < currentStep;
                    const isActive = step.id === currentStep;
                    
                    return (
                      <div 
                        key={step.id} 
                        className={`flex items-center justify-between py-1.5 first:pt-0 last:pb-0 transition-opacity duration-300 ${
                          isCompleted ? "opacity-100" : isActive ? "opacity-100" : "opacity-40"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          {isCompleted ? (
                            <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
                          ) : isActive ? (
                            <Loader2 className="h-5 w-5 text-primary animate-spin shrink-0" />
                          ) : (
                            <div className="h-5 w-5 rounded-full border border-gray-600 flex items-center justify-center text-[10px] font-mono text-gray-500 font-bold shrink-0">
                              {step.id}
                            </div>
                          )}
                          <span className={`text-sm font-semibold ${
                            isCompleted ? "text-gray-300 font-normal" : isActive ? "text-primary font-bold" : "text-gray-500"
                          }`}>
                            {step.label}
                          </span>
                        </div>
                        
                        {isActive && (
                          <span className="text-[10px] font-mono text-primary/70 animate-pulse font-medium">
                            PROCESSING...
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Cancel Trigger */}
                <div className="flex justify-center pt-2">
                  <Button variant="ghost" onClick={onCancel} className="text-gray-500 hover:text-gray-300 text-xs font-semibold uppercase tracking-wider">
                    Cancel Analysis
                  </Button>
                </div>
              </div>
            )}

          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
