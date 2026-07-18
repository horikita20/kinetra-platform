import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { KinetraMetrics } from "@/utils/pose-evaluator";

interface MascotAssistantProps {
  metrics: KinetraMetrics;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  alpha: number;
  life: number;
}

export function MascotAssistant({ metrics }: MascotAssistantProps) {
  const [visible, setVisible] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  const lastCheerTimeRef = useRef<number>(0);
  const synthRef = useRef<SpeechSynthesis | null>(
    typeof window !== "undefined" ? window.speechSynthesis : null
  );

  const cheerVoices = ["Yeah!", "Hurray!", "Let's Go!", "Excellent!"];

  const speakPhrase = (text: string) => {
    if (!synthRef.current) return;
    synthRef.current.cancel();
    
    const utterance = new SpeechSynthesisUtterance(text);
    const voices = synthRef.current.getVoices();
    // Choose a friendly female voice for the cheerleader
    const femaleVoice = voices.find(
      (v) =>
        v.lang.startsWith("en") &&
        (v.name.includes("Zira") || v.name.includes("Female") || v.name.includes("Google US English") || v.name.includes("Natural"))
    );
    if (femaleVoice) {
      utterance.voice = femaleVoice;
    }
    utterance.pitch = 1.35; // Cheerleader voice pitch
    utterance.rate = 1.1;
    
    synthRef.current.speak(utterance);
  };

  // Relaxed trigger conditions for limited indoor / slow-motion demo testing (allows 70-80% accuracy)
  useEffect(() => {
    const now = Date.now();
    let timer: NodeJS.Timeout | undefined;
    
    const isCorrectBowlingAction =
      metrics.techniqueScore >= 70 &&
      metrics.postureScore >= 70 &&
      metrics.elbowAngle >= 60 &&
      metrics.elbowAngle <= 140;

    if (isCorrectBowlingAction && now - lastCheerTimeRef.current > 5000) {
      lastCheerTimeRef.current = now;
      setVisible(true);
      
      const randomPhrase = cheerVoices[Math.floor(Math.random() * cheerVoices.length)];
      speakPhrase(randomPhrase);

      // Dismiss cheerleader after 3.5 seconds
      timer = setTimeout(() => {
        setVisible(false);
        if (synthRef.current) {
          synthRef.current.cancel();
        }
      }, 3500);
    }

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [
    metrics.postureScore,
    metrics.elbowAngle,
    metrics.warnings,
    metrics.techniqueScore
  ]);

  // Pom-pom particle animation loop (canvas-based)
  useEffect(() => {
    if (!visible) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let particles: Particle[] = [];
    let animationFrameId: number;

    const colors = [
      "rgba(219, 39, 119, 0.9)", // Pink
      "rgba(192, 38, 211, 0.9)", // Purple
      "rgba(168, 85, 247, 0.9)", // Light purple
      "rgba(234, 179, 8, 0.9)"    // Gold spark
    ];

    const updateParticles = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Spawn pom-pom sparkles from Left hand pom-pom (approx X=25, Y=90) and Right hand (approx X=195, Y=90)
      if (Math.random() < 0.6) {
        particles.push({
          x: 25 + (Math.random() - 0.5) * 20,
          y: 90 + (Math.random() - 0.5) * 20,
          vx: (Math.random() - 0.8) * 4,
          vy: (Math.random() - 0.5) * 3 - 2,
          color: colors[Math.floor(Math.random() * colors.length)],
          size: 3 + Math.random() * 5,
          alpha: 1,
          life: 30 + Math.random() * 20,
        });
      }
      if (Math.random() < 0.6) {
        particles.push({
          x: 195 + (Math.random() - 0.5) * 20,
          y: 90 + (Math.random() - 0.5) * 20,
          vx: (Math.random() - 0.2) * 4,
          vy: (Math.random() - 0.5) * 3 - 2,
          color: colors[Math.floor(Math.random() * colors.length)],
          size: 3 + Math.random() * 5,
          alpha: 1,
          life: 30 + Math.random() * 20,
        });
      }

      particles.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.08; // gravity
        p.life--;
        p.alpha = Math.max(0, p.life / 50);

        ctx.save();
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.alpha;
        ctx.shadowBlur = 5;
        ctx.shadowColor = p.color;
        ctx.fill();
        ctx.restore();
      });

      particles = particles.filter((p) => p.life > 0);
      animationFrameId = requestAnimationFrame(updateParticles);
    };

    updateParticles();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [visible]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 350, scale: 0.8 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 350, scale: 0.8 }}
          transition={{ type: "spring", stiffness: 100, damping: 15 }}
          className="fixed bottom-0 right-6 z-40 flex items-end pointer-events-none w-[220px] h-[340px]"
        >
          {/* Custom Mascot Animation Style Overrides */}
          <style dangerouslySetInnerHTML={{ __html: `
            @keyframes cheerleader-jump {
              0%, 100% { transform: translateY(0); }
              50% { transform: translateY(-16px); }
            }
            @keyframes cheerleader-idle-breath {
              0%, 100% { transform: scale(1) translateY(0); }
              50% { transform: scale(1.025) translateY(-3px); }
            }
            @keyframes cheerleader-body-sway {
              0%, 100% { transform: rotate(0deg) skewX(0deg); }
              50% { transform: rotate(2deg) skewX(1deg); }
            }
            @keyframes cheerleader-pompom-shake-l {
              0%, 100% { transform: scale(1) rotate(0deg) translate(0, 0); }
              25% { transform: scale(1.08) rotate(-12deg) translate(-2px, -2px); }
              75% { transform: scale(1.05) rotate(10deg) translate(2px, 1px); }
            }
            @keyframes cheerleader-pompom-shake-r {
              0%, 100% { transform: scale(1) rotate(0deg) translate(0, 0); }
              25% { transform: scale(1.08) rotate(12deg) translate(2px, -2px); }
              75% { transform: scale(1.05) rotate(-10deg) translate(-2px, 1px); }
            }

            .mascot-jump-wrap {
              animation: cheerleader-jump 0.45s ease-in-out infinite;
            }
            .mascot-breath-wrap {
              animation: cheerleader-idle-breath 2s ease-in-out infinite;
              transform-origin: bottom center;
            }
            .mascot-sway-wrap {
              animation: cheerleader-body-sway 3s ease-in-out infinite;
              transform-origin: bottom center;
            }
            .mascot-shaking-effect {
              animation: cheerleader-pompom-shake-l 0.12s linear infinite;
            }
          `}} />

          {/* Particle Sparkles Canvas Overlay */}
          <canvas
            ref={canvasRef}
            width={220}
            height={340}
            className="absolute inset-0 z-50 pointer-events-none"
          />

          {/* Cheer Mascot Container - displaying the high-quality original cheerleader */}
          <div className="mascot-jump-wrap w-full h-full">
            <div className="mascot-breath-wrap w-full h-full">
              <div className="mascot-sway-wrap w-full h-full">
                <div className="mascot-shaking-effect w-full h-full">
                  <img
                    src="/cheer_mascot_original.png"
                    alt="Kinetra Cheer Mascot"
                    className="w-full h-full object-contain filter drop-shadow-[0_8px_16px_rgba(0,0,0,0.45)]"
                  />
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
