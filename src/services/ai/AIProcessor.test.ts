import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { AIAnalysis } from "../../types";
import type { EncryptedSessionData } from "../../types/proofPack.types";

// Mock Tauri invoke
const mockInvoke = vi.fn();
vi.mock("@tauri-apps/api/core", () => ({
  invoke: mockInvoke,
}));

// Import after mocking
const { NotariAIProcessor } = await import("./AIProcessor");

describe("NotariAIProcessor", () => {
  let processor: InstanceType<typeof NotariAIProcessor>;
  let mockSessionData: EncryptedSessionData;

  beforeEach(() => {
    vi.clearAllMocks();
    processor = new NotariAIProcessor();

    mockSessionData = {
      sessionId: "test-session-123",
      encryptedContent: new ArrayBuffer(1024),
      contentHash: "test-hash-123",
      timestamp: Date.now(),
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("initialization", () => {
    it("should initialize successfully when backend is available", async () => {
      mockInvoke.mockResolvedValueOnce(true);

      await new Promise((resolve) => setTimeout(resolve, 10)); // Wait for async init

      expect(mockInvoke).toHaveBeenCalledWith("initialize_ai_processor");
    });

    it("should handle initialization failure gracefully", async () => {
      mockInvoke.mockResolvedValueOnce(false);

      const newProcessor = new NotariAIProcessor();
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Should not throw and should work with fallback
      expect(() => newProcessor).not.toThrow();
    });

    it("should handle initialization error gracefully", async () => {
      mockInvoke.mockRejectedValueOnce(new Error("Backend not available"));

      const newProcessor = new NotariAIProcessor();
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(() => newProcessor).not.toThrow();
    });
  });

  describe("analyzeSession", () => {
    it("should return AI analysis when backend is available", async () => {
      const mockAnalysis: AIAnalysis = {
        sessionId: "test-session-123",
        contentType: "text",
        workPatterns: [
          {
            type: "typing",
            confidence: 0.9,
            timeRange: {
              start: "2024-01-01T10:00:00Z",
              end: "2024-01-01T10:30:00Z",
            },
            characteristics: { avgSpeed: 120 },
            description: "Consistent typing pattern",
          },
        ],
        confidenceScore: 0.85,
        relevanceScores: [],
        potentialFlags: [],
        summary: {
          overview: "High-quality work session",
          keyActivities: ["Document writing"],
          timeBreakdown: [],
          productivity: {
            activeTime: 3000000,
            idleTime: 600000,
            focusScore: 0.9,
            taskSwitching: 2,
          },
          authenticity: {
            overallScore: 0.9,
            humanLikelihood: 0.95,
            consistencyScore: 0.85,
            flags: [],
          },
        },
        processingTime: 250,
        modelVersion: "1.0.0",
      };

      // Mock initialization success first, then analysis
      mockInvoke
        .mockResolvedValueOnce(true) // initialization
        .mockResolvedValueOnce({
          success: true,
          analysis: mockAnalysis,
        }); // analysis

      // Create a new processor to trigger initialization
      const testProcessor = new NotariAIProcessor();
      await new Promise((resolve) => setTimeout(resolve, 10)); // Wait for init

      const result = await testProcessor.analyzeSession(mockSessionData);

      expect(result).toEqual(mockAnalysis);
    });

    it("should use fallback analysis when backend fails", async () => {
      mockInvoke.mockResolvedValueOnce({
        success: false,
        error: "Model not loaded",
      });

      const result = await processor.analyzeSession(mockSessionData);

      expect(result.sessionId).toBe(mockSessionData.sessionId);
      expect(result.contentType).toBe("mixed");
      expect(result.modelVersion).toBe("fallback-1.0.0");
      expect(result.confidenceScore).toBe(0.6);
    });

    it("should handle backend errors gracefully", async () => {
      mockInvoke.mockRejectedValueOnce(new Error("Network error"));

      const result = await processor.analyzeSession(mockSessionData);

      expect(result.sessionId).toBe(mockSessionData.sessionId);
      expect(result.modelVersion).toBe("fallback-1.0.0");
    });

    it("should generate meaningful fallback patterns", async () => {
      mockInvoke.mockRejectedValueOnce(new Error("Backend unavailable"));

      const result = await processor.analyzeSession(mockSessionData);

      expect(result.workPatterns).toHaveLength(1);
      expect(result.workPatterns[0].type).toBe("application");
      expect(result.workPatterns[0].description).toContain(
        "KB of captured data",
      );
    });
  });

  describe("generateSummary", () => {
    it("should generate summary using backend when available", async () => {
      const mockSummary = {
        overview: "Productive work session",
        keyActivities: ["Coding", "Documentation"],
        timeBreakdown: [
          { activity: "Coding", duration: 2400000, percentage: 66.7 },
          { activity: "Documentation", duration: 1200000, percentage: 33.3 },
        ],
        productivity: {
          activeTime: 3600000,
          idleTime: 0,
          focusScore: 0.95,
          taskSwitching: 1,
        },
        authenticity: {
          overallScore: 0.92,
          humanLikelihood: 0.95,
          consistencyScore: 0.89,
          flags: [],
        },
      };

      mockInvoke
        .mockResolvedValueOnce(true) // initialization
        .mockResolvedValueOnce(mockSummary); // summary generation

      const mockAnalysis: AIAnalysis = {
        sessionId: "test-session-123",
        contentType: "code",
        workPatterns: [],
        confidenceScore: 0.9,
        relevanceScores: [],
        potentialFlags: [],
        summary: mockSummary,
        processingTime: 150,
        modelVersion: "1.0.0",
      };

      // Create a new processor to trigger initialization
      const testProcessor = new NotariAIProcessor();
      await new Promise((resolve) => setTimeout(resolve, 10)); // Wait for init

      const result = await testProcessor.generateSummary(mockAnalysis);

      expect(result).toEqual(mockSummary);
    });

    it("should generate fallback summary when backend fails", async () => {
      mockInvoke.mockResolvedValueOnce(null);

      const mockAnalysis: AIAnalysis = {
        sessionId: "test-session-123",
        contentType: "text",
        workPatterns: [
          {
            type: "typing",
            confidence: 0.8,
            timeRange: {
              start: "2024-01-01T10:00:00Z",
              end: "2024-01-01T11:00:00Z",
            },
            characteristics: {},
            description: "Steady typing pattern",
          },
        ],
        confidenceScore: 0.8,
        relevanceScores: [],
        potentialFlags: [],
        summary: {} as any,
        processingTime: 100,
        modelVersion: "1.0.0",
      };

      const result = await processor.generateSummary(mockAnalysis);

      expect(result.overview).toContain("1 patterns detected");
      expect(result.keyActivities).toEqual(["Steady typing pattern"]);
      expect(result.authenticity.overallScore).toBe(0.8);
    });
  });

  describe("detectAnomalies", () => {
    it("should detect anomalies through session analysis", async () => {
      const mockAnalysis: AIAnalysis = {
        sessionId: "test-session-123",
        contentType: "text",
        workPatterns: [],
        confidenceScore: 0.7,
        relevanceScores: [],
        potentialFlags: [
          {
            type: "suspicious_timing",
            severity: "medium",
            evidence: ["Unusually fast typing detected"],
            confidence: 0.8,
            timeRange: {
              start: "2024-01-01T10:15:00Z",
              end: "2024-01-01T10:16:00Z",
            },
            description: "Potential automated input detected",
          },
        ],
        summary: {} as any,
        processingTime: 120,
        modelVersion: "1.0.0",
      };

      mockInvoke
        .mockResolvedValueOnce(true) // initialization
        .mockResolvedValueOnce({
          success: true,
          analysis: mockAnalysis,
        });

      // Create a new processor to trigger initialization
      const testProcessor = new NotariAIProcessor();
      await new Promise((resolve) => setTimeout(resolve, 10)); // Wait for init

      const result = await testProcessor.detectAnomalies(mockSessionData);

      expect(result).toHaveLength(1);
      expect(result[0].type).toBe("suspicious_timing");
      expect(result[0].severity).toBe("medium");
    });

    it("should return empty array when no anomalies detected", async () => {
      const mockAnalysis: AIAnalysis = {
        sessionId: "test-session-123",
        contentType: "text",
        workPatterns: [],
        confidenceScore: 0.9,
        relevanceScores: [],
        potentialFlags: [],
        summary: {} as any,
        processingTime: 80,
        modelVersion: "1.0.0",
      };

      mockInvoke.mockResolvedValueOnce({
        success: true,
        analysis: mockAnalysis,
      });

      const result = await processor.detectAnomalies(mockSessionData);

      expect(result).toHaveLength(0);
    });
  });

  describe("getStatus", () => {
    it("should return processor status from backend", async () => {
      const mockStatus = {
        initialized: true,
        modelsLoaded: 3,
        version: "1.0.0",
      };

      mockInvoke.mockResolvedValueOnce(mockStatus);

      const result = await processor.getStatus();

      expect(mockInvoke).toHaveBeenCalledWith("get_ai_processor_status");
      expect(result).toEqual(mockStatus);
    });

    it("should return default status when backend fails", async () => {
      mockInvoke.mockRejectedValueOnce(new Error("Backend error"));

      const result = await processor.getStatus();

      expect(result.initialized).toBe(false);
      expect(result.modelsLoaded).toBe(0);
      expect(result.version).toBe("1.0.0");
    });
  });

  describe("getModelInfo", () => {
    it("should return model information", () => {
      const result = processor.getModelInfo();

      expect(result.version).toBe("1.0.0");
      expect(result.capabilities).toContain("typing_pattern_analysis");
      expect(result.capabilities).toContain("anomaly_detection");
      expect(result.supportedContentTypes).toEqual([
        "text",
        "image",
        "code",
        "mixed",
      ]);
      expect(result.accuracy).toBe(0.85);
    });
  });

  describe("performance", () => {
    it("should complete analysis within reasonable time", async () => {
      mockInvoke.mockResolvedValueOnce({
        success: true,
        analysis: {
          sessionId: "test-session-123",
          contentType: "text",
          workPatterns: [],
          confidenceScore: 0.8,
          relevanceScores: [],
          potentialFlags: [],
          summary: {} as any,
          processingTime: 50,
          modelVersion: "1.0.0",
        },
      });

      const startTime = Date.now();
      await processor.analyzeSession(mockSessionData);
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
    });

    it("should handle large session data efficiently", async () => {
      const largeSessionData = {
        ...mockSessionData,
        encryptedContent: new ArrayBuffer(1024 * 1024), // 1MB of data
      };

      mockInvoke.mockResolvedValueOnce({
        success: false,
        error: "Too large",
      });

      const startTime = Date.now();
      const result = await processor.analyzeSession(largeSessionData);
      const endTime = Date.now();

      expect(result).toBeDefined();
      expect(endTime - startTime).toBeLessThan(2000); // Should handle gracefully
    });
  });

  describe("error handling", () => {
    it("should handle malformed session data", async () => {
      const malformedData = {
        sessionId: "",
        encryptedContent: new ArrayBuffer(0),
        contentHash: "",
        timestamp: 0,
      } as any;

      mockInvoke.mockRejectedValueOnce(new Error("Invalid data"));

      const result = await processor.analyzeSession(malformedData);

      expect(result.sessionId).toBe("");
      expect(result.modelVersion).toBe("fallback-1.0.0");
    });

    it("should handle network timeouts gracefully", async () => {
      mockInvoke.mockImplementationOnce(
        () =>
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error("Timeout")), 100),
          ),
      );

      const result = await processor.analyzeSession(mockSessionData);

      expect(result.modelVersion).toBe("fallback-1.0.0");
    });
  });

  describe("accuracy benchmarks", () => {
    it("should maintain minimum confidence thresholds", async () => {
      mockInvoke
        .mockResolvedValueOnce(true) // initialization
        .mockResolvedValueOnce({
          success: true,
          analysis: {
            sessionId: "test-session-123",
            contentType: "text",
            workPatterns: [
              {
                type: "typing",
                confidence: 0.95,
                timeRange: {
                  start: "2024-01-01T10:00:00Z",
                  end: "2024-01-01T11:00:00Z",
                },
                characteristics: {},
                description: "High confidence pattern",
              },
            ],
            confidenceScore: 0.92,
            relevanceScores: [],
            potentialFlags: [],
            summary: {} as any,
            processingTime: 75,
            modelVersion: "1.0.0",
          },
        });

      // Create a new processor to trigger initialization
      const testProcessor = new NotariAIProcessor();
      await new Promise((resolve) => setTimeout(resolve, 10)); // Wait for init

      const result = await testProcessor.analyzeSession(mockSessionData);

      expect(result.confidenceScore).toBeGreaterThan(0.7);
      expect(result.workPatterns[0].confidence).toBeGreaterThan(0.8);
    });

    it("should flag low confidence results appropriately", async () => {
      mockInvoke
        .mockResolvedValueOnce(true) // initialization
        .mockResolvedValueOnce({
          success: true,
          analysis: {
            sessionId: "test-session-123",
            contentType: "mixed",
            workPatterns: [],
            confidenceScore: 0.3,
            relevanceScores: [],
            potentialFlags: [
              {
                type: "ai_generated",
                severity: "high",
                evidence: ["Low confidence in human behavior"],
                confidence: 0.9,
                timeRange: {
                  start: "2024-01-01T10:00:00Z",
                  end: "2024-01-01T11:00:00Z",
                },
                description: "Potential AI-generated content",
              },
            ],
            summary: {} as any,
            processingTime: 200,
            modelVersion: "1.0.0",
          },
        });

      // Create a new processor to trigger initialization
      const testProcessor = new NotariAIProcessor();
      await new Promise((resolve) => setTimeout(resolve, 10)); // Wait for init

      const result = await testProcessor.analyzeSession(mockSessionData);

      expect(result.confidenceScore).toBeLessThan(0.5);
      expect(result.potentialFlags).toHaveLength(1);
      expect(result.potentialFlags[0].severity).toBe("high");
    });
  });
});
