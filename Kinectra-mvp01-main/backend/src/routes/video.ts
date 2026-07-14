import { Router } from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import os from "os";
import { spawn, spawnSync } from "child_process";
import { randomUUID } from "crypto";
import { db } from "@workspace/db";
import { sessionsTable } from "@workspace/db";
import { logger } from "../lib/logger";
import { runMultiAgentPipeline } from "../services/multiAgentEngine";

const router = Router();

// Dynamically determine the available Python command
let cachedPythonCommand: string | null = null;
function getPythonCommand(): string {
  if (cachedPythonCommand) return cachedPythonCommand;
  try {
    const check = spawnSync("python3", ["--version"]);
    if (!check.error && check.status === 0) {
      cachedPythonCommand = "python3";
      return "python3";
    }
  } catch (e) {}
  cachedPythonCommand = "python";
  return "python";
}

const uploadDir = path.join(os.tmpdir(), "kinectra-uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 100 * 1024 * 1024 // 100 MB
  }
});

interface Job {
  jobId: string;
  status: "pending" | "processing" | "completed" | "failed";
  progress: number;
  step: number;
  message?: string;
  sessionId?: string;
}

const jobs = new Map<string, Job>();

// Recommendations generator matching standard logic
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
  } else {
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
  }

  return { strengths, improvements, recommendations };
}

async function saveSessionResult(
  jobId: string,
  analysis: {
    frameCount: number;
    avgPostureScore: number;
    avgAlignmentScore: number;
    avgStabilityScore: number;
    avgEfficiencyScore: number;
    overallScore: number;
    warnings: string[];
  },
  athleteName: string,
  analysisType: string,
  skillLevel: string,
  dominantHand: string
) {
  const sessionId = randomUUID();
  const { strengths, improvements, recommendations } = generateRecommendations(
    analysis.warnings,
    analysisType
  );

  const agentReport = await runMultiAgentPipeline(sessionId, {
    athleteName,
    analysisType,
    skillLevel,
    dominantHand,
    overallScore: analysis.overallScore,
    avgPostureScore: analysis.avgPostureScore,
    avgAlignmentScore: analysis.avgAlignmentScore,
    avgStabilityScore: analysis.avgStabilityScore,
    avgEfficiencyScore: analysis.avgEfficiencyScore,
    warnings: analysis.warnings,
  });

  try {
    await db.insert(sessionsTable).values({
      id: sessionId,
      athleteName,
      analysisType,
      skillLevel,
      dominantHand,
      status: "completed",
      frameCount: analysis.frameCount,
      avgPostureScore: analysis.avgPostureScore,
      avgAlignmentScore: analysis.avgAlignmentScore,
      avgStabilityScore: analysis.avgStabilityScore,
      avgEfficiencyScore: analysis.avgEfficiencyScore,
      overallScore: analysis.overallScore,
      warnings: analysis.warnings,
      strengths,
      improvements,
      recommendations,
      coachFeedback: agentReport.coachFeedback,
      injuryRisk: agentReport.injuryRisk,
      trainingPlan: agentReport.trainingPlan,
      progressReport: agentReport.progressReport,
      snapshots: null,
    });

    const job = jobs.get(jobId);
    if (job) {
      job.status = "completed";
      job.progress = 100;
      job.step = 6;
      job.sessionId = sessionId;
    }
  } catch (err) {
    logger.error({ err }, "Failed to save session to DB");
    const job = jobs.get(jobId);
    if (job) {
      job.status = "failed";
      job.message = "Failed to save session results to database";
    }
  }
}

router.post("/video/upload", upload.single("video"), async (req, res): Promise<void> => {
  const file = req.file;
  if (!file) {
    res.status(400).json({ success: false, message: "No video file provided" });
    return;
  }

  const athleteName = req.body.athleteName || "Athlete";
  const analysisType = req.body.analysisType || "bowling";
  const skillLevel = req.body.skillLevel || "intermediate";
  const dominantHand = req.body.dominantHand || "right";

  const ext = path.extname(file.originalname).toLowerCase().substring(1);
  const allowedExts = ["mp4", "mov", "avi"];
  if (!allowedExts.includes(ext)) {
    try { fs.unlinkSync(file.path); } catch (e) {}
    res.status(400).json({ success: false, message: "Video format must be MP4, MOV, or AVI" });
    return;
  }

  // Fast Subprocess check for duration using OpenCV in Python
  const pythonCmd = getPythonCommand();
  const checkScript = `import cv2; cap=cv2.VideoCapture('${file.path.replace(/\\/g, "/")}'); fps=cap.get(cv2.CAP_PROP_FPS); fc=cap.get(cv2.CAP_PROP_FRAME_COUNT); print(fc/fps if fps > 0 else 0); cap.release()`;
  
  try {
    const checkProcess = spawnSync(pythonCmd, ["-c", checkScript], { encoding: "utf8" });
    
    const status = checkProcess.status;
    const stderr = checkProcess.stderr ? checkProcess.stderr.trim() : "";
    const stdout = checkProcess.stdout ? checkProcess.stdout.trim() : "";

    if (status !== 0 || checkProcess.error) {
      const errorDetail = stderr || (checkProcess.error ? checkProcess.error.message : "Unknown error");
      logger.error({ error: errorDetail, status, pythonCmd }, "Duration check subprocess failed");
      try { fs.unlinkSync(file.path); } catch (e) {}
      
      const isMissingDep = 
        errorDetail.includes("cv2") || 
        errorDetail.includes("ModuleNotFoundError") || 
        errorDetail.includes("ImportError") || 
        (checkProcess.error && (checkProcess.error as any).code === "ENOENT");

      if (isMissingDep) {
        res.status(500).json({
          success: false,
          message: "Server environment error: Python or OpenCV (cv2) is not installed on the server."
        });
      } else {
        res.status(400).json({
          success: false,
          message: "Invalid or corrupt video file (unable to read or process)"
        });
      }
      return;
    }
    
    const duration = parseFloat(stdout);
    if (isNaN(duration) || duration <= 0) {
      try { fs.unlinkSync(file.path); } catch (e) {}
      res.status(400).json({ success: false, message: "Invalid or corrupt video file" });
      return;
    }

    if (duration > 60.5) { // 60s plus slight rounding tolerance
      try { fs.unlinkSync(file.path); } catch (e) {}
      res.status(400).json({ success: false, message: "Video must be under 60 seconds" });
      return;
    }
  } catch (err) {
    logger.error({ err }, "Error checking video duration");
    try { fs.unlinkSync(file.path); } catch (e) {}
    res.status(500).json({ success: false, message: "Server error during video validation" });
    return;
  }

  const jobId = randomUUID();
  jobs.set(jobId, {
    jobId,
    status: "processing",
    progress: 5,
    step: 1
  });

  res.status(200).json({ success: true, jobId });

  // Spawn processing job
  const pythonScriptPath = path.resolve(process.cwd(), "src", "services", "analyze_video.py");
  const child = spawn(pythonCmd, [
    pythonScriptPath,
    file.path,
    athleteName,
    analysisType,
    skillLevel,
    dominantHand
  ]);

  let outputBuffer = "";
  child.stdout.on("data", (data) => {
    outputBuffer += data.toString();
    const lines = outputBuffer.split("\n");
    outputBuffer = lines.pop() || "";

    for (const line of lines) {
      const cleanLine = line.trim();
      if (cleanLine.startsWith("PROGRESS:")) {
        const progress = parseInt(cleanLine.substring(9).trim());
        const job = jobs.get(jobId);
        if (job) job.progress = progress;
      } else if (cleanLine.startsWith("STEP:")) {
        const step = parseInt(cleanLine.substring(5).trim());
        const job = jobs.get(jobId);
        if (job) job.step = step;
      } else if (cleanLine.startsWith("ERROR:")) {
        const errorMsg = cleanLine.substring(6).trim();
        const job = jobs.get(jobId);
        if (job) {
          job.status = "failed";
          job.message = errorMsg;
        }
      } else if (cleanLine.startsWith("RESULT:")) {
        const resultJson = cleanLine.substring(7).trim();
        try {
          const analysis = JSON.parse(resultJson);
          saveSessionResult(jobId, analysis, athleteName, analysisType, skillLevel, dominantHand);
        } catch (err) {
          logger.error({ err }, "Failed to parse result JSON from Python script");
          const job = jobs.get(jobId);
          if (job) {
            job.status = "failed";
            job.message = "Failed to parse analysis results";
          }
        }
      }
    }
  });

  child.stderr.on("data", (data) => {
    logger.error(`Python stderr: ${data.toString()}`);
  });

  child.on("close", (code) => {
    // Clean up temporary video file immediately after use
    try {
      if (fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }
    } catch (err) {
      logger.error({ err }, "Failed to delete temporary video file");
    }

    const job = jobs.get(jobId);
    if (job && job.status === "processing") {
      if (code !== 0) {
        job.status = "failed";
        job.message = job.message || "Video analysis process exited with error";
      }
    }
  });
});

router.get("/video/job/:jobId", async (req, res): Promise<void> => {
  const { jobId } = req.params;
  const job = jobs.get(jobId);

  if (!job) {
    res.status(404).json({ error: "Job not found" });
    return;
  }

  res.json(job);
});

// Periodic cleanup of orphaned uploads older than 24 hours
setInterval(() => {
  const now = Date.now();
  fs.readdir(uploadDir, (err, files) => {
    if (err) return;
    for (const file of files) {
      const filePath = path.join(uploadDir, file);
      fs.stat(filePath, (err, stats) => {
        if (err) return;
        if (now - stats.mtimeMs > 24 * 60 * 60 * 1000) { // 24 Hours
          fs.unlink(filePath, () => {});
        }
      });
    }
  });
}, 60 * 60 * 1000); // Clean up hourly

export default router;
