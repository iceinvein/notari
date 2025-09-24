// AI processing types
import type { TimeRange } from "./session.types";

export type ContentType = "text" | "image" | "code" | "mixed";

export interface AIAnalysis {
  sessionId: string;
  contentType: ContentType;
  workPatterns: WorkPattern[];
  confidenceScore: number;
  relevanceScores: RelevanceScore[];
  potentialFlags: AnomalyFlag[];
  summary: WorkSummary;
  processingTime: number;
  modelVersion: string;
}

export interface WorkPattern {
  type: "typing" | "mouse" | "application" | "content";
  confidence: number;
  timeRange: TimeRange;
  characteristics: Record<string, unknown>;
  description: string;
}

export interface RelevanceScore {
  segment: TimeRange;
  score: number;
  reasoning: string;
}

export interface AnomalyFlag {
  type: "ai_generated" | "copy_paste" | "unusual_pattern" | "suspicious_timing";
  severity: "low" | "medium" | "high";
  evidence: string[];
  confidence: number;
  timeRange: TimeRange;
  description: string;
}

export interface WorkSummary {
  overview: string;
  keyActivities: string[];
  timeBreakdown: TimeBreakdown[];
  productivity: ProductivityMetrics;
  authenticity: AuthenticityAssessment;
}

export interface TimeBreakdown {
  activity: string;
  duration: number;
  percentage: number;
}

export interface ProductivityMetrics {
  activeTime: number;
  idleTime: number;
  focusScore: number;
  taskSwitching: number;
}

export interface AuthenticityAssessment {
  overallScore: number;
  humanLikelihood: number;
  consistencyScore: number;
  flags: string[];
}
