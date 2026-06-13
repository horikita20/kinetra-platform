import { useRoute, Link } from "wouter";
import { ArrowLeft, Download, Award, BarChart3, Target, Activity } from "lucide-react";
import { useGetSession, getGetSessionQueryKey } from "@workspace/api-client-react";
import { motion } from "framer-motion";

import { Navbar } from "@/components/layout/navbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

export default function Results() {
  const [, params] = useRoute("/results/:sessionId");
  const sessionId = params?.sessionId;

  const { data: session, isLoading, isError } = useGetSession(sessionId || "", {
    query: {
      enabled: !!sessionId,
      queryKey: getGetSessionQueryKey(sessionId || "")
    }
  });

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
          
          <Button variant="outline" className="shrink-0">
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

        {/* Insights Grid */}
        <div className="grid md:grid-cols-2 gap-6">
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
        </div>

      </main>
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
      <div className="w-12 text-right font-mono font-semibold">{score}</div>
    </div>
  );
}
