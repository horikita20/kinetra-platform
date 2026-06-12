import { pgTable, text, serial, real, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const sessionsTable = pgTable("sessions", {
  id: text("id").primaryKey(),
  athleteName: text("athlete_name").notNull(),
  analysisType: text("analysis_type").notNull(),
  skillLevel: text("skill_level").notNull(),
  dominantHand: text("dominant_hand").notNull(),
  status: text("status").notNull().default("active"),
  frameCount: integer("frame_count").notNull().default(0),
  avgPostureScore: real("avg_posture_score").notNull().default(0),
  avgAlignmentScore: real("avg_alignment_score").notNull().default(0),
  avgStabilityScore: real("avg_stability_score").notNull().default(0),
  avgEfficiencyScore: real("avg_efficiency_score").notNull().default(0),
  overallScore: real("overall_score").notNull().default(0),
  warnings: text("warnings").array().notNull().default([]),
  strengths: text("strengths").array().notNull().default([]),
  improvements: text("improvements").array().notNull().default([]),
  recommendations: text("recommendations").array().notNull().default([]),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertSessionSchema = createInsertSchema(sessionsTable).omit({
  frameCount: true,
  avgPostureScore: true,
  avgAlignmentScore: true,
  avgStabilityScore: true,
  avgEfficiencyScore: true,
  overallScore: true,
  warnings: true,
  strengths: true,
  improvements: true,
  recommendations: true,
  createdAt: true,
  status: true,
});

export type InsertSession = z.infer<typeof insertSessionSchema>;
export type Session = typeof sessionsTable.$inferSelect;
