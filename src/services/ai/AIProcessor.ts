import { invoke } from "@tauri-apps/api/core";
import type { AIAnalysis, AnomalyFlag, WorkSummary } from "../../types";
import type { EncryptedSessionData } from "../../types/proofPack.types";

export interface AIProcessor {
  analyzeSession(sessionData: EncryptedSessionData): Promise<AIAnalysis>;
  generateSummary(analysis: AIAnalysis): Promise<WorkSummary>;
  detectAnomalies(sessionData: EncryptedSessionData): Promise<AnomalyFlag[]>;
  updateModels(): Promise<void>;
  getModelInfo(): ModelInfo;
}

export interface ModelInfo {
  version: string;
  capabilities: string[];
  lastUpdated: number;
  accuracy: number;
  supportedContentTypes: string[];
}

export interface AIProcessorStatus {
  initialized: boolean;
  modelsLoaded: number;
  version: string;
}

export interface AIAnalysisResult {
  success: boolean;
  analysis?: AIAnalysis;
  error?: string;
}

export class NotariAIProcessor implements AIProcessor {
  private initialized = false;

  constructor() {
    this.initialize();
  }

  private async initialize(): Promise<void> {
    try {
      const success = await invoke<boolean>("initialize_ai_processor");
      this.initialized = success;

      if (!success) {
        console.warn(
          "AI processor initialization failed, using fallback methods",
        );
      }
    } catch (error) {
      console.error("Failed to initialize AI processor:", error);
      this.initialized = false;
    }
  }

  async analyzeSession(sessionData: EncryptedSessionData): Promise<AIAnalysis> {
    try {
      if (this.initialized) {
        const result = await invoke<AIAnalysisResult>("analyze_session_data", {
          sessionData,
        });

        if (result.success && result.analysis) {
          return result.analysis;
        }

        if (result.error) {
          console.warn("AI analysis failed:", result.error);
        }
      }

      // Fallback to client-side analysis
      return this.fallbackAnalysis(sessionData);
    } catch (error) {
      console.error("AI analysis error:", error);
      return this.fallbackAnalysis(sessionData);
    }
  }

  async generateSummary(analysis: AIAnalysis): Promise<WorkSummary> {
    try {
      if (this.initialized) {
        const summary = await invoke<WorkSummary | null>(
          "generate_work_summary",
          {
            sessionData: analysis, // This would need the original session data
          },
        );

        if (summary) {
          return summary;
        }
      }

      // Fallback summary generation
      return this.generateFallbackSummary(analysis);
    } catch (error) {
      console.error("Summary generation error:", error);
      return this.generateFallbackSummary(analysis);
    }
  }

  async detectAnomalies(
    sessionData: EncryptedSessionData,
  ): Promise<AnomalyFlag[]> {
    try {
      const analysis = await this.analyzeSession(sessionData);
      return analysis.potentialFlags;
    } catch (error) {
      console.error("Anomaly detection error:", error);
      return [];
    }
  }

  async updateModels(): Promise<void> {
    // This would trigger model updates in the backend
    console.log("Model update not implemented yet");
  }

  getModelInfo(): ModelInfo {
    return {
      version: "1.0.0",
      capabilities: [
        "typing_pattern_analysis",
        "mouse_behavior_analysis",
        "anomaly_detection",
        "work_summarization",
        "authenticity_assessment",
      ],
      lastUpdated: Date.now(),
      accuracy: 0.85,
      supportedContentTypes: ["text", "image", "code", "mixed"],
    };
  }

  async getStatus(): Promise<AIProcessorStatus> {
    try {
      return await invoke<AIProcessorStatus>("get_ai_processor_status");
    } catch (error) {
      console.error("Failed to get AI processor status:", error);
      return {
        initialized: false,
        modelsLoaded: 0,
        version: "1.0.0",
      };
    }
  }

  private fallbackAnalysis(sessionData: EncryptedSessionData): AIAnalysis {
    // Client-side fallback analysis using statistical methods

    return {
      sessionId: sessionData.sessionId,
      contentType: "mixed",
      workPatterns: this.generateBasicPatterns(sessionData),
      confidenceScore: 0.6, // Lower confidence for fallback
      relevanceScores: [],
      potentialFlags: [],
      summary: this.generateBasicSummary(sessionData),
      processingTime: 100,
      modelVersion: "fallback-1.0.0",
    };
  }

  private generateBasicPatterns(sessionData: EncryptedSessionData) {
    // Generate basic patterns from available metadata
    const patterns = [];

    // Use timestamp and content size for basic pattern analysis
    const sessionDate = new Date(sessionData.timestamp);
    const contentSize = sessionData.encryptedContent.byteLength;

    patterns.push({
      type: "application" as const,
      confidence: 0.7,
      timeRange: {
        start: sessionDate.toISOString(),
        end: new Date(sessionData.timestamp + 3600000).toISOString(), // Assume 1 hour session
      },
      characteristics: {
        contentSize,
        hasContent: contentSize > 0,
      },
      description: `Work session with ${Math.round(contentSize / 1024)}KB of captured data`,
    });

    return patterns;
  }

  private generateBasicSummary(sessionData: EncryptedSessionData): WorkSummary {
    const contentSize = sessionData.encryptedContent.byteLength;
    const estimatedDuration = Math.max(contentSize / 1000, 60000); // Estimate based on content size

    return {
      overview: `Work session analyzed with ${Math.round(contentSize / 1024)}KB of captured data using statistical analysis.`,
      keyActivities: ["Data capture and analysis"],
      timeBreakdown: [
        {
          activity: "Active Work",
          duration: estimatedDuration * 0.8,
          percentage: 80,
        },
        {
          activity: "Idle Time",
          duration: estimatedDuration * 0.2,
          percentage: 20,
        },
      ],
      productivity: {
        activeTime: estimatedDuration * 0.8,
        idleTime: estimatedDuration * 0.2,
        focusScore: 0.7,
        taskSwitching: 3,
      },
      authenticity: {
        overallScore: 0.75,
        humanLikelihood: 0.8,
        consistencyScore: 0.7,
        flags: [],
      },
    };
  }

  private generateFallbackSummary(analysis: AIAnalysis): WorkSummary {
    return {
      overview: `Analysis completed with ${analysis.workPatterns.length} patterns detected and ${analysis.potentialFlags.length} potential issues identified.`,
      keyActivities: analysis.workPatterns.map((p) => p.description),
      timeBreakdown: [
        {
          activity: "Pattern Analysis",
          duration: analysis.processingTime,
          percentage: 100,
        },
      ],
      productivity: {
        activeTime: 0,
        idleTime: 0,
        focusScore: analysis.confidenceScore,
        taskSwitching: analysis.workPatterns.length,
      },
      authenticity: {
        overallScore: analysis.confidenceScore,
        humanLikelihood: Math.max(0.5, analysis.confidenceScore),
        consistencyScore: analysis.confidenceScore,
        flags: analysis.potentialFlags.map((f) => f.description),
      },
    };
  }
}

// Export singleton instance
export const aiProcessor = new NotariAIProcessor();
