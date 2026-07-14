import { useRef } from "react";
import { Link } from "wouter";
import { motion, useInView } from "framer-motion";
import {
  ChevronRight,
  Camera,
  Cpu,
  BarChart2,
  MessageSquare,
  AlertTriangle,
  CheckCircle2,
  Zap,
  Target,
  Shield,
} from "lucide-react";
import { Navbar } from "@/components/layout/navbar";
import { Button } from "@/components/ui/button";
import { KinectraLogo } from "@/components/layout/KinectraLogo";

// ─── Animated cricket pose landmarks ──────────────────────────────
const JOINTS = [
  { id: "head",    cx: 160, cy: 52 },
  { id: "lsho",   cx: 130, cy: 90 },
  { id: "rsho",   cx: 190, cy: 88 },
  { id: "lelb",   cx: 104, cy: 128 },
  { id: "relb",   cx: 216, cy: 120 },
  { id: "lwri",   cx: 85,  cy: 162 },
  { id: "rwri",   cx: 240, cy: 100 },
  { id: "lhip",   cx: 140, cy: 168 },
  { id: "rhip",   cx: 182, cy: 168 },
  { id: "lkne",   cx: 128, cy: 220 },
  { id: "rkne",   cx: 190, cy: 216 },
  { id: "lank",   cx: 122, cy: 270 },
  { id: "rank",   cx: 196, cy: 268 },
];
const CONNECTIONS: Array<[string, string]> = [
  ["head","lsho"],["head","rsho"],
  ["lsho","rsho"],
  ["lsho","lelb"],["lelb","lwri"],
  ["rsho","relb"],["relb","rwri"],
  ["lsho","lhip"],["rsho","rhip"],
  ["lhip","rhip"],
  ["lhip","lkne"],["lkne","lank"],
  ["rhip","rkne"],["rkne","rank"],
];

function getJoint(id: string) {
  return JOINTS.find(j => j.id === id)!;
}

function CricketVisual() {
  return (
    <div className="relative w-full flex items-center justify-center select-none">
      <svg viewBox="0 0 320 320" className="w-full max-w-[320px]" fill="none">
        {/* Subtle radial glow */}
        <defs>
          <radialGradient id="glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#F28C28" stopOpacity="0.15" />
            <stop offset="100%" stopColor="#F28C28" stopOpacity="0" />
          </radialGradient>
          <filter id="blur-sm">
            <feGaussianBlur stdDeviation="1.5" />
          </filter>
        </defs>
        <circle cx="160" cy="160" r="140" fill="url(#glow)" />

        {/* Grid lines */}
        {[60, 120, 180, 240].map(y => (
          <line key={y} x1="20" y1={y} x2="300" y2={y} stroke="#F28C28" strokeOpacity="0.06" strokeWidth="1" />
        ))}
        {[60, 120, 180, 240].map(x => (
          <line key={x} x1={x} y1="20" x2={x} y2="300" stroke="#F28C28" strokeOpacity="0.06" strokeWidth="1" />
        ))}

        {/* Connections — animated draw */}
        {CONNECTIONS.map(([a, b], i) => {
          const ja = getJoint(a), jb = getJoint(b);
          return (
            <motion.line
              key={`${a}-${b}`}
              x1={ja.cx} y1={ja.cy}
              x2={jb.cx} y2={jb.cy}
              stroke="#F28C28"
              strokeWidth="1.5"
              strokeLinecap="round"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 0.7 }}
              transition={{ duration: 0.6, delay: 0.3 + i * 0.04, ease: "easeOut" }}
            />
          );
        })}

        {/* Joints */}
        {JOINTS.map((j, i) => (
          <motion.g key={j.id}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.3, delay: 0.8 + i * 0.05, type: "spring", stiffness: 300 }}
            style={{ transformOrigin: `${j.cx}px ${j.cy}px` }}
          >
            {/* Pulse ring */}
            <motion.circle
              cx={j.cx} cy={j.cy} r={7}
              fill="none"
              stroke="#F28C28"
              strokeWidth="1"
              initial={{ scale: 1, opacity: 0.6 }}
              animate={{ scale: [1, 1.8, 1], opacity: [0.6, 0, 0.6] }}
              transition={{ duration: 2.5, delay: 1.2 + i * 0.12, repeat: Infinity, ease: "easeInOut" }}
            />
            <circle cx={j.cx} cy={j.cy} r={4} fill="#1a1a1a" stroke="#F28C28" strokeWidth="1.5" />
            <circle cx={j.cx} cy={j.cy} r={2} fill="#F28C28" />
          </motion.g>
        ))}

        {/* Floating metric chips */}
        {[
          { x: 240, y: 70,  label: "ELBOW", value: "94°",  color: "#22c55e" },
          { x: 20,  y: 150, label: "SPINE",  value: "12°",  color: "#22c55e" },
          { x: 220, y: 250, label: "KNEE",   value: "143°", color: "#F28C28" },
        ].map((chip, i) => (
          <motion.g key={chip.label}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.6 + i * 0.15, duration: 0.5 }}
          >
            <rect x={chip.x - 2} y={chip.y - 14} width={54} height={22} rx={5} fill="#0f0f0f" stroke={chip.color} strokeWidth="1" strokeOpacity="0.6" />
            <text x={chip.x + 25} y={chip.y - 6} textAnchor="middle" fill="#6b7280" fontSize="7" fontFamily="monospace">{chip.label}</text>
            <text x={chip.x + 25} y={chip.y + 4} textAnchor="middle" fill={chip.color} fontSize="9" fontWeight="bold" fontFamily="monospace">{chip.value}</text>
          </motion.g>
        ))}
      </svg>
    </div>
  );
}

// ─── Fade-in section wrapper ───────────────────────────────────────
function FadeIn({ children, delay = 0, className = "" }: { children: React.ReactNode; delay?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 24 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.55, delay, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// ─── Home page ─────────────────────────────────────────────────────
export default function Home() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />

      <main className="flex-1">

        {/* ── Hero ── */}
        <section id="hero" className="relative min-h-screen flex items-center overflow-hidden pt-16">
          {/* Warm dot grid */}
          <div
            className="absolute inset-0 -z-10"
            style={{
              backgroundImage: "radial-gradient(circle, #F28C28 1px, transparent 1px)",
              backgroundSize: "32px 32px",
              backgroundPosition: "0 0",
              opacity: 0.08,
            }}
          />
          {/* Radial gradient fade */}
          <div className="absolute inset-0 -z-10 bg-gradient-to-b from-background via-background/80 to-background" />

          <div className="container mx-auto px-4 md:px-6 py-16 grid lg:grid-cols-2 gap-12 lg:gap-8 items-center">
            {/* Left: copy */}
            <div className="space-y-8">
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/8 px-3.5 py-1.5 text-sm text-primary font-medium"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                Real-Time Pose Estimation · Browser-Native
              </motion.div>

              <div className="space-y-5">
                <motion.h1
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.55, delay: 0.08 }}
                  className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tighter text-foreground leading-[1.08]"
                >
                  Cricket Technique,
                  <br />
                  <span className="text-primary">Decoded in Real Time.</span>
                </motion.h1>

                <motion.p
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.55, delay: 0.16 }}
                  className="text-lg text-muted-foreground max-w-xl leading-relaxed"
                >
                  KINETRA tracks 33 body landmarks via your webcam, calculates joint angles frame-by-frame, and scores bowling or batting technique against elite biomechanical baselines — no wearables, no uploads, no latency.
                </motion.p>
              </div>

              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.24 }}
                className="flex flex-col sm:flex-row gap-3"
              >
                <Link href="/setup">
                  <Button size="lg" className="h-12 px-8 text-base font-semibold shadow-lg shadow-primary/20 gap-2">
                    Start Free Analysis <ChevronRight className="h-4 w-4" />
                  </Button>
                </Link>
                <button
                  onClick={() => document.getElementById("how-it-works")?.scrollIntoView({ behavior: "smooth" })}
                  className="h-12 px-8 text-base font-medium border border-border rounded-xl hover:bg-muted/50 transition-colors text-foreground/70 hover:text-foreground"
                >
                  How It Works
                </button>
              </motion.div>

              {/* Trust badges */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4, duration: 0.5 }}
                className="flex items-center gap-6 text-sm text-muted-foreground"
              >
                {[
                  { icon: <Zap className="h-4 w-4 text-primary" />, text: "Sub-100ms latency" },
                  { icon: <Shield className="h-4 w-4 text-primary" />, text: "No data leaves device" },
                  { icon: <Target className="h-4 w-4 text-primary" />, text: "33 pose landmarks" },
                ].map(({ icon, text }) => (
                  <div key={text} className="flex items-center gap-1.5">
                    {icon}
                    <span>{text}</span>
                  </div>
                ))}
              </motion.div>
            </div>

            {/* Right: animated skeleton */}
            <motion.div
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.7, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
              className="relative"
            >
              <div className="relative rounded-2xl bg-gray-950 border border-white/8 p-6 shadow-2xl overflow-hidden">
                {/* Corner decorations */}
                <div className="absolute top-3 left-3 flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-red-500/80" />
                  <div className="w-2 h-2 rounded-full bg-yellow-500/80" />
                  <div className="w-2 h-2 rounded-full bg-emerald-500/80" />
                </div>
                <div className="absolute top-3 right-3 text-[10px] font-mono text-gray-600 uppercase tracking-widest">
                  POSE DETECTION
                </div>

                <div className="mt-6">
                  <CricketVisual />
                </div>

                {/* Bottom status bar */}
                <div className="mt-4 flex items-center justify-between text-[11px] font-mono text-gray-600">
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    TRACKING ACTIVE
                  </div>
                  <span>15 FPS · GPU</span>
                </div>
              </div>

              {/* Score floating card */}
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 1.8, duration: 0.5 }}
                className="absolute -right-4 top-16 bg-white rounded-xl shadow-xl border border-border/50 px-4 py-3 min-w-[140px] hidden lg:block"
              >
                <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider mb-1">Technique Score</p>
                <p className="text-3xl font-bold text-primary font-mono">87<span className="text-base text-muted-foreground">/100</span></p>
                <div className="mt-1.5 h-1 bg-muted rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-primary rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: "87%" }}
                    transition={{ delay: 2.2, duration: 0.8, ease: "easeOut" }}
                  />
                </div>
              </motion.div>
            </motion.div>
          </div>

          {/* Scroll indicator */}
          <motion.div
            className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 2, duration: 0.6 }}
          >
            <span className="text-[11px] uppercase tracking-widest text-muted-foreground/60">Scroll</span>
            <motion.div
              className="w-px h-8 bg-gradient-to-b from-primary/60 to-transparent"
              animate={{ scaleY: [1, 0.4, 1] }}
              transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
            />
          </motion.div>
        </section>

        {/* ── How It Works ── */}
        <section id="how-it-works" className="py-24 md:py-32 bg-muted/30 border-y border-border/40">
          <div className="container mx-auto px-4 md:px-6">
            <FadeIn className="text-center mb-16">
              <p className="text-sm font-semibold text-primary uppercase tracking-widest mb-3">The Process</p>
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground">
                Four steps from camera to coaching.
              </h2>
              <p className="mt-4 text-muted-foreground text-lg max-w-2xl mx-auto">
                Everything runs in your browser using WebAssembly. No server, no upload, no delay.
              </p>
            </FadeIn>

            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {HOW_IT_WORKS.map((step, i) => (
                <FadeIn key={step.title} delay={i * 0.08}>
                  <HowItWorksCard {...step} step={i + 1} />
                </FadeIn>
              ))}
            </div>
          </div>
        </section>
        {/* ── Problem & Solution ── */}
        <section id="problem-solution" className="py-24 md:py-32 bg-background relative overflow-hidden">
          <div className="container mx-auto px-4 md:px-6 relative z-10">
            <FadeIn className="text-center mb-16">
              <p className="text-sm font-semibold text-primary uppercase tracking-widest mb-3">Core Philosophy</p>
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground">
                Bridging the Gap in Athletic Development.
              </h2>
            </FadeIn>

            <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
              {/* Problem */}
              <FadeIn delay={0.05} className="flex">
                <div className="flex-1 bg-white rounded-2xl border border-red-500/10 p-8 shadow-sm flex flex-col justify-between hover:border-red-500/20 hover:shadow-md transition-all duration-300">
                  <div>
                    <span className="text-[10px] font-bold font-mono text-red-500 bg-red-500/5 px-2.5 py-1 rounded border border-red-500/10 uppercase tracking-widest">The Problem</span>
                    <h3 className="text-xl font-bold text-foreground mt-4 mb-3">Athletes lack access to biomechanical coaching.</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      Elite biomechanical coaching has historically been gated behind expensive lab gear, specialized camera rigs, and costly consulting fees. Over 95% of developing athletes train without objective technique feedback, leading to persistent bad habits, slower progression, and increased risk of stress injuries.
                    </p>
                  </div>
                  <div className="border-t border-red-500/5 pt-6 mt-6 flex items-center gap-2 text-xs text-red-600 font-semibold font-mono">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                    Objective technique baselines remain inaccessible.
                  </div>
                </div>
              </FadeIn>

              {/* Solution */}
              <FadeIn delay={0.1} className="flex">
                <div className="flex-1 bg-white rounded-2xl border border-primary/10 p-8 shadow-sm flex flex-col justify-between hover:border-primary/20 hover:shadow-md transition-all duration-300">
                  <div>
                    <span className="text-[10px] font-bold font-mono text-primary bg-primary/5 px-2.5 py-1 rounded border border-primary/10 uppercase tracking-widest">The Kinetra Solution</span>
                    <h3 className="text-xl font-bold text-foreground mt-4 mb-3">Computer vision provides instant, affordable feedback.</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      Kinetra turns any standard smartphone or laptop camera into an advanced sports biomechanics lab. By running high-precision MediaPipe ML models directly in the web browser, Kinetra measures angular joint velocity, posture alignment, and stability margins in sub-100ms real time. 
                    </p>
                  </div>
                  <div className="border-t border-primary/5 pt-6 mt-6 flex items-center gap-2 text-xs text-primary font-semibold font-mono">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                    Elite biomechanical assessment for everyone.
                  </div>
                </div>
              </FadeIn>
            </div>
          </div>
        </section>

        {/* ── Demo ── */}
        <section id="demo" className="py-24 md:py-32">
          <div className="container mx-auto px-4 md:px-6">
            <FadeIn className="text-center mb-16">
              <p className="text-sm font-semibold text-primary uppercase tracking-widest mb-3">Live Preview</p>
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight">What an analysis looks like.</h2>
              <p className="mt-4 text-muted-foreground text-lg max-w-xl mx-auto">
                Real output from an actual analysis session. This is exactly what you'll see.
              </p>
            </FadeIn>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5 max-w-5xl mx-auto">
              {/* Technique score */}
              <FadeIn delay={0.05}>
                <DemoCard title="Technique Score" icon={<Zap className="h-4 w-4 text-primary" />}>
                  <div className="flex items-baseline gap-1 mt-2">
                    <span className="text-5xl font-bold font-mono text-primary">87</span>
                    <span className="text-muted-foreground text-lg">/100</span>
                  </div>
                  <div className="mt-3 h-2 bg-muted rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-primary rounded-full"
                      initial={{ width: 0 }}
                      whileInView={{ width: "87%" }}
                      viewport={{ once: true }}
                      transition={{ duration: 1, ease: "easeOut", delay: 0.3 }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">Above average — elite threshold is 90+</p>
                </DemoCard>
              </FadeIn>

              {/* Joint angles */}
              <FadeIn delay={0.1}>
                <DemoCard title="Biomechanics" icon={<BarChart2 className="h-4 w-4 text-primary" />}>
                  <div className="space-y-3 mt-2">
                    {DEMO_METRICS.map(m => (
                      <div key={m.label} className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">{m.label}</span>
                          <span className={`font-mono font-semibold ${m.ok ? "text-emerald-600" : "text-primary"}`}>
                            {m.value}°
                          </span>
                        </div>
                        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                          <motion.div
                            className={`h-full rounded-full ${m.ok ? "bg-emerald-500" : "bg-primary"}`}
                            initial={{ width: 0 }}
                            whileInView={{ width: `${m.pct}%` }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.8, delay: 0.2 + m.pct / 200 }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </DemoCard>
              </FadeIn>

              {/* Diagnostic alerts */}
              <FadeIn delay={0.15}>
                <DemoCard title="Diagnostic Alerts" icon={<AlertTriangle className="h-4 w-4 text-primary" />}>
                  <div className="space-y-2 mt-2">
                    <AlertRow ok={false} text="Elbow angle slightly low (86°)" />
                    <AlertRow ok={true} text="Balance within optimal range" />
                    <AlertRow ok={true} text="Shoulder rotation correct" />
                    <AlertRow ok={true} text="Spine tilt within tolerance" />
                  </div>
                </DemoCard>
              </FadeIn>
            </div>

            <FadeIn delay={0.2} className="text-center mt-12">
              <Link href="/setup">
                <Button size="lg" className="h-12 px-10 text-base font-semibold shadow-lg shadow-primary/20 gap-2">
                  Run Your Analysis <ChevronRight className="h-4 w-4" />
                </Button>
              </Link>
              <p className="mt-3 text-sm text-muted-foreground">Free · Browser-only · No account needed</p>
            </FadeIn>
          </div>
        </section>
      </main>

      {/* ── Footer ── */}
      <footer className="border-t py-10 bg-muted/20">
        <div className="container mx-auto px-4 md:px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <KinectraLogo className="w-7 h-7" />
            <span className="font-semibold text-foreground">KINETRA</span>
          </div>
          <p>Built for the elite. Engineered for the driven.</p>
        </div>
      </footer>
    </div>
  );
}

// ─── Data ─────────────────────────────────────────────────────────

const HOW_IT_WORKS = [
  {
    icon: <Camera className="h-6 w-6 text-primary" />,
    title: "Camera Capture",
    description: "Your webcam streams live video directly into a WebAssembly runtime — no upload, no server, no latency.",
  },
  {
    icon: <Cpu className="h-6 w-6 text-primary" />,
    title: "Pose Detection",
    description: "MediaPipe Pose detects 33 anatomical landmarks every frame, including elbows, knees, hips, and spine.",
  },
  {
    icon: <BarChart2 className="h-6 w-6 text-primary" />,
    title: "Motion Analysis",
    description: "Joint angles are calculated from 3D landmark vectors using real trigonometry. Bowling and batting modes use different thresholds.",
  },
  {
    icon: <MessageSquare className="h-6 w-6 text-primary" />,
    title: "Technique Feedback",
    description: "A weighted score (posture 30%, alignment 25%, stability 25%, efficiency 20%) with actionable warnings and session recommendations.",
  },
];

const DEMO_METRICS = [
  { label: "Elbow Angle", value: 86, pct: 48, ok: false },
  { label: "Knee Angle",  value: 143, pct: 80, ok: true  },
  { label: "Spine Tilt",  value: 11, pct: 18, ok: true  },
  { label: "Shoulder",    value: 8,  pct: 12, ok: true  },
];

// ─── Sub-components ───────────────────────────────────────────────

function HowItWorksCard({
  icon, title, description, step,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  step: number;
}) {
  return (
    <div className="group relative bg-card border border-border/60 rounded-2xl p-6 hover:border-primary/30 hover:shadow-md transition-all duration-300 cursor-default">
      <div className="absolute top-4 right-4 text-[11px] font-bold font-mono text-muted-foreground/30">
        {String(step).padStart(2, "0")}
      </div>
      <div className="w-12 h-12 rounded-xl bg-primary/8 flex items-center justify-center mb-5 group-hover:bg-primary/14 transition-colors">
        {icon}
      </div>
      <h3 className="text-base font-bold tracking-tight text-foreground mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
    </div>
  );
}

function DemoCard({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-card border border-border/60 rounded-2xl p-5 hover:shadow-md hover:border-primary/20 transition-all duration-300">
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <h3 className="text-sm font-bold tracking-tight text-foreground">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function AlertRow({ ok, text }: { ok: boolean; text: string }) {
  return (
    <div className={`flex items-center gap-2 text-xs px-3 py-2 rounded-lg border ${
      ok
        ? "text-emerald-700 bg-emerald-50 border-emerald-100"
        : "text-orange-700 bg-orange-50 border-orange-100"
    }`}>
      {ok
        ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
        : <AlertTriangle className="h-3.5 w-3.5 shrink-0" />}
      {text}
    </div>
  );
}
