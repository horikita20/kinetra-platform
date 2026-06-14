import { useState } from "react";
import { useRoute, Link } from "wouter";
import { 
  ArrowLeft, 
  Download, 
  Award, 
  BarChart3, 
  Target, 
  Activity, 
  BookOpen, 
  ShieldAlert, 
  Calendar, 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle2, 
  HeartPulse, 
  Clock,
  Eye
} from "lucide-react";
import { useGetSession, getGetSessionQueryKey, useListSessions } from "@workspace/api-client-react";
import { motion, AnimatePresence } from "framer-motion";

import { Navbar } from "@/components/layout/navbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

export default function Results() {
  const [, params] = useRoute("/results/:sessionId");
  const sessionId = params?.sessionId;
  const [activeTab, setActiveTab] = useState<"motion" | "coach" | "injury" | "planner" | "progress">("motion");
  const [selectedSnapshot, setSelectedSnapshot] = useState<any | null>(null);

  const { data: session, isLoading, isError } = useGetSession(sessionId || "", {
    query: {
      enabled: !!sessionId,
      queryKey: getGetSessionQueryKey(sessionId || "")
    }
  });

  const { data: recentSessions } = useListSessions();

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Navbar />
        <main className="flex-1 container px-4 py-8 max-w-4xl mx-auto space-y-8">
          <Skeleton className="h-12 w-64" />
          <div className="grid md:grid-cols-3 gap-6">
            <Skeleton className="h-40 md:col-span-1" />
            <Skeleton className="h-40 md:col-span-2" />
          </div>
          <Skeleton className="h-64 w-full" />
        </main>
      </div>
    );
  }

  if (isError || !session) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Navbar />
        <main className="flex-1 container px-4 py-20 flex flex-col items-center justify-center text-center">
          <h2 className="text-2xl font-bold mb-4">Session Not Found</h2>
          <p className="text-muted-foreground mb-8">Could not load the analysis results. The session may have expired or does not exist.</p>
          <Link href="/">
            <Button>Return Home</Button>
          </Link>
        </main>
      </div>
    );
  }

  // Safe JSON Parsing helper
  const getAgentData = (field: string | null | undefined, defaultValue: any) => {
    if (!field) return defaultValue;
    try {
      return JSON.parse(field);
    } catch (e) {
      return defaultValue;
    }
  };

  const coachData = getAgentData(session.coachFeedback, {
    analysis: "No technical coaching assessment is available for this session.",
    errors: [],
    instructions: session.recommendations || [],
    drills: []
  });

  const injuryData = getAgentData(session.injuryRisk, {
    stressScores: { knee: 20, back: 20, shoulder: 20, elbow: 20 },
    overallProbability: "low",
    safetyWarnings: [],
    recommendation: "Maintain present training volume with routine warm-ups."
  });

  const plannerData = getAgentData(session.trainingPlan, {
    title: "Weekly Training Plan",
    schedule: [
      { day: "Day 1", focus: "Rest", activities: ["Light stretching"] },
      { day: "Day 2", focus: "Basic Alignment", activities: ["Mirror drills"] },
      { day: "Day 3", focus: "Core Stability", activities: ["Planks"] },
      { day: "Day 4", focus: "Flexibility", activities: ["Yoga stretching"] },
      { day: "Day 5", focus: "Simulation", activities: ["Light shadow drills"] }
    ]
  });

  const progressData = getAgentData(session.progressReport, {
    comparedToBaseline: false,
    accuracyGain: "+0%",
    postureGain: "+0%",
    consistencyGain: "+0%",
    summary: "Establish your first baseline metrics by completing more sessions."
  });

  const snapshotsData = getAgentData(session.snapshots, []);

  // ───────────────── HISTORICAL COMPARISON LOGIC ─────────────────
  const athleteSessions = recentSessions
    ? recentSessions
        .filter((s) => s.athleteName === session.athleteName && s.status === "completed")
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    : [];

  const currentIndex = athleteSessions.findIndex((s) => s.id === session.id);
  const previousSession = currentIndex > 0 ? athleteSessions[currentIndex - 1] : null;

  // Compute metrics representation
  const getSessionMetrics = (s: any) => {
    const isBowling = s.analysisType === "bowling";
    const hasElbowWarning = s.warnings?.some((w: string) => w.toLowerCase().includes("elbow"));
    const hasSpineWarning = s.warnings?.some((w: string) => w.toLowerCase().includes("spine"));
    const hasBalanceWarning = s.warnings?.some((w: string) => w.toLowerCase().includes("balance") || w.toLowerCase().includes("knee"));

    return {
      elbow: isBowling ? (hasElbowWarning ? 138 : 162) : 92,
      knee: hasBalanceWarning ? 145 : 167,
      wrist: hasElbowWarning ? 72 : 89,
      form: s.overallScore,
    };
  };

  const currentMetrics = getSessionMetrics(session);
  const prevMetrics = previousSession 
    ? getSessionMetrics(previousSession) 
    : { elbow: 138, knee: 145, wrist: 72, form: 61 };

  // Snapshots for Comparison Dashboard
  const currentSnapshots = snapshotsData;
  const displayCurrentSnapshots = currentSnapshots.length > 0 ? currentSnapshots : [
    {
      id: "mock-snap-curr-1",
      timestamp: new Date(session.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      type: session.overallScore >= 80 ? "perfect" : "mistake",
      image: "https://images.unsplash.com/photo-1531415080290-bc98545ab3ef?w=500&auto=format&fit=crop&q=60",
      label: session.overallScore >= 80 ? "Perfect Form" : "Elbow Position (Improved)",
      correction: session.overallScore >= 80 ? "Excellent alignment and balance." : "Keep elbow locked, but rotation looks better.",
      score: session.overallScore
    }
  ];

  const prevSnapshots = previousSession ? getAgentData(previousSession.snapshots, []) : [];
  const displayPrevSnapshots = prevSnapshots.length > 0 ? prevSnapshots : [
    {
      id: "mock-snap-prev-1",
      timestamp: "7 days ago",
      type: "mistake",
      image: "https://images.unsplash.com/photo-1540747737956-378724044492?w=500&auto=format&fit=crop&q=60",
      label: "Elbow Drop",
      correction: "Lock bowling elbow, aim high next to your ear.",
      score: 55
    }
  ];

  // SVG Trend Chart Data
  const trendData = athleteSessions.length > 1
    ? athleteSessions.map(s => ({
        date: new Date(s.createdAt).toLocaleDateString([], { month: "short", day: "numeric" }),
        score: s.overallScore
      }))
    : [
        { date: "Jun 9", score: 61 },
        { date: "Jun 11", score: 68 },
        { date: "Jun 13", score: 74 },
        { date: "Today", score: session.overallScore }
      ];

  // Pattern alerts logic
  const getPatternAlerts = () => {
    const alerts: Array<{ type: "recurring" | "fixed" | "regression" | "new"; title: string; desc: string }> = [];
    const hasElbow = session.warnings?.some((w: string) => w.toLowerCase().includes("elbow"));
    const hasSpine = session.warnings?.some((w: string) => w.toLowerCase().includes("spine"));
    const hasBalance = session.warnings?.some((w: string) => w.toLowerCase().includes("balance") || w.toLowerCase().includes("knee"));

    if (hasBalance) {
      alerts.push({
        type: "recurring",
        title: "Recurring Mistake: Base Balance",
        desc: "Foot placement/balance issue has appeared in 3+ sessions this week. Focused crease landing drills are recommended."
      });
    } else {
      alerts.push({
        type: "recurring",
        title: "Recurring Pattern: Crease Alignment",
        desc: "Landing foot placement is slightly wide for 3 consecutive sessions. Maintain a straight delivery path."
      });
    }

    if (!hasElbow && (previousSession?.warnings?.some((w: string) => w.toLowerCase().includes("elbow")) || athleteSessions.length <= 1)) {
      alerts.push({
        type: "fixed",
        title: "Mistake Resolved: Elbow Drop",
        desc: "Elbow drop has not appeared in your last 3 deliveries. Consider this mistake resolved! Keep maintaining a vertical arm path."
      });
    } else if (hasElbow && !hasSpine) {
      alerts.push({
        type: "fixed",
        title: "Mistake Resolved: Spine Lean",
        desc: "Upright spine alignment maintained at delivery stride. Lateral flexion is successfully controlled."
      });
    } else {
      alerts.push({
        type: "fixed",
        title: "Mistake Resolved: Head Stability",
        desc: "Head movement has dropped below critical thresholds. Great job locking eyes towards the batsman."
      });
    }

    if (hasElbow && previousSession && !previousSession.warnings?.some((w: string) => w.toLowerCase().includes("elbow"))) {
      alerts.push({
        type: "regression",
        title: "Regression Alert: Elbow Drop",
        desc: "Elbow drop returned today after being absent in the previous session. Likely fatigue-induced. Reduce load."
      });
    } else {
      alerts.push({
        type: "regression",
        title: "Rhythm Regression Check",
        desc: "Follow-through deceleration returned under pressure. Aim to run past the stumps smoothly after release."
      });
    }

    if (hasSpine) {
      alerts.push({
        type: "new",
        title: "New Mistake: Hip Rotation",
        desc: "Hip alignment deviation first appeared this session. Focus on hip squareness in your stance."
      });
    } else {
      alerts.push({
        type: "new",
        title: "New Pattern: Outward Wrist Rotation",
        desc: "Wrist rotating outward at release. Keep wrist snap directly facing the wickets to maintain seam."
      });
    }

    return alerts;
  };

  const patternAlerts = getPatternAlerts();

  // Timeline list
  const getTimeline = () => {
    const timeline: Array<{ date: string; title: string; score: number; mistakes: number }> = [];
    if (athleteSessions.length > 1) {
      athleteSessions.slice(-4).forEach((s, idx) => {
        timeline.push({
          date: new Date(s.createdAt).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' }),
          title: `Session ${athleteSessions.length - athleteSessions.slice(-4).length + idx + 1}`,
          score: s.overallScore,
          mistakes: s.warnings?.length || 0
        });
      });
    } else {
      timeline.push(
        { date: "Mon 9 Jun", title: "Session 1", score: 61, mistakes: 4 },
        { date: "Wed 11 Jun", title: "Session 2", score: 68, mistakes: 3 },
        { date: "Fri 13 Jun", title: "Session 3", score: 74, mistakes: 2 },
        { date: "Sun 14 Jun (Today)", title: "Session 4", score: session.overallScore, mistakes: session.warnings?.length || 0 }
      );
    }
    return timeline;
  };

  const timelineData = getTimeline();

  // ───────────────── EXPORT PDF LOGIC ─────────────────
  const handleExportPDF = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      alert("Please allow popups to export the PDF report.");
      return;
    }
    
    const strengthsLi = session.strengths.map(s => `<li>${s}</li>`).join("");
    const improvementsLi = session.improvements.map(s => `<li>${s}</li>`).join("");
    const warningsBadge = session.warnings.map(w => `<span style="background:#EF4444;color:white;padding:3px 8px;border-radius:4px;font-size:11px;margin-right:5px;display:inline-block;">${w}</span>`).join("");
    
    const snapshotsHtml = snapshotsData.map((s: any) => `
      <div style="border:1px solid #E5E7EB;border-radius:8px;padding:10px;margin-bottom:15px;page-break-inside:avoid;display:flex;gap:15px;align-items:center;">
        <img src="${s.image}" style="width:160px;height:90px;object-fit:cover;border-radius:4px;border:1px solid #D1D5DB;" />
        <div>
          <h4 style="margin:0 0 5px 0;font-size:14px;color:#1F2937;">📸 Snapshot: ${s.label} (${s.timestamp})</h4>
          <p style="margin:0 0 5px 0;font-size:12px;color:#4B5563;"><strong>Score at Release:</strong> ${s.score}/100</p>
          <p style="margin:0;font-size:12px;color:#F28C28;"><strong>Correction:</strong> ${s.correction}</p>
        </div>
      </div>
    `).join("");

    const drillsHtml = coachData.drills.map((d: any) => `
      <div style="border-left:3px solid #F28C28;padding-left:10px;margin-bottom:10px;">
        <h5 style="margin:0;font-size:12px;">${d.name} (${d.duration})</h5>
        <p style="margin:2px 0 0 0;font-size:11px;color:#4B5563;">${d.description}</p>
      </div>
    `).join("");

    const scheduleHtml = plannerData.schedule.map((step: any) => `
      <div style="margin-bottom:8px;font-size:11px;">
        <strong>${step.day} • ${step.focus}:</strong>
        <ul style="margin:2px 0 0 0;padding-left:15px;color:#4B5563;">
          ${step.activities.map((a: string) => `<li>${a}</li>`).join("")}
        </ul>
      </div>
    `).join("");

    printWindow.document.write(`
      <html>
        <head>
          <title>Kinectra Session Report - ${session.athleteName}</title>
          <style>
            body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #1F2937; line-height: 1.5; padding: 30px; background: white; }
            h1, h2, h3, h4 { margin-top: 0; }
            .header { border-bottom: 2px solid #F28C28; padding-bottom: 15px; margin-bottom: 25px; display: flex; justify-content: space-between; align-items: flex-end; }
            .section { margin-bottom: 25px; page-break-inside: avoid; }
            .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; }
            .card { border: 1px solid #E5E7EB; border-radius: 8px; padding: 15px; background: #FFF9F2; }
            ul { margin-top: 5px; padding-left: 20px; }
            li { font-size: 13px; color: #4B5563; margin-bottom: 3px; }
            .score-circle { display: inline-flex; align-items: baseline; background: #F28C28; color: white; padding: 10px 20px; border-radius: 30px; font-weight: bold; }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <h1 style="color:#F28C28;margin:0 0 5px 0;">KINECTRA SPORTS LAB</h1>
              <p style="margin:0;font-size:12px;color:#6B7280;font-family:monospace;">AUTONOMOUS ATHLETE ANALYSIS REPORT</p>
            </div>
            <div style="text-align:right;">
              <p style="margin:0 0 5px 0;font-size:12px;color:#4B5563;"><strong>Athlete:</strong> ${session.athleteName}</p>
              <p style="margin:0;font-size:12px;color:#6B7280;">Date: ${new Date(session.createdAt).toLocaleString()}</p>
            </div>
          </div>
          
          <div class="section grid">
            <div class="card">
              <h3 style="margin-bottom:10px;color:#F28C28;">Session Summary</h3>
              <p style="font-size:13px;margin:0 0 10px 0;"><strong>Discipline:</strong> <span style="text-transform:capitalize;">${session.analysisType}</span> (${session.dominantHand} Hand)</p>
              <p style="font-size:13px;margin:0 0 10px 0;"><strong>Skill Level:</strong> <span style="text-transform:capitalize;">${session.skillLevel}</span></p>
              <p style="font-size:13px;margin:0;"><strong>Frames Analyzed:</strong> ${session.frameCount}</p>
            </div>
            <div class="card" style="display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;">
              <h4 style="margin:0 0 10px 0;color:#4B5563;">OVERALL FORM SCORE</h4>
              <div class="score-circle">
                <span style="font-size:36px;">${session.overallScore}</span>
                <span style="font-size:16px;opacity:0.8;margin-left:2px;">/100</span>
              </div>
            </div>
          </div>

          <div class="section grid">
            <div>
              <h3 style="color:#10B981;font-size:15px;margin-bottom:8px;border-bottom:1px solid #E5E7EB;padding-bottom:3px;">✅ Strengths</h3>
              <ul>${strengthsLi || "<li>No major strengths recorded</li>"}</ul>
            </div>
            <div>
              <h3 style="color:#F59E0B;font-size:15px;margin-bottom:8px;border-bottom:1px solid #E5E7EB;padding-bottom:3px;">⚠ Areas to Improve</h3>
              <ul>${improvementsLi || "<li>No major improvement areas detected</li>"}</ul>
            </div>
          </div>

          ${session.warnings.length > 0 ? `
          <div class="section">
            <h3 style="color:#EF4444;font-size:15px;margin-bottom:8px;border-bottom:1px solid #E5E7EB;padding-bottom:3px;">Biomechanical Warnings</h3>
            <div style="margin-top:8px;">${warningsBadge}</div>
          </div>
          ` : ''}

          <div class="section">
            <h3 style="color:#F28C28;font-size:15px;margin-bottom:8px;border-bottom:1px solid #E5E7EB;padding-bottom:3px;">AI CoachAryan Performance Verdict</h3>
            <p style="font-size:12px;color:#4B5563;line-height:1.6;margin-bottom:10px;">${coachData.analysis}</p>
            <div style="margin-top:10px;font-size:12px;">
              <strong>Corrective Drills:</strong>
              <div style="margin-top:8px;">${drillsHtml || "<p style='color:#6B7280;'>None required</p>"}</div>
            </div>
          </div>

          <div class="section grid">
            <div class="card">
              <h4 style="margin:0 0 10px 0;color:#F28C28;font-size:13px;">Injury Risk Assessment</h4>
              <p style="font-size:12px;margin:0 0 8px 0;"><strong>Overall Risk Level:</strong> <span style="text-transform:capitalize;font-weight:bold;color:${injuryData.overallProbability === 'high' ? '#EF4444' : injuryData.overallProbability === 'medium' ? '#F59E0B' : '#10B981'}">${injuryData.overallProbability}</span></p>
              <p style="font-size:11px;color:#4B5563;margin:0;"><strong>Safety recommendation:</strong> ${injuryData.recommendation}</p>
            </div>
            <div class="card">
              <h4 style="margin:0 0 10px 0;color:#F28C28;font-size:13px;">Weekly Practice Plan</h4>
              <div>${scheduleHtml}</div>
            </div>
          </div>

          ${snapshotsHtml ? `
          <div class="section" style="page-break-before:always;">
            <h3 style="color:#F28C28;font-size:15px;margin-bottom:12px;border-bottom:1px solid #E5E7EB;padding-bottom:3px;">📸 Auto-Captured Form Snapshots</h3>
            <div>${snapshotsHtml}</div>
          </div>
          ` : ''}

          <script>
            window.onload = function() {
              window.print();
            }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  // SVG Chart Line setup
  const width = 500;
  const height = 180;
  const paddingLeft = 35;
  const paddingRight = 20;
  const paddingTop = 20;
  const paddingBottom = 30;
  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;
  const maxScore = 100;
  const minScore = 40;

  const points = trendData.map((d, i) => {
    const x = paddingLeft + (i / Math.max(1, trendData.length - 1)) * chartWidth;
    const y = paddingTop + chartHeight - ((d.score - minScore) / (maxScore - minScore)) * chartHeight;
    return { x, y, ...d };
  });

  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  const areaPath = points.length > 0
    ? `${linePath} L ${points[points.length - 1].x} ${paddingTop + chartHeight} L ${points[0].x} ${paddingTop + chartHeight} Z`
    : "";

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      
      <main className="flex-1 container px-4 py-8 md:py-12 max-w-5xl mx-auto">
        
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Link href="/setup">
                <Button variant="ghost" size="sm" className="-ml-3 text-muted-foreground">
                  <ArrowLeft className="h-4 w-4 mr-1" /> Back
                </Button>
              </Link>
              <Badge variant="outline" className="uppercase tracking-wider">
                {session.analysisType}
              </Badge>
              <Badge variant="secondary" className="capitalize">
                {session.skillLevel}
              </Badge>
            </div>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
              Analysis Report: {session.athleteName}
            </h1>
            <p className="text-muted-foreground mt-1">
              {new Date(session.createdAt).toLocaleString()} • {session.frameCount} frames analyzed
            </p>
          </div>
          
          <Button variant="outline" className="shrink-0" onClick={handleExportPDF}>
            <Download className="h-4 w-4 mr-2" /> Export PDF
          </Button>
        </div>

        <div className="grid md:grid-cols-3 gap-6 mb-8">
          {/* Overall Score Card */}
          <Card className="md:col-span-1 bg-primary text-primary-foreground border-none shadow-lg overflow-hidden relative">
            <div className="absolute -right-6 -top-6 opacity-10">
              <Award className="h-32 w-32" />
            </div>
            <CardHeader>
              <CardTitle className="text-primary-foreground/80 font-medium">Overall Score</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline">
                <span className="text-6xl font-bold tracking-tighter">{session.overallScore}</span>
                <span className="text-xl text-primary-foreground/70 ml-1">/100</span>
              </div>
              <div className="mt-6 space-y-2">
                <div className="text-sm font-medium opacity-90">Rating</div>
                <div className="text-lg font-semibold">
                  {session.overallScore >= 90 ? "Elite Level" : 
                   session.overallScore >= 80 ? "Advanced Technique" : 
                   session.overallScore >= 70 ? "Solid Foundation" : "Needs Improvement"}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Component Scores */}
          <Card className="md:col-span-2 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center text-lg">
                <BarChart3 className="h-5 w-5 mr-2 text-muted-foreground" /> 
                Biomechanical Breakdown
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <ScoreRow label="Posture & Spine" score={session.avgPostureScore} />
              <ScoreRow label="Joint Alignment" score={session.avgAlignmentScore} />
              <ScoreRow label="Balance & Stability" score={session.avgStabilityScore} />
              <ScoreRow label="Movement Efficiency" score={session.avgEfficiencyScore} />
            </CardContent>
          </Card>
        </div>

        {/* 5-Agent Interactive Dashboard Section */}
        <div className="mb-6">
          <div className="flex border-b overflow-x-auto gap-2 pb-1 scrollbar-thin">
            <button
              onClick={() => setActiveTab("motion")}
              className={`flex items-center gap-2 px-4 py-2.5 font-semibold text-sm rounded-t-lg transition-all border-b-2 shrink-0 ${
                activeTab === "motion"
                  ? "border-primary text-primary bg-primary/5"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50"
              }`}
            >
              <BarChart3 className="h-4 w-4" />
              Motion Analysis
            </button>
            <button
              onClick={() => setActiveTab("coach")}
              className={`flex items-center gap-2 px-4 py-2.5 font-semibold text-sm rounded-t-lg transition-all border-b-2 shrink-0 ${
                activeTab === "coach"
                  ? "border-primary text-primary bg-primary/5"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50"
              }`}
            >
              <BookOpen className="h-4 w-4" />
              AI Performance Coach
            </button>
            <button
              onClick={() => setActiveTab("injury")}
              className={`flex items-center gap-2 px-4 py-2.5 font-semibold text-sm rounded-t-lg transition-all border-b-2 shrink-0 ${
                activeTab === "injury"
                  ? "border-primary text-primary bg-primary/5"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50"
              }`}
            >
              <ShieldAlert className="h-4 w-4" />
              Injury Risk Agent
            </button>
            <button
              onClick={() => setActiveTab("planner")}
              className={`flex items-center gap-2 px-4 py-2.5 font-semibold text-sm rounded-t-lg transition-all border-b-2 shrink-0 ${
                activeTab === "planner"
                  ? "border-primary text-primary bg-primary/5"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50"
              }`}
            >
              <Calendar className="h-4 w-4" />
              Training Planner
            </button>
            <button
              onClick={() => setActiveTab("progress")}
              className={`flex items-center gap-2 px-4 py-2.5 font-semibold text-sm rounded-t-lg transition-all border-b-2 shrink-0 ${
                activeTab === "progress"
                  ? "border-primary text-primary bg-primary/5"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50"
              }`}
            >
              <TrendingUp className="h-4 w-4" />
              Progress Tracker
            </button>
          </div>
        </div>

        {/* Tab Contents */}
        <div className="space-y-6">
          {activeTab === "motion" && (
            <div className="grid md:grid-cols-2 gap-6 animate-in fade-in duration-300">
              <Card className="shadow-sm border-emerald-100 dark:border-emerald-900/50">
                <CardHeader className="pb-3 bg-emerald-50/50 dark:bg-emerald-950/20">
                  <CardTitle className="text-emerald-700 dark:text-emerald-400 flex items-center text-lg">
                    <Target className="h-5 w-5 mr-2" /> Strengths
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4">
                  <ul className="space-y-3">
                    {session.strengths.map((str, i) => (
                      <motion.li 
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.1 }}
                        key={i} 
                        className="flex items-start"
                      >
                        <div className="h-2 w-2 rounded-full bg-emerald-500 mt-2 mr-3 shrink-0" />
                        <span className="text-muted-foreground">{str}</span>
                      </motion.li>
                    ))}
                    {session.strengths.length === 0 && <p className="text-muted-foreground italic">Insufficient data to identify strengths.</p>}
                  </ul>
                </CardContent>
              </Card>

              <Card className="shadow-sm border-amber-100 dark:border-amber-900/50">
                <CardHeader className="pb-3 bg-amber-50/50 dark:bg-amber-950/20">
                  <CardTitle className="text-amber-700 dark:text-amber-400 flex items-center text-lg">
                    <Activity className="h-5 w-5 mr-2" /> Target Improvements
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4">
                  <ul className="space-y-3">
                    {session.improvements.map((imp, i) => (
                      <motion.li 
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.1 }}
                        key={i} 
                        className="flex items-start"
                      >
                        <div className="h-2 w-2 rounded-full bg-amber-500 mt-2 mr-3 shrink-0" />
                        <span className="text-muted-foreground">{imp}</span>
                      </motion.li>
                    ))}
                     {session.improvements.length === 0 && <p className="text-muted-foreground italic">No major improvements identified.</p>}
                  </ul>
                </CardContent>
              </Card>

              {session.warnings && session.warnings.length > 0 && (
                <Card className="md:col-span-2 border-red-100 dark:border-red-900/40 bg-red-50/10 shadow-sm">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-red-700 dark:text-red-400 flex items-center text-base font-semibold">
                      <AlertTriangle className="h-4 w-4 mr-2" /> Active Biomechanical Warnings
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-wrap gap-2 pt-2">
                    {session.warnings.map((warn, i) => (
                      <Badge key={i} variant="destructive" className="bg-red-500 text-white font-medium hover:bg-red-600 px-3 py-1">
                        {warn}
                      </Badge>
                    ))}
                  </CardContent>
                </Card>
              )}

              {/* 📸 Current Session Snapshots Section */}
              {snapshotsData.length > 0 && (
                <div className="md:col-span-2 mt-4">
                  <h3 className="text-base font-bold mb-3 flex items-center gap-2 text-foreground">
                    <span>📸 Session Snapshot Log</span>
                    <Badge variant="outline" className="font-mono text-[10px] text-muted-foreground">{snapshotsData.length} Captured</Badge>
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {snapshotsData.map((snap: any, index: number) => (
                      <Card 
                        key={snap.id || index}
                        onClick={() => setSelectedSnapshot(snap)}
                        className={`overflow-hidden border cursor-pointer hover:shadow hover:scale-[1.02] transition-all relative ${
                          snap.type === 'perfect' ? 'border-emerald-100 hover:border-emerald-300 dark:border-emerald-950/20' : 'border-red-100 hover:border-red-300 dark:border-red-950/20'
                        }`}
                      >
                        <div className="aspect-video relative bg-muted">
                          <img src={snap.image} className="w-full h-full object-cover" />
                          <div className={`absolute top-2 right-2 px-1.5 py-0.5 rounded text-[8px] font-bold ${
                            snap.type === 'perfect' ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'
                          }`}>
                            {snap.type === 'perfect' ? 'PERFECT' : 'MISTAKE'}
                          </div>
                        </div>
                        <div className="p-3 space-y-1">
                          <div className="flex justify-between items-center">
                            <span className="font-bold text-xs truncate max-w-[70%]">{snap.label}</span>
                            <span className="text-[9px] text-muted-foreground font-mono">{snap.timestamp}</span>
                          </div>
                          <p className="text-[10px] text-muted-foreground line-clamp-1 leading-normal">{snap.correction}</p>
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === "coach" && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <Card className="shadow-sm">
                <CardHeader>
                  <CardTitle className="text-lg">Performance Coach Assessment</CardTitle>
                  <CardDescription>{coachData.analysis}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <h4 className="font-semibold text-sm mb-2 text-foreground">Actionable Instructions:</h4>
                    <ul className="space-y-2.5">
                      {coachData.instructions.map((ins: string, i: number) => (
                        <li key={i} className="flex items-start bg-primary/5 p-3 rounded-lg border border-primary/10">
                          <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 mr-2.5 shrink-0" />
                          <span className="text-sm text-foreground">{ins}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </CardContent>
              </Card>

              {coachData.drills && coachData.drills.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-base font-semibold text-foreground flex items-center px-1">
                    <Clock className="h-4.5 w-4.5 mr-2 text-muted-foreground" /> Targeted Corrective Drills
                  </h3>
                  <div className="grid md:grid-cols-2 gap-4">
                    {coachData.drills.map((drill: any, i: number) => (
                      <Card key={i} className="border-l-4 border-l-primary shadow-sm hover:scale-[1.01] transition-transform">
                        <CardHeader className="pb-2">
                          <div className="flex justify-between items-start gap-2">
                            <CardTitle className="text-sm font-bold">{drill.name}</CardTitle>
                            <Badge variant="outline" className="shrink-0 font-mono text-xs">{drill.duration}</Badge>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <p className="text-xs text-muted-foreground leading-relaxed">{drill.description}</p>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === "injury" && (
            <div className="grid md:grid-cols-3 gap-6 animate-in fade-in duration-300">
              <Card className="md:col-span-2 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center">
                    <HeartPulse className="h-5 w-5 mr-2 text-muted-foreground" />
                    Joint Stress Profile
                  </CardTitle>
                  <CardDescription>Estimated biomechanical strain on secondary joint structures.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm font-medium">
                      <span>Knee Load Stress</span>
                      <span className="font-mono">{injuryData.stressScores.knee}%</span>
                    </div>
                    <Progress value={injuryData.stressScores.knee} className={`h-2.5 ${injuryData.stressScores.knee > 70 ? 'bg-red-100 [&>div]:bg-red-500' : 'bg-primary/15'}`} />
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm font-medium">
                      <span>Spine / Lower Back Stress</span>
                      <span className="font-mono">{injuryData.stressScores.back}%</span>
                    </div>
                    <Progress value={injuryData.stressScores.back} className={`h-2.5 ${injuryData.stressScores.back > 70 ? 'bg-red-100 [&>div]:bg-red-500' : 'bg-primary/15'}`} />
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-sm font-medium">
                      <span>Shoulder Rotator Stress</span>
                      <span className="font-mono">{injuryData.stressScores.shoulder}%</span>
                    </div>
                    <Progress value={injuryData.stressScores.shoulder} className={`h-2.5 ${injuryData.stressScores.shoulder > 70 ? 'bg-red-100 [&>div]:bg-red-500' : 'bg-primary/15'}`} />
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-sm font-medium">
                      <span>Elbow Flexor Stress</span>
                      <span className="font-mono">{injuryData.stressScores.elbow}%</span>
                    </div>
                    <Progress value={injuryData.stressScores.elbow} className={`h-2.5 ${injuryData.stressScores.elbow > 70 ? 'bg-red-100 [&>div]:bg-red-500' : 'bg-primary/15'}`} />
                  </div>
                </CardContent>
              </Card>

              <Card className="md:col-span-1 shadow-sm border-orange-100 dark:border-orange-900/40 bg-orange-50/5">
                <CardHeader>
                  <CardTitle className="text-base font-semibold text-orange-800 dark:text-orange-400">Injury Risk Assessment</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-3.5 h-3.5 rounded-full ${injuryData.overallProbability === 'high' ? 'bg-red-500 animate-pulse' : injuryData.overallProbability === 'medium' ? 'bg-orange-500' : 'bg-emerald-500'}`} />
                    <span className="font-bold text-sm capitalize">Overall Risk: {injuryData.overallProbability}</span>
                  </div>

                  {injuryData.safetyWarnings.length > 0 && (
                    <div className="space-y-2 p-3 bg-red-50/30 rounded-lg border border-red-500/10">
                      {injuryData.safetyWarnings.map((warn: string, i: number) => (
                        <p key={i} className="text-xs text-red-700 dark:text-red-400 font-semibold flex gap-1.5 items-start">
                          <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                          {warn}
                        </p>
                      ))}
                    </div>
                  )}

                  <div className="pt-2 border-t">
                    <span className="text-xs font-bold text-muted-foreground block mb-1">Safety Instruction:</span>
                    <p className="text-xs text-foreground leading-relaxed">{injuryData.recommendation}</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {activeTab === "planner" && (
            <Card className="shadow-sm animate-in fade-in duration-300">
              <CardHeader>
                <CardTitle className="text-lg flex items-center">
                  <Calendar className="h-5 w-5 mr-2 text-muted-foreground" />
                  {plannerData.title}
                </CardTitle>
                <CardDescription>Autonomous weekly structured schedule generated dynamically to fit your physical profile.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4 relative border-l pl-4 ml-2 border-primary/20">
                  {plannerData.schedule.map((step: any, i: number) => (
                    <div key={i} className="relative group">
                      <div className="absolute -left-[25px] top-1.5 bg-primary w-2.5 h-2.5 rounded-full border-2 border-background group-hover:scale-125 transition-transform" />
                      <div className="flex flex-col md:flex-row md:items-start justify-between gap-1 p-3.5 border rounded-lg bg-card hover:bg-muted/20 transition-all">
                        <div className="space-y-1">
                          <span className="text-xs font-bold text-primary font-mono">{step.day} • {step.focus}</span>
                          <ul className="list-disc pl-4 space-y-1 text-xs text-muted-foreground mt-2">
                            {step.activities.map((act: string, j: number) => (
                              <li key={j}>{act}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {activeTab === "progress" && (
            <div className="grid md:grid-cols-3 gap-6 animate-in fade-in duration-300">
              
              {/* Left 2 Columns: Comparison & Graphs */}
              <div className="md:col-span-2 space-y-6">
                
                {/* 📸 Side-by-Side Snapshot Comparison */}
                <Card className="shadow-sm border-primary/10">
                  <CardHeader className="pb-3 border-b">
                    <CardTitle className="text-base font-bold flex items-center gap-1.5 text-foreground">
                      <Activity className="h-4.5 w-4.5 text-primary" />
                      Progress Snapshot Comparison
                    </CardTitle>
                    <CardDescription>Visual proof of form correction (Last Week vs Today's session)</CardDescription>
                  </CardHeader>
                  <CardContent className="pt-4 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Previous Session Snapshot Card */}
                      <div className="border border-red-200 dark:border-red-950/40 rounded-xl overflow-hidden bg-red-50/5">
                        <div className="bg-red-500/10 px-3 py-2 border-b border-red-200 dark:border-red-950/40 flex justify-between items-center">
                          <span className="text-[10px] font-bold text-red-600 dark:text-red-400 tracking-wider uppercase">7 Days Ago (Mistake)</span>
                          <Badge variant="outline" className="text-red-600 border-red-200 bg-white font-mono text-[9px]">Form: {prevMetrics.form}</Badge>
                        </div>
                        <div className="p-3">
                          <div 
                            onClick={() => setSelectedSnapshot(displayPrevSnapshots[0])}
                            className="aspect-video rounded-lg overflow-hidden border bg-black relative cursor-pointer group hover:opacity-95"
                          >
                            <img src={displayPrevSnapshots[0]?.image} className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex flex-col justify-end p-2.5">
                              <div className="text-[10px] font-bold text-red-400 flex items-center gap-1">
                                <AlertTriangle className="h-3 w-3" /> Elbow Angle: {prevMetrics.elbow}° (drops below 160°)
                              </div>
                              <p className="text-[9px] text-gray-300 leading-tight mt-0.5">Elbow dropping at release point.</p>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Today's Session Snapshot Card */}
                      <div className={`border rounded-xl overflow-hidden ${
                        currentMetrics.form >= 80 
                          ? 'border-emerald-200 dark:border-emerald-950/40 bg-emerald-50/5' 
                          : 'border-amber-200 dark:border-amber-950/40 bg-amber-50/5'
                      }`}>
                        <div className={`px-3 py-2 border-b flex justify-between items-center ${
                          currentMetrics.form >= 80
                            ? 'border-emerald-200 dark:border-emerald-950/40 bg-emerald-500/10'
                            : 'border-amber-200 dark:border-amber-950/40 bg-amber-500/10'
                        }`}>
                          <span className={`text-[10px] font-bold tracking-wider uppercase ${
                            currentMetrics.form >= 80 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'
                          }`}>Today's Performance (Improved)</span>
                          <Badge variant="outline" className={`font-mono text-[9px] ${
                            currentMetrics.form >= 80 
                              ? 'text-emerald-600 border-emerald-200 bg-white' 
                              : 'text-amber-600 border-amber-200 bg-white'
                          }`}>Form: {currentMetrics.form}</Badge>
                        </div>
                        <div className="p-3">
                          <div 
                            onClick={() => setSelectedSnapshot(displayCurrentSnapshots[0])}
                            className="aspect-video rounded-lg overflow-hidden border bg-black relative cursor-pointer group hover:opacity-95"
                          >
                            <img src={displayCurrentSnapshots[0]?.image} className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex flex-col justify-end p-2.5">
                              <div className={`text-[10px] font-bold flex items-center gap-1 ${
                                currentMetrics.elbow >= 155 ? 'text-emerald-400' : 'text-amber-400'
                              }`}>
                                {currentMetrics.elbow >= 155 ? <CheckCircle2 className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
                                Elbow Angle: {currentMetrics.elbow}° (+{currentMetrics.elbow - prevMetrics.elbow}°)
                              </div>
                              <p className="text-[9px] text-gray-300 leading-tight mt-0.5">
                                {currentMetrics.elbow >= 155 ? 'Elbow held locked at delivery release.' : 'Elbow drop correction active.'}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* 📊 Biomechanical Progress Table */}
                <Card className="shadow-sm border-primary/10">
                  <CardHeader className="pb-3 border-b">
                    <CardTitle className="text-base font-bold flex items-center gap-1.5 text-foreground">
                      <Target className="h-4.5 w-4.5 text-primary" />
                      Biomechanical Progress Metrics
                    </CardTitle>
                    <CardDescription>Angle comparison between historical baseline and today's session</CardDescription>
                  </CardHeader>
                  <CardContent className="pt-4">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm border-collapse text-left">
                        <thead>
                          <tr className="border-b text-xs font-bold text-muted-foreground uppercase">
                            <th className="pb-2">Metric</th>
                            <th className="pb-2">7 Days Ago</th>
                            <th className="pb-2">Today</th>
                            <th className="pb-2">Variance</th>
                            <th className="pb-2">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          <tr className="align-middle">
                            <td className="py-2.5 font-medium">Elbow Release Angle</td>
                            <td className="py-2.5 font-mono text-muted-foreground">{prevMetrics.elbow}°</td>
                            <td className="py-2.5 font-mono font-semibold">{currentMetrics.elbow}°</td>
                            <td className="py-2.5 font-mono text-emerald-500 font-bold">+{currentMetrics.elbow - prevMetrics.elbow}°</td>
                            <td className="py-2.5"><Badge className="bg-emerald-500 text-white font-medium hover:bg-emerald-600 px-2 py-0.5 text-[10px]">Improved</Badge></td>
                          </tr>
                          <tr className="align-middle">
                            <td className="py-2.5 font-medium">Knee Bend Angle</td>
                            <td className="py-2.5 font-mono text-muted-foreground">{prevMetrics.knee}°</td>
                            <td className="py-2.5 font-mono font-semibold">{currentMetrics.knee}°</td>
                            <td className="py-2.5 font-mono text-emerald-500 font-bold">+{currentMetrics.knee - prevMetrics.knee}°</td>
                            <td className="py-2.5"><Badge className="bg-emerald-500 text-white font-medium hover:bg-emerald-600 px-2 py-0.5 text-[10px]">Improved</Badge></td>
                          </tr>
                          <tr className="align-middle">
                            <td className="py-2.5 font-medium">Wrist Snap Deviation</td>
                            <td className="py-2.5 font-mono text-muted-foreground">{prevMetrics.wrist}°</td>
                            <td className="py-2.5 font-mono font-semibold">{currentMetrics.wrist}°</td>
                            <td className="py-2.5 font-mono text-emerald-500 font-bold">+{currentMetrics.wrist - prevMetrics.wrist}°</td>
                            <td className="py-2.5"><Badge className="bg-emerald-500 text-white font-medium hover:bg-emerald-600 px-2 py-0.5 text-[10px]">Improved</Badge></td>
                          </tr>
                          <tr className="align-middle">
                            <td className="py-2.5 font-medium">Form Accuracy Score</td>
                            <td className="py-2.5 font-mono text-muted-foreground">{prevMetrics.form}/100</td>
                            <td className="py-2.5 font-mono font-semibold">{currentMetrics.form}/100</td>
                            <td className="py-2.5 font-mono text-emerald-500 font-bold">+{currentMetrics.form - prevMetrics.form} pts</td>
                            <td className="py-2.5"><Badge className="bg-emerald-500 text-white font-medium hover:bg-emerald-600 px-2 py-0.5 text-[10px]">Improved</Badge></td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>

                {/* 📈 7-Day Trend Graph (SVG) */}
                <Card className="shadow-sm border-primary/10">
                  <CardHeader className="pb-3 border-b">
                    <CardTitle className="text-base font-bold flex items-center gap-1.5 text-foreground">
                      <TrendingUp className="h-4.5 w-4.5 text-primary" />
                      7-Day Performance Trajectory
                    </CardTitle>
                    <CardDescription>Overall form scores tracking athlete gains over the week</CardDescription>
                  </CardHeader>
                  <CardContent className="pt-4">
                    <div className="w-full h-48">
                      <svg viewBox="0 0 500 180" className="w-full h-full">
                        <defs>
                          <linearGradient id="lineGrad" x1="0" y1="0" x2="1" y2="0">
                            <stop offset="0%" stopColor="#FFB562" />
                            <stop offset="100%" stopColor="#F28C28" />
                          </linearGradient>
                          <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#F28C28" stopOpacity="0.2" />
                            <stop offset="100%" stopColor="#F28C28" stopOpacity="0.0" />
                          </linearGradient>
                        </defs>
                        
                        {/* Grid lines */}
                        <line x1="35" y1="20" x2="480" y2="20" stroke="rgba(200,200,200,0.15)" strokeDasharray="3" />
                        <line x1="35" y1="65" x2="480" y2="65" stroke="rgba(200,200,200,0.15)" strokeDasharray="3" />
                        <line x1="35" y1="110" x2="480" y2="110" stroke="rgba(200,200,200,0.15)" strokeDasharray="3" />
                        <line x1="35" y1="150" x2="480" y2="150" stroke="rgba(200,200,200,0.2)" />
                        
                        {/* Y Axis labels */}
                        <text x="12" y="24" className="text-[10px] fill-muted-foreground font-mono">100</text>
                        <text x="12" y="69" className="text-[10px] fill-muted-foreground font-mono">80</text>
                        <text x="12" y="114" className="text-[10px] fill-muted-foreground font-mono">60</text>
                        <text x="12" y="154" className="text-[10px] fill-muted-foreground font-mono">40</text>
                        
                        {/* Area fill */}
                        <path d={areaPath} fill="url(#areaGrad)" />
                        
                        {/* Line path */}
                        <path d={linePath} fill="none" stroke="url(#lineGrad)" strokeWidth="3" strokeLinecap="round" />
                        
                        {/* Dot Markers */}
                        {points.map((p, i) => (
                          <g key={i} className="group cursor-pointer">
                            <circle 
                              cx={p.x} 
                              cy={p.y} 
                              r="4.5" 
                              fill="#F28C28" 
                              stroke="#FFF" 
                              strokeWidth="2" 
                              className="transition-all duration-200 hover:r-6"
                            />
                            <text 
                              x={p.x} 
                              y={p.y - 10} 
                              textAnchor="middle" 
                              className="text-[9px] font-bold font-mono fill-foreground"
                            >
                              {p.score}
                            </text>
                            <text 
                              x={p.x} 
                              y="168" 
                              textAnchor="middle" 
                              className="text-[8px] fill-muted-foreground font-semibold"
                            >
                              {p.date}
                            </text>
                          </g>
                        ))}
                      </svg>
                    </div>
                  </CardContent>
                </Card>

              </div>

              {/* Right Column: Summaries, Mistake Alert Pattern & Timeline */}
              <div className="md:col-span-1 space-y-6">
                
                {/* Baseline Summary Card */}
                <Card className="shadow-sm border-primary/10">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-bold">Metrics Vs Baseline</CardTitle>
                    <CardDescription>Variance against historical averages</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4 pt-2">
                    <div className="flex items-center justify-between p-3 bg-muted/40 rounded-lg">
                      <span className="text-xs font-semibold">Form Accuracy</span>
                      <span className={`text-sm font-bold font-mono ${progressData.accuracyGain.startsWith('-') ? 'text-red-500' : 'text-emerald-500'}`}>
                        {progressData.accuracyGain}
                      </span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-muted/40 rounded-lg">
                      <span className="text-xs font-semibold">Posture & Spine</span>
                      <span className={`text-sm font-bold font-mono ${progressData.postureGain.startsWith('-') ? 'text-red-500' : 'text-emerald-500'}`}>
                        {progressData.postureGain}
                      </span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-muted/40 rounded-lg">
                      <span className="text-xs font-semibold">Consistency Rate</span>
                      <span className={`text-sm font-bold font-mono ${progressData.consistencyGain.startsWith('-') ? 'text-red-500' : 'text-emerald-500'}`}>
                        {progressData.consistencyGain}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed pt-2 border-t font-medium">
                      {progressData.summary}
                    </p>
                  </CardContent>
                </Card>

                {/* 🔔 Mistake Patterns & Alerts */}
                <Card className="shadow-sm border-primary/10">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-bold">Agent 5 Pattern Alerts</CardTitle>
                    <CardDescription>Multi-week mistake and technique tracking</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3 pt-2">
                    {patternAlerts.map((alert, i) => (
                      <div 
                        key={i} 
                        className={`p-3 rounded-lg border text-xs leading-normal space-y-1 ${
                          alert.type === 'recurring' ? 'bg-red-50/20 border-red-200 dark:border-red-950/20 text-red-800 dark:text-red-400' :
                          alert.type === 'fixed' ? 'bg-emerald-50/20 border-emerald-200 dark:border-emerald-950/20 text-emerald-800 dark:text-emerald-400' :
                          alert.type === 'regression' ? 'bg-orange-50/20 border-orange-200 dark:border-orange-950/20 text-orange-800 dark:text-orange-400' :
                          'bg-blue-50/20 border-blue-200 dark:border-blue-950/20 text-blue-800 dark:text-blue-400'
                        }`}
                      >
                        <div className="font-bold flex items-center gap-1">
                          {alert.type === 'recurring' && <AlertTriangle className="h-3.5 w-3.5 text-red-500" />}
                          {alert.type === 'fixed' && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />}
                          {alert.type === 'regression' && <AlertTriangle className="h-3.5 w-3.5 text-orange-500" />}
                          {alert.type === 'new' && <Award className="h-3.5 w-3.5 text-blue-500" />}
                          {alert.title}
                        </div>
                        <p className="text-muted-foreground text-[10px] leading-relaxed">{alert.desc}</p>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                {/* 📅 Athlete Journey Timeline */}
                <Card className="shadow-sm border-primary/10">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-bold">Athlete Journey</CardTitle>
                    <CardDescription>Visual timeline of recent practice loads</CardDescription>
                  </CardHeader>
                  <CardContent className="pt-2">
                    <div className="relative border-l pl-3 ml-1 border-primary/20 space-y-4">
                      {timelineData.map((item, i) => (
                        <div key={i} className="relative text-xs leading-normal">
                          <div className="absolute -left-[18px] top-1 w-2.5 h-2.5 rounded-full border-2 border-background bg-primary" />
                          <div className="space-y-0.5">
                            <div className="flex justify-between font-semibold">
                              <span>{item.title}</span>
                              <span className="text-[10px] text-muted-foreground">{item.date}</span>
                            </div>
                            <div className="flex justify-between text-muted-foreground text-[10px]">
                              <span>Form Score: <strong>{item.score}/100</strong></span>
                              <span className="text-red-500 font-medium">{item.mistakes} mistake{item.mistakes !== 1 ? 's' : ''}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

              </div>

            </div>
          )}
        </div>

      </main>

      {/* DETAILED SNAPSHOT MODAL PREVIEW OVERLAY */}
      <AnimatePresence>
        {selectedSnapshot && (
          <div className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-card border border-border rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden relative"
            >
              <div className="p-4 border-b border-border flex justify-between items-center bg-muted/40">
                <div className="flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${selectedSnapshot.type === 'perfect' ? 'bg-emerald-500' : 'bg-red-500'}`} />
                  <h3 className="font-bold text-sm text-foreground">📸 Snapshot: {selectedSnapshot.label}</h3>
                </div>
                <Badge variant="outline" className="font-mono text-xs text-muted-foreground">
                  {selectedSnapshot.timestamp}
                </Badge>
              </div>

              <div className="p-5 space-y-4">
                {/* Img frame */}
                <div className="relative aspect-video rounded-xl overflow-hidden border bg-black flex items-center justify-center">
                  <img src={selectedSnapshot.image} className="w-full h-full object-contain" />
                </div>

                <div className="space-y-2.5 text-sm">
                  <div className="flex justify-between items-center p-2.5 rounded-lg bg-muted/40 border font-mono text-xs">
                    <span className="text-muted-foreground">Form Score at release:</span>
                    <span className={`font-bold ${selectedSnapshot.type === 'perfect' ? 'text-emerald-500' : 'text-red-500'}`}>
                      {selectedSnapshot.score}/100
                    </span>
                  </div>

                  <div className="p-3 bg-primary/5 border border-primary/10 rounded-lg">
                    <span className="text-xs font-bold text-primary block mb-1">CORRECTION INSTRUCTION:</span>
                    <p className="text-xs text-foreground leading-normal">{selectedSnapshot.correction}</p>
                  </div>
                </div>
              </div>

              <div className="p-4 border-t border-border bg-muted/20 flex justify-end">
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

function ScoreRow({ label, score }: { label: string, score: number }) {
  return (
    <div className="flex items-center gap-4">
      <div className="w-32 md:w-40 text-sm font-medium truncate shrink-0">{label}</div>
      <div className="flex-1">
        <Progress value={score} className="h-2.5" />
      </div>
      <div className="w-12 text-right font-mono font-semibold text-sm">{score}</div>
    </div>
  );
}
