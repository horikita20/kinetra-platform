import { db, sessionsTable } from "@workspace/db";
import { eq, and, ne } from "drizzle-orm";
import { logger } from "../lib/logger";

interface SessionInfo {
  athleteName: string;
  analysisType: string;
  skillLevel: string;
  dominantHand: string;
  overallScore: number;
  avgPostureScore: number;
  avgAlignmentScore: number;
  avgStabilityScore: number;
  avgEfficiencyScore: number;
  warnings: string[];
}

export interface MultiAgentReport {
  coachFeedback: string;
  injuryRisk: string;
  trainingPlan: string;
  progressReport: string;
}

/**
 * Autonomous Multi-Agent Sports Intelligence Engine
 */
export async function runMultiAgentPipeline(
  currentSessionId: string,
  session: SessionInfo
): Promise<MultiAgentReport> {
  const {
    athleteName,
    analysisType,
    skillLevel,
    dominantHand,
    overallScore,
    avgPostureScore,
    avgAlignmentScore,
    avgStabilityScore,
    avgEfficiencyScore,
    warnings,
  } = session;

  logger.info({ athleteName, currentSessionId }, "Running autonomous multi-agent pipeline");

  // Fetch historical completed sessions for this athlete to feed to Agent 3 and Agent 5
  let history: any[] = [];
  try {
    history = await db
      .select()
      .from(sessionsTable)
      .where(
        and(
          eq(sessionsTable.athleteName, athleteName),
          eq(sessionsTable.status, "completed"),
          ne(sessionsTable.id, currentSessionId)
        )
      )
      .limit(10);
  } catch (err) {
    logger.error({ err }, "Failed to fetch historical sessions for multi-agent engine");
  }

  // -------------------------------------------------------------
  // AGENT 2 — Performance Coach Agent
  // -------------------------------------------------------------
  let coachFeedback = "";
  const coachDrills: any[] = [];
  const coachErrors: string[] = [];
  const coachInstructions: string[] = [];

  if (analysisType === "bowling") {
    if (warnings.includes("Elbow angle too low")) {
      coachErrors.push("Elbow drops at release point");
      coachInstructions.push("Maintain a high release point closer to your ear. Keep your arm path vertical.");
      coachDrills.push({
        name: "Wall Shadow Bowling",
        description: "Stand next to a wall. Practice bowling arms paths without a ball, ensuring your bowling hand does not swipe outwards. Focus on elbow height.",
        duration: "10 minutes"
      });
    }
    if (warnings.includes("Excessive spine tilt")) {
      coachErrors.push("Lateral trunk flexion (spine tilt > 30°)");
      coachInstructions.push("Keep your upper body upright. Engage your core muscles during your final delivery stride to prevent side-bending.");
      coachDrills.push({
        name: "Upright Stride Drills",
        description: "Practice the final delivery stride over a line on the ground, holding your finish position upright for 3 seconds.",
        duration: "15 minutes"
      });
    }
    if (warnings.includes("Poor shoulder rotation")) {
      coachErrors.push("Shoulders open too early / poor rotation");
      coachInstructions.push("Keep your non-bowling shoulder aligned with the target as long as possible before rotating. Explode through the crease.");
      coachDrills.push({
        name: "Target Shoulder Alignment Checks",
        description: "Set up a mirror or camera in front. Perform walk-up deliveries focusing on pointing your non-bowling shoulder at the target before release.",
        duration: "12 minutes"
      });
    }

    if (coachErrors.length === 0) {
      coachInstructions.push("Excellent posture and mechanics. Focus on maintaining this tempo.");
      coachDrills.push({
        name: "Target Spot Bowling",
        description: "Set a coin/target on a good length. Bowl 18 deliveries focusing on consistent repetition of current posture.",
        duration: "15 minutes"
      });
    }
  } else { // Batting
    if (warnings.includes("Head moving excessively")) {
      coachErrors.push("Unstable head positioning at ball release");
      coachInstructions.push("Ensure your eyes are level and your head remains steady. Lead with your head towards the line of the ball.");
      coachDrills.push({
        name: "Tennis Ball Drop Drills",
        description: "Have a partner drop a tennis ball from shoulder height. Practice stepping forward and catch it after one bounce with a stable head.",
        duration: "10 minutes"
      });
    }
    if (warnings.includes("Balance unstable")) {
      coachErrors.push("Unstable landing/weight transfer");
      coachInstructions.push("Establish a wider, sturdier base. Lower your center of gravity slightly and plant your front foot firmly.");
      coachDrills.push({
        name: "Balance Board & Stance Holds",
        description: "Hold your batting stance on one leg or a balance board for 30-second increments to build lower body stability.",
        duration: "8 minutes"
      });
    }
    if (warnings.includes("Front foot delayed")) {
      coachErrors.push("Delayed front foot trigger movement");
      coachInstructions.push("Trigger your front foot movement earlier. Make a decisive step forward as the bowler enters the release stride.");
      coachDrills.push({
        name: "Drop-Ball Drive Drills",
        description: "Perform front-foot drives from static ball drops, emphasizing quick, early foot placement.",
        duration: "12 minutes"
      });
    }

    if (coachErrors.length === 0) {
      coachInstructions.push("Very solid batting base. Keep working on shot connection and timing.");
      coachDrills.push({
        name: "Underarm Throwdowns",
        description: "Face 24 underarm throwdowns, playing defensive or attacking drives while maintaining absolute posture control.",
        duration: "15 minutes"
      });
    }
  }

  const coachJSON = {
    analysis: coachErrors.length > 0 
      ? `Detected ${coachErrors.length} technical deviation(s) in your cricket ${analysisType} technique. Correcting these form errors will boost performance and overall consistency.`
      : `Outstanding form! Your cricket ${analysisType} technique matches standard benchmarks closely.`,
    errors: coachErrors,
    instructions: coachInstructions,
    drills: coachDrills
  };
  coachFeedback = JSON.stringify(coachJSON);

  // -------------------------------------------------------------
  // AGENT 3 — Injury Risk Agent
  // -------------------------------------------------------------
  let kneeStress = Math.min(100, Math.max(15, 100 - avgStabilityScore));
  let backStress = Math.min(100, Math.max(15, 100 - avgPostureScore));
  let shoulderStress = Math.min(100, Math.max(15, 100 - avgAlignmentScore));
  let elbowStress = Math.min(100, Math.max(15, 100 - avgEfficiencyScore));

  // Modify stress based on actual warnings
  if (warnings.includes("Elbow angle too low")) elbowStress = Math.min(100, elbowStress + 25);
  if (warnings.includes("Excessive spine tilt")) backStress = Math.min(100, backStress + 30);
  if (warnings.includes("Balance unstable")) kneeStress = Math.min(100, kneeStress + 20);

  // Check historical warning patterns (Agent 3 monitors trends)
  let repeatWarningsCount = 0;
  history.forEach(h => {
    if (h.warnings && Array.isArray(h.warnings)) {
      if (warnings.some(w => h.warnings.includes(w))) {
        repeatWarningsCount++;
      }
    }
  });

  if (repeatWarningsCount > 2) {
    kneeStress = Math.min(100, kneeStress + 15);
    backStress = Math.min(100, backStress + 15);
  }

  const maxStress = Math.max(kneeStress, backStress, shoulderStress, elbowStress);
  let overallProbability: "low" | "medium" | "high" = "low";
  if (maxStress > 70) overallProbability = "high";
  else if (maxStress > 45) overallProbability = "medium";

  const safetyWarnings: string[] = [];
  let injuryRec = "Maintain present training volume with routine warm-ups.";

  if (overallProbability === "high") {
    safetyWarnings.push("CRITICAL: Repeated poor posture is overloading joint structures.");
    if (backStress > 70) {
      safetyWarnings.push("Severe back strain risk due to excessive lateral spine flexing.");
      injuryRec = "Reduce training/bowling intensity by 40% for the next 48 hours. Focus on core stability exercises.";
    } else if (kneeStress > 70) {
      safetyWarnings.push("High knee patella stress due to unstable landing mechanics.");
      injuryRec = "Minimize impact training. Perform low-impact quad and hamstring strengthening exercises.";
    } else {
      injuryRec = "Incorporate 15 minutes of dynamic stretching post-session and monitor joint soreness.";
    }
  } else if (overallProbability === "medium") {
    safetyWarnings.push("WARNING: Micro-stress patterns detected. Do not ignore form feedback.");
    injuryRec = "Incorporate focused mobility exercises targeting lower back and hips prior to training.";
  }

  const injuryJSON = {
    stressScores: {
      knee: Math.round(kneeStress),
      back: Math.round(backStress),
      shoulder: Math.round(shoulderStress),
      elbow: Math.round(elbowStress)
    },
    overallProbability,
    safetyWarnings,
    recommendation: injuryRec
  };
  const injuryRisk = JSON.stringify(injuryJSON);

  // -------------------------------------------------------------
  // AGENT 4 — Training Planner Agent
  // -------------------------------------------------------------
  let schedule: any[] = [];
  if (overallProbability === "high") {
    schedule = [
      { day: "Day 1", focus: "Rest & Active Recovery", activities: ["Dynamic full-body stretching", "Foam rolling (quads, hamstrings, back)", "Light 15-min walk"] },
      { day: "Day 2", focus: "Core & Joint Stability", activities: ["Planks (3x45s), Side planks (3x30s)", "Glute bridges (3x15)", "Single-leg balance holds (5 mins)"] },
      { day: "Day 3", focus: "Mobility & Technical Drills", activities: [
        analysisType === "bowling" ? "Wall shadow bowling (no ball) - 3 sets of 15 reps" : "Tennis ball drop drives - 3 sets of 10 reps",
        "Hip opening mobility flow (15 mins)"
      ] },
      { day: "Day 4", focus: "Strength & Flexibility", activities: ["Bodyweight squats (3x15)", "Spinal rotations", "Hamstring stretches (3x30s)"] },
      { day: "Day 5", focus: "Low-Intensity Form Session", activities: [
        `20-minute light ${analysisType} session, prioritizing correct posture over speed/power`,
        "Immediate post-workout ice pack and stretch"
      ] }
    ];
  } else {
    schedule = [
      { day: "Day 1", focus: "Mobility & Baseline Stance", activities: ["Spine rotations & arm circles (10 mins)", "Batting/Bowling stance alignment review in mirror (10 mins)", "Plank core holds (3x60s)"] },
      { day: "Day 2", focus: "Targeted Technical Drills", activities: [
        ...(coachDrills.map(d => `${d.name} (${d.duration}): ${d.description}`)),
        "Video review of target positions"
      ] },
      { day: "Day 3", focus: "Strength & Power", activities: ["Lunges (3x10 per leg)", "Dumbbell shoulder presses (3x12)", "Rotator cuff band exercises (3x15)"] },
      { day: "Day 4", focus: "Active Rest & Yoga", activities: ["Deep hamstring & chest opening stretches", "Gentle breathing exercises", "Hydration and nutrition monitoring"] },
      { day: "Day 5", focus: "Full Performance Simulation", activities: [
        `Complete 30-minute ${analysisType} training session`,
        "Run real-time posture analysis to check metrics improvement"
      ] }
    ];
  }

  const plannerJSON = {
    title: `${skillLevel.toUpperCase()} Weekly Training Plan - ${analysisType === "bowling" ? "Bowling Form Focus" : "Batting Base Focus"}`,
    schedule
  };
  const trainingPlan = JSON.stringify(plannerJSON);

  // -------------------------------------------------------------
  // AGENT 5 — Progress Tracking Agent
  // -------------------------------------------------------------
  let comparedToBaseline = false;
  let accuracyGain = "+0%";
  let postureGain = "+0%";
  let consistencyGain = "+0%";
  let progressSummary = "This is your first completed session. We have established your biomechanical baseline metrics.";

  if (history.length > 0) {
    comparedToBaseline = true;
    let totalHistScore = 0;
    let totalHistPosture = 0;
    let totalHistAlignment = 0;
    let totalHistStability = 0;

    history.forEach(h => {
      totalHistScore += h.overallScore || 0;
      totalHistPosture += h.avgPostureScore || 0;
      totalHistAlignment += h.avgAlignmentScore || 0;
      totalHistStability += h.avgStabilityScore || 0;
    });

    const avgHistScore = totalHistScore / history.length;
    const avgHistPosture = totalHistPosture / history.length;
    const avgHistStability = totalHistStability / history.length;

    const scoreDiff = overallScore - avgHistScore;
    const postureDiff = avgPostureScore - avgHistPosture;
    const stabilityDiff = avgStabilityScore - avgHistStability;

    accuracyGain = `${scoreDiff >= 0 ? "+" : ""}${Math.round(scoreDiff)}%`;
    postureGain = `${postureDiff >= 0 ? "+" : ""}${Math.round(postureDiff)}%`;
    consistencyGain = `${stabilityDiff >= 0 ? "+" : ""}${Math.round(stabilityDiff)}%`;

    if (scoreDiff > 3) {
      progressSummary = `Excellent progress! Your overall technique score has improved by ${accuracyGain} compared to your historical average. Posture is up by ${postureGain}.`;
    } else if (scoreDiff < -3) {
      progressSummary = `Your technique score is ${accuracyGain} below your historical average. Fatigue or slight form deviations might be causing this drop. Follow the rest plan.`;
    } else {
      progressSummary = `Consistent form! You are holding close to your historical baseline within a ${accuracyGain} range. Keep reinforcing correct patterns.`;
    }
  }

  const progressJSON = {
    comparedToBaseline,
    accuracyGain,
    postureGain,
    consistencyGain,
    summary: progressSummary
  };
  const progressReport = JSON.stringify(progressJSON);

  // Return the serialized JSON strings for each agent report
  return {
    coachFeedback,
    injuryRisk,
    trainingPlan,
    progressReport,
  };
}
