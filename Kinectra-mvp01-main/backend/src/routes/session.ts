import { Router } from "express";
import { db } from "@workspace/db";
import { sessionsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { randomUUID } from "crypto";
import { logger } from "../lib/logger";
import {
  StartSessionBody,
  EndSessionBody,
  EndSessionParams,
  GetSessionParams,
} from "@workspace/api-zod";
import { runMultiAgentPipeline } from "../services/multiAgentEngine";

const router = Router();

function generateRecommendations(
  warnings: string[],
  analysisType: string
): { strengths: string[]; improvements: string[]; recommendations: string[] } {
  const strengths: string[] = [];
  const improvements: string[] = [];
  const recommendations: string[] = [];

  const warningSet = new Set(warnings);

  if (analysisType === "bowling") {
    if (!warningSet.has("Elbow angle too low")) {
      strengths.push("Good elbow height during delivery");
    } else {
      improvements.push("Elbow position needs work");
      recommendations.push("Maintain elbow height during release — aim for 80°-110°.");
    }
    if (!warningSet.has("Excessive spine tilt")) {
      strengths.push("Strong upright body position");
    } else {
      improvements.push("Spine tilt is excessive");
      recommendations.push("Keep upper body more upright during the delivery stride.");
    }
    if (!warningSet.has("Poor shoulder rotation")) {
      strengths.push("Consistent shoulder alignment");
    } else {
      improvements.push("Shoulder rotation needs improvement");
      recommendations.push("Focus on full shoulder rotation through the crease.");
    }
    if (warnings.length === 0) {
      strengths.push("Excellent overall bowling technique");
      recommendations.push("Continue drilling at current tempo for consistency.");
    }
  } else if (analysisType === "batting") {
    if (!warningSet.has("Head moving excessively")) {
      strengths.push("Stable head position");
    } else {
      improvements.push("Head stability is inconsistent");
      recommendations.push("Keep your eyes level and head still — watch the ball from release.");
    }
    if (!warningSet.has("Balance unstable")) {
      strengths.push("Good weight transfer and balance");
    } else {
      improvements.push("Balance needs work");
      recommendations.push("Focus on stable landing mechanics — plant the front foot firmly.");
    }
    if (!warningSet.has("Front foot delayed")) {
      strengths.push("Good front foot movement");
    } else {
      improvements.push("Front foot timing is off");
      recommendations.push("Move your front foot earlier to improve weight transfer.");
    }
    if (warnings.length === 0) {
      strengths.push("Solid batting stance and technique");
      recommendations.push("Practice footwork drills to further enhance timing.");
    }
  } else if (analysisType === "shooting") {
    if (!warningSet.has("Incomplete follow-through")) {
      strengths.push("High release point and complete follow-through extension");
    } else {
      improvements.push("Incomplete follow-through arm extension");
      recommendations.push("Extend your shooting arm fully at the release point and snap your wrist.");
    }
    if (!warningSet.has("Lean during jump shot")) {
      strengths.push("Stable vertical torso alignment");
    } else {
      improvements.push("Body leans laterally or forward during jump");
      recommendations.push("Maintain a straight vertical trunk during release for shot stability.");
    }
    if (!warningSet.has("Excessive knee bend")) {
      strengths.push("Good quick knee compression spring");
    } else {
      improvements.push("Deep knee dip slowing down release");
      recommendations.push("Avoid sinking too low during loading — use a quick, explosive spring drive.");
    }
    if (warnings.length === 0) {
      strengths.push("Elite jump shot form and stability");
      recommendations.push("Keep practicing your shot pocket and catch-and-shoot transition.");
    }
  } else if (analysisType === "urdhva_hastasana") {
    if (!warningSet.has("Raise arms fully overhead")) {
      strengths.push("Excellent overhead arm reach and shoulder flex");
    } else {
      improvements.push("Shoulders not fully extended vertically");
      recommendations.push("Reach active fingers straight up towards the ceiling, opening the armpits.");
    }
    if (!warningSet.has("Straighten your elbows")) {
      strengths.push("Elbow joints locked straight and firm");
    } else {
      improvements.push("Bending elbow joints detected");
      recommendations.push("Squeeze your forearms parallel and engage triceps to straighten your arms.");
    }
    if (!warningSet.has("Straighten your spine / torso")) {
      strengths.push("Excellent tall vertical spinal posture");
    } else {
      improvements.push("Excessive spinal tilt / arched lower back");
      recommendations.push("Tuck your tailbone and draw navel in to lengthen the lower spine.");
    }
    if (warnings.length === 0) {
      strengths.push("Perfect Urdhva Hastasana alignment and core balance");
      recommendations.push("Hold the posture for 5 breaths while breathing deeply through the nose.");
    }
  }

  return { strengths, improvements, recommendations };
}

router.post("/session/start", async (req, res): Promise<void> => {
  const parsed = StartSessionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const { athleteName, analysisType, skillLevel, dominantHand } = parsed.data;
  const id = randomUUID();

  try {
    await db.insert(sessionsTable).values({
      id,
      athleteName,
      analysisType,
      skillLevel,
      dominantHand,
      status: "active",
      frameCount: 0,
      avgPostureScore: 0,
      avgAlignmentScore: 0,
      avgStabilityScore: 0,
      avgEfficiencyScore: 0,
      overallScore: 0,
      warnings: [],
      strengths: [],
      improvements: [],
      recommendations: [],
    });

    const session = await db
      .select()
      .from(sessionsTable)
      .where(eq(sessionsTable.id, id))
      .limit(1);

    res.status(201).json(session[0]);
  } catch (err) {
    req.log.error({ err }, "Failed to start session");
    res.status(500).json({ error: "Failed to start session" });
  }
});

router.post("/session/:sessionId/end", async (req, res): Promise<void> => {
  const paramsParsed = EndSessionParams.safeParse(req.params);
  if (!paramsParsed.success) {
    res.status(400).json({ error: "Invalid session ID" });
    return;
  }

  const bodyParsed = EndSessionBody.safeParse(req.body);
  if (!bodyParsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const { sessionId } = paramsParsed.data;
  const {
    frameCount,
    avgPostureScore,
    avgAlignmentScore,
    avgStabilityScore,
    avgEfficiencyScore,
    overallScore,
    warnings,
    snapshots,
  } = bodyParsed.data;

  try {
    const existing = await db
      .select()
      .from(sessionsTable)
      .where(eq(sessionsTable.id, sessionId))
      .limit(1);

    if (!existing.length) {
      res.status(404).json({ error: "Session not found" });
      return;
    }

    const { strengths, improvements, recommendations } = generateRecommendations(
      warnings,
      existing[0].analysisType
    );

    const agentReport = await runMultiAgentPipeline(sessionId, {
      athleteName: existing[0].athleteName,
      analysisType: existing[0].analysisType,
      skillLevel: existing[0].skillLevel,
      dominantHand: existing[0].dominantHand,
      overallScore,
      avgPostureScore,
      avgAlignmentScore,
      avgStabilityScore,
      avgEfficiencyScore,
      warnings,
    });

    await db
      .update(sessionsTable)
      .set({
        status: "completed",
        frameCount,
        avgPostureScore,
        avgAlignmentScore,
        avgStabilityScore,
        avgEfficiencyScore,
        overallScore,
        warnings,
        strengths,
        improvements,
        recommendations,
        coachFeedback: agentReport.coachFeedback,
        injuryRisk: agentReport.injuryRisk,
        trainingPlan: agentReport.trainingPlan,
        progressReport: agentReport.progressReport,
        snapshots: snapshots || null,
      })
      .where(eq(sessionsTable.id, sessionId));

    const updated = await db
      .select()
      .from(sessionsTable)
      .where(eq(sessionsTable.id, sessionId))
      .limit(1);

    res.json(updated[0]);
  } catch (err) {
    req.log.error({ err }, "Failed to end session");
    res.status(500).json({ error: "Failed to end session" });
  }
});

router.get("/session/:sessionId", async (req, res): Promise<void> => {
  const parsed = GetSessionParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid session ID" });
    return;
  }

  const { sessionId } = parsed.data;

  try {
    const session = await db
      .select()
      .from(sessionsTable)
      .where(eq(sessionsTable.id, sessionId))
      .limit(1);

    if (!session.length) {
      res.status(404).json({ error: "Session not found" });
      return;
    }

    res.json(session[0]);
  } catch (err) {
    req.log.error({ err }, "Failed to get session");
    res.status(500).json({ error: "Failed to get session" });
  }
});

router.get("/session", async (req, res): Promise<void> => {
  try {
    const sessions = await db
      .select()
      .from(sessionsTable)
      .orderBy(desc(sessionsTable.createdAt))
      .limit(20);

    res.json(sessions);
  } catch (err) {
    req.log.error({ err }, "Failed to list sessions");
    res.status(500).json({ error: "Failed to list sessions" });
  }
});

export default router;
