import { invoke } from "@tauri-apps/api/core";
import jsPDF from "jspdf";
import { v4 as uuidv4 } from "uuid";
import type {
  CryptoSignature,
  EncryptedSessionData,
  Evidence,
  ProofPack,
  ProofPackMetadata,
  SessionId,
  SystemContext,
  TimelineEvent,
  WorkSession,
} from "../../types";
import type { AIAnalysis } from "../../types/ai.types";
import type { VerificationData } from "../../types/verification.types";
import { aiProcessor } from "../ai/AIProcessor";
import { cryptoManager } from "../crypto/CryptoManager";
import { SessionManager } from "../session/SessionManager";

export interface ProofPackAssembler {
  createProofPack(
    sessions: SessionId[],
    config: PackConfig,
  ): Promise<ProofPack>;
  exportToPDF(proofPack: ProofPack): Promise<ArrayBuffer>;
  exportToJSON(proofPack: ProofPack): Promise<string>;
  validateIntegrity(proofPack: ProofPack): Promise<ProofPackValidationResult>;
  getPackageInfo(proofPackId: string): Promise<PackageInfo>;
}

export interface PackConfig {
  title?: string;
  description?: string;
  includeScreenshots: boolean;
  includeTimeline: boolean;
  includeAIAnalysis: boolean;
  compressionLevel: number;
  userId: string;
}

export interface ProofPackValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  integrityScore: number;
}

export interface PackageInfo {
  id: string;
  size: number;
  sessionCount: number;
  duration: number;
  created: number;
}

interface TauriResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export class NotariProofPackAssembler implements ProofPackAssembler {
  private sessionManager: SessionManager;
  private proofPackCache = new Map<string, ProofPack>();

  constructor(sessionManager?: SessionManager) {
    this.sessionManager = sessionManager || new SessionManager();
  }

  async createProofPack(
    sessions: SessionId[],
    config: PackConfig,
  ): Promise<ProofPack> {
    try {
      // Validate input
      if (!sessions.length) {
        throw new Error(
          "At least one session is required to create a Proof Pack",
        );
      }

      // Generate unique ID for the proof pack
      const proofPackId = uuidv4();
      const timestamp = Date.now();

      // Retrieve session data
      const sessionData = await this.retrieveSessionData(sessions);

      // Validate sessions exist and are complete
      await this.validateSessions(sessionData);

      // Generate AI analysis if requested
      const aiAnalysis = config.includeAIAnalysis
        ? await this.generateAIAnalysis(sessionData)
        : [];

      // Create timeline if requested
      const timeline = config.includeTimeline
        ? await this.createTimeline(sessionData)
        : [];

      // Get system context
      const systemContext = await this.getSystemContext();

      // Calculate total duration
      const totalDuration = this.calculateTotalDuration(sessionData);

      // Create metadata
      const metadata: ProofPackMetadata = {
        creator: config.userId,
        created: timestamp,
        sessions: sessions,
        totalDuration,
        title: config.title,
        description: config.description,
        tags: [],
      };

      // Prepare encrypted session data
      const encryptedSessions =
        await this.prepareEncryptedSessions(sessionData);

      // Create evidence bundle
      const evidence: Evidence = {
        sessions: encryptedSessions,
        aiAnalysis,
        timeline,
        systemContext,
      };

      // Generate cryptographic verification data
      const verification = await this.generateVerificationData(
        proofPackId,
        metadata,
        evidence,
      );

      // Assemble the proof pack
      const proofPack: ProofPack = {
        id: proofPackId,
        version: "1.0",
        metadata,
        evidence,
        verification,
      };

      // Store in cache
      this.proofPackCache.set(proofPackId, proofPack);

      // Store proof pack metadata in backend
      await this.storeProofPackMetadata(proofPack);

      return proofPack;
    } catch (error) {
      throw new Error(
        `Failed to create Proof Pack: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  async exportToPDF(proofPack: ProofPack): Promise<ArrayBuffer> {
    try {
      const pdf = new jsPDF();

      // Add title page
      pdf.setFontSize(20);
      pdf.text("Notari Proof Pack", 20, 30);

      pdf.setFontSize(12);
      pdf.text(`ID: ${proofPack.id}`, 20, 50);
      pdf.text(
        `Created: ${new Date(proofPack.metadata.created).toLocaleString()}`,
        20,
        60,
      );
      pdf.text(`Creator: ${proofPack.metadata.creator}`, 20, 70);

      if (proofPack.metadata.title) {
        pdf.text(`Title: ${proofPack.metadata.title}`, 20, 80);
      }

      if (proofPack.metadata.description) {
        pdf.text(`Description: ${proofPack.metadata.description}`, 20, 90);
      }

      // Add session summary
      pdf.addPage();
      pdf.setFontSize(16);
      pdf.text("Session Summary", 20, 30);

      pdf.setFontSize(12);
      pdf.text(`Total Sessions: ${proofPack.metadata.sessions.length}`, 20, 50);
      pdf.text(
        `Total Duration: ${this.formatDuration(proofPack.metadata.totalDuration)}`,
        20,
        60,
      );

      // Add verification information
      pdf.addPage();
      pdf.setFontSize(16);
      pdf.text("Verification Information", 20, 30);

      pdf.setFontSize(12);
      pdf.text(
        `Integrity Hash: ${proofPack.verification.integrityHash}`,
        20,
        50,
      );
      pdf.text(
        `Signature: ${proofPack.verification.signature?.keyId || "N/A"}`,
        20,
        60,
      );

      if (proofPack.verification.blockchainAnchor) {
        pdf.text(
          `Blockchain Anchor: ${proofPack.verification.blockchainAnchor.transactionId}`,
          20,
          70,
        );
      }

      // Add AI analysis summary if available
      if (proofPack.evidence.aiAnalysis.length > 0) {
        pdf.addPage();
        pdf.setFontSize(16);
        pdf.text("AI Analysis Summary", 20, 30);

        let yPos = 50;
        for (const analysis of proofPack.evidence.aiAnalysis) {
          pdf.setFontSize(12);
          pdf.text(`Session: ${analysis.sessionId}`, 20, yPos);
          pdf.text(
            `Confidence: ${(analysis.confidenceScore * 100).toFixed(1)}%`,
            20,
            yPos + 10,
          );
          pdf.text(`Content Type: ${analysis.contentType}`, 20, yPos + 20);

          if (analysis.summary) {
            const summaryLines = pdf.splitTextToSize(
              analysis.summary.overview,
              170,
            );
            pdf.text(summaryLines, 20, yPos + 30);
            yPos += 30 + summaryLines.length * 5;
          }

          yPos += 20;

          if (yPos > 250) {
            pdf.addPage();
            yPos = 30;
          }
        }
      }

      return pdf.output("arraybuffer");
    } catch (error) {
      throw new Error(
        `Failed to export PDF: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  async exportToJSON(proofPack: ProofPack): Promise<string> {
    try {
      // Create a serializable version of the proof pack
      const serializable = {
        ...proofPack,
        evidence: {
          ...proofPack.evidence,
          sessions: proofPack.evidence.sessions.map((session) => ({
            ...session,
            encryptedContent: Array.from(
              new Uint8Array(session.encryptedContent),
            ),
          })),
        },
      };

      return JSON.stringify(serializable, null, 2);
    } catch (error) {
      throw new Error(
        `Failed to export JSON: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  async validateIntegrity(
    proofPack: ProofPack,
  ): Promise<ProofPackValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    let integrityScore = 1.0;

    try {
      // Validate basic structure
      if (
        !proofPack.id ||
        !proofPack.version ||
        !proofPack.metadata ||
        !proofPack.evidence ||
        !proofPack.verification
      ) {
        errors.push("Proof Pack is missing required fields");
        integrityScore -= 0.5;
      }

      // Validate metadata
      if (
        !proofPack.metadata.creator ||
        !proofPack.metadata.created ||
        !proofPack.metadata.sessions.length
      ) {
        errors.push("Proof Pack metadata is incomplete");
        integrityScore -= 0.3;
      }

      // Validate sessions exist
      for (const sessionId of proofPack.metadata.sessions) {
        const session = await this.sessionManager.getSession(sessionId);
        if (!session) {
          errors.push(`Session ${sessionId} not found`);
          integrityScore -= 0.2;
        } else if (session.tamperEvidence) {
          warnings.push(`Session ${sessionId} has tamper evidence`);
          integrityScore -= 0.1;
        }
      }

      // Validate cryptographic integrity
      const isHashValid = await this.validateHash(proofPack);
      if (!isHashValid) {
        errors.push("Cryptographic hash validation failed");
        integrityScore -= 0.4;
      }

      // Validate signature if present
      if (proofPack.verification.signature) {
        const isSignatureValid = await this.validateSignature(proofPack);
        if (!isSignatureValid) {
          errors.push("Digital signature validation failed");
          integrityScore -= 0.3;
        }
      }

      // Validate blockchain anchor if present
      if (proofPack.verification.blockchainAnchor) {
        const isAnchorValid = await this.validateBlockchainAnchor(proofPack);
        if (!isAnchorValid) {
          warnings.push("Blockchain anchor validation failed");
          integrityScore -= 0.1;
        }
      }

      // Ensure score doesn't go below 0
      integrityScore = Math.max(0, integrityScore);

      return {
        isValid: errors.length === 0,
        errors,
        warnings,
        integrityScore,
      };
    } catch (error) {
      errors.push(
        `Validation error: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
      return {
        isValid: false,
        errors,
        warnings,
        integrityScore: 0,
      };
    }
  }

  async getPackageInfo(proofPackId: string): Promise<PackageInfo> {
    try {
      // Try to get from cache first
      const cachedPack = this.proofPackCache.get(proofPackId);
      if (cachedPack) {
        return this.extractPackageInfo(cachedPack);
      }

      // Try to load from backend
      const response: TauriResponse<ProofPack> = await invoke(
        "get_proof_pack",
        { proofPackId },
      );

      if (!response.success || !response.data) {
        throw new Error(response.error || "Proof Pack not found");
      }

      const proofPack = response.data;
      this.proofPackCache.set(proofPackId, proofPack);

      return this.extractPackageInfo(proofPack);
    } catch (error) {
      throw new Error(
        `Failed to get package info: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  private async retrieveSessionData(sessions: SessionId[]) {
    const sessionData = [];

    for (const sessionId of sessions) {
      const session = await this.sessionManager.getSession(sessionId);
      if (!session) {
        throw new Error(`Session ${sessionId} not found`);
      }
      sessionData.push(session);
    }

    return sessionData;
  }

  private async validateSessions(sessions: WorkSession[]) {
    for (const session of sessions) {
      if (session.status !== "completed") {
        throw new Error(
          `Session ${session.id} is not completed (status: ${session.status})`,
        );
      }

      if (session.tamperEvidence) {
        throw new Error(
          `Session ${session.id} has tamper evidence: ${session.tamperEvidence}`,
        );
      }
    }
  }

  private async generateAIAnalysis(
    sessions: WorkSession[],
  ): Promise<AIAnalysis[]> {
    const analyses = [];

    for (const session of sessions) {
      try {
        // Create encrypted session data for AI processing
        const encryptedSessionData: EncryptedSessionData = {
          sessionId: session.id,
          encryptedContent: new ArrayBuffer(0), // Would be loaded from file
          contentHash: session.integrityHash || "",
          timestamp: session.startTime,
        };

        const analysis = await aiProcessor.analyzeSession(encryptedSessionData);
        analyses.push(analysis);
      } catch (error) {
        console.warn(`Failed to analyze session ${session.id}:`, error);
      }
    }

    return analyses;
  }

  private async createTimeline(
    sessions: WorkSession[],
  ): Promise<TimelineEvent[]> {
    const timeline: TimelineEvent[] = [];

    for (const session of sessions) {
      // Add session start event
      timeline.push({
        timestamp: session.startTime,
        type: "application_switch",
        data: { event: "session_start", sessionId: session.id },
        sessionId: session.id,
      });

      // Add session end event if available
      if (session.endTime) {
        timeline.push({
          timestamp: session.endTime,
          type: "application_switch",
          data: { event: "session_end", sessionId: session.id },
          sessionId: session.id,
        });
      }
    }

    // Sort timeline by timestamp
    timeline.sort((a, b) => a.timestamp - b.timestamp);

    return timeline;
  }

  private async getSystemContext(): Promise<SystemContext> {
    try {
      const response: TauriResponse<SystemContext> =
        await invoke("get_system_context");

      if (response.success && response.data) {
        return response.data;
      }

      // Fallback system context
      return {
        operatingSystem: navigator.platform,
        platform: "web",
        deviceId: "unknown",
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        locale: navigator.language,
        screenResolution: {
          width: screen.width,
          height: screen.height,
        },
      };
    } catch (error) {
      console.warn("Failed to get system context:", error);
      return {
        operatingSystem: navigator.platform,
        platform: "web",
        deviceId: "unknown",
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        locale: navigator.language,
        screenResolution: {
          width: screen.width,
          height: screen.height,
        },
      };
    }
  }

  private calculateTotalDuration(sessions: WorkSession[]): number {
    return sessions.reduce((total, session) => {
      const duration = session.endTime
        ? session.endTime - session.startTime
        : 0;
      return total + duration;
    }, 0);
  }

  private async prepareEncryptedSessions(
    sessions: WorkSession[],
  ): Promise<EncryptedSessionData[]> {
    const encryptedSessions = [];

    for (const session of sessions) {
      // In a real implementation, this would load the actual encrypted session data
      const encryptedSessionData: EncryptedSessionData = {
        sessionId: session.id,
        encryptedContent: new ArrayBuffer(1024), // Placeholder
        contentHash: session.integrityHash || "",
        timestamp: session.startTime,
      };

      encryptedSessions.push(encryptedSessionData);
    }

    return encryptedSessions;
  }

  private async generateVerificationData(
    proofPackId: string,
    metadata: ProofPackMetadata,
    evidence: Evidence,
  ): Promise<VerificationData> {
    try {
      // Create data to hash (metadata + evidence structure)
      const dataToHash = JSON.stringify({
        id: proofPackId,
        metadata,
        evidenceStructure: {
          sessionCount: evidence.sessions.length,
          aiAnalysisCount: evidence.aiAnalysis.length,
          timelineEventCount: evidence.timeline.length,
          systemContext: evidence.systemContext,
        },
      });

      const encoder = new TextEncoder();
      const dataBuffer = encoder.encode(dataToHash);

      // Generate hash
      const hashResult = await cryptoManager.hash(dataBuffer);

      // Generate signature
      let signature: CryptoSignature | undefined;
      try {
        const deviceKeys = cryptoManager.getDeviceKeys();
        if (deviceKeys.length > 0) {
          signature = await cryptoManager.sign(dataBuffer, deviceKeys[0].id);
        }
      } catch (error) {
        console.warn("Failed to generate signature:", error);
      }

      return {
        integrityHash: hashResult.hash,
        signature,
        timestamp: Date.now(),
        version: "1.0",
      };
    } catch (error) {
      throw new Error(
        `Failed to generate verification data: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  private async storeProofPackMetadata(proofPack: ProofPack): Promise<void> {
    try {
      const response: TauriResponse<void> = await invoke(
        "store_proof_pack_metadata",
        {
          proofPack: {
            ...proofPack,
            evidence: {
              ...proofPack.evidence,
              sessions: proofPack.evidence.sessions.map((session) => ({
                ...session,
                encryptedContent: Array.from(
                  new Uint8Array(session.encryptedContent),
                ),
              })),
            },
          },
        },
      );

      if (!response.success) {
        throw new Error(
          response.error || "Failed to store proof pack metadata",
        );
      }
    } catch (error) {
      console.warn("Failed to store proof pack metadata:", error);
    }
  }

  private async validateHash(proofPack: ProofPack): Promise<boolean> {
    try {
      // Recreate the hash and compare
      const dataToHash = JSON.stringify({
        id: proofPack.id,
        metadata: proofPack.metadata,
        evidenceStructure: {
          sessionCount: proofPack.evidence.sessions.length,
          aiAnalysisCount: proofPack.evidence.aiAnalysis.length,
          timelineEventCount: proofPack.evidence.timeline.length,
          systemContext: proofPack.evidence.systemContext,
        },
      });

      const encoder = new TextEncoder();
      const dataBuffer = encoder.encode(dataToHash);
      const hashResult = await cryptoManager.hash(dataBuffer);

      return hashResult.hash === proofPack.verification.integrityHash;
    } catch (error) {
      console.error("Hash validation error:", error);
      return false;
    }
  }

  private async validateSignature(proofPack: ProofPack): Promise<boolean> {
    try {
      if (!proofPack.verification.signature) {
        return false;
      }

      const dataToHash = JSON.stringify({
        id: proofPack.id,
        metadata: proofPack.metadata,
        evidenceStructure: {
          sessionCount: proofPack.evidence.sessions.length,
          aiAnalysisCount: proofPack.evidence.aiAnalysis.length,
          timelineEventCount: proofPack.evidence.timeline.length,
          systemContext: proofPack.evidence.systemContext,
        },
      });

      const encoder = new TextEncoder();
      const dataBuffer = encoder.encode(dataToHash);

      return await cryptoManager.verify(
        dataBuffer,
        proofPack.verification.signature,
      );
    } catch (error) {
      console.error("Signature validation error:", error);
      return false;
    }
  }

  private async validateBlockchainAnchor(
    proofPack: ProofPack,
  ): Promise<boolean> {
    try {
      // This would validate the blockchain anchor
      // For now, just check if the anchor exists
      return !!proofPack.verification.blockchainAnchor?.transactionId;
    } catch (error) {
      console.error("Blockchain anchor validation error:", error);
      return false;
    }
  }

  private extractPackageInfo(proofPack: ProofPack): PackageInfo {
    // Calculate approximate size
    const jsonString = JSON.stringify(proofPack);
    const size = new Blob([jsonString]).size;

    return {
      id: proofPack.id,
      size,
      sessionCount: proofPack.metadata.sessions.length,
      duration: proofPack.metadata.totalDuration,
      created: proofPack.metadata.created,
    };
  }

  private formatDuration(durationMs: number): string {
    const seconds = Math.floor(durationMs / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }
}

// Export singleton instance
export const proofPackAssembler = new NotariProofPackAssembler();
