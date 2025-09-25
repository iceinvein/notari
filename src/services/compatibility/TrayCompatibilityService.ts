import { invoke } from "@tauri-apps/api/core";
import type { ProofPack } from "../../types/proofPack.types";
import type { WorkSession } from "../../types/session.types";

/**
 * Service to ensure backward compatibility between tray and window modes
 * Handles data synchronization and migration between different UI modes
 */
export class TrayCompatibilityService {
  private static instance: TrayCompatibilityService;

  private constructor() {}

  public static getInstance(): TrayCompatibilityService {
    if (!TrayCompatibilityService.instance) {
      TrayCompatibilityService.instance = new TrayCompatibilityService();
    }
    return TrayCompatibilityService.instance;
  }

  /**
   * Ensures session data is accessible from both tray and window modes
   */
  async syncSessionData(): Promise<void> {
    try {
      // Get all sessions to ensure they're properly indexed
      const sessions = await this.getAllSessions();

      // Validate session data integrity
      for (const session of sessions) {
        await this.validateSessionIntegrity(session);
      }
    } catch (error) {
      console.error("Failed to sync session data:", error);
      throw new Error(`Session data sync failed: ${error}`);
    }
  }

  /**
   * Ensures proof pack data is accessible from both modes
   */
  async syncProofPackData(): Promise<void> {
    try {
      // Get all proof packs to ensure they're properly indexed
      const proofPacks = await this.getAllProofPacks();

      // Validate proof pack data integrity
      for (const proofPack of proofPacks) {
        await this.validateProofPackIntegrity(proofPack);
      }
    } catch (error) {
      console.error("Failed to sync proof pack data:", error);
      throw new Error(`Proof pack data sync failed: ${error}`);
    }
  }

  /**
   * Migrates any legacy data structures to be compatible with tray mode
   */
  async migrateToTrayCompatibility(): Promise<void> {
    try {
      // Check if migration is needed
      const migrationStatus = await this.checkMigrationStatus();

      if (!migrationStatus.isRequired) {
        return;
      }

      // Perform migration steps
      await this.migrateLegacySettings();
      await this.migrateLegacySessionData();
      await this.migrateLegacyProofPackData();

      // Mark migration as complete
      await this.markMigrationComplete();
    } catch (error) {
      console.error("Failed to migrate to tray compatibility:", error);
      throw new Error(`Migration failed: ${error}`);
    }
  }

  /**
   * Validates that existing session data is intact and accessible
   */
  private async validateSessionIntegrity(
    session: WorkSession,
  ): Promise<boolean> {
    try {
      const result = await invoke<boolean>("verify_session_integrity", {
        sessionId: session.id,
      });

      if (!result) {
        console.warn(`Session ${session.id} failed integrity check`);
      }

      return result;
    } catch (error) {
      console.error(`Failed to validate session ${session.id}:`, error);
      return false;
    }
  }

  /**
   * Validates that existing proof pack data is intact and accessible
   */
  private async validateProofPackIntegrity(
    proofPack: ProofPack,
  ): Promise<boolean> {
    try {
      // Check if proof pack files exist and are accessible
      const result = await invoke<boolean>("verify_proof_pack_integrity", {
        proofPackId: proofPack.id,
      });

      if (!result) {
        console.warn(`Proof pack ${proofPack.id} failed integrity check`);
      }

      return result;
    } catch (error) {
      console.error(`Failed to validate proof pack ${proofPack.id}:`, error);
      return false;
    }
  }

  /**
   * Gets all sessions from the backend
   */
  private async getAllSessions(): Promise<WorkSession[]> {
    try {
      return await invoke<WorkSession[]>("get_user_sessions");
    } catch (error) {
      console.error("Failed to get all sessions:", error);
      return [];
    }
  }

  /**
   * Gets all proof packs from the backend
   */
  private async getAllProofPacks(): Promise<ProofPack[]> {
    try {
      // This would need to be implemented in the backend
      return await invoke<ProofPack[]>("get_all_proof_packs");
    } catch (error) {
      console.error("Failed to get all proof packs:", error);
      return [];
    }
  }

  /**
   * Checks if migration to tray compatibility is required
   */
  private async checkMigrationStatus(): Promise<{
    isRequired: boolean;
    version: string;
  }> {
    try {
      return await invoke<{ isRequired: boolean; version: string }>(
        "check_tray_migration_status",
      );
    } catch (error) {
      console.error("Failed to check migration status:", error);
      // Assume migration is required if we can't check
      return { isRequired: true, version: "unknown" };
    }
  }

  /**
   * Migrates legacy settings to be compatible with tray mode
   */
  private async migrateLegacySettings(): Promise<void> {
    try {
      await invoke("migrate_legacy_settings_for_tray");
    } catch (error) {
      console.error("Failed to migrate legacy settings:", error);
      throw error;
    }
  }

  /**
   * Migrates legacy session data structures
   */
  private async migrateLegacySessionData(): Promise<void> {
    try {
      await invoke("migrate_legacy_session_data");
    } catch (error) {
      console.error("Failed to migrate legacy session data:", error);
      throw error;
    }
  }

  /**
   * Migrates legacy proof pack data structures
   */
  private async migrateLegacyProofPackData(): Promise<void> {
    try {
      await invoke("migrate_legacy_proof_pack_data");
    } catch (error) {
      console.error("Failed to migrate legacy proof pack data:", error);
      throw error;
    }
  }

  /**
   * Marks migration as complete
   */
  private async markMigrationComplete(): Promise<void> {
    try {
      await invoke("mark_tray_migration_complete");
    } catch (error) {
      console.error("Failed to mark migration complete:", error);
      throw error;
    }
  }

  /**
   * Ensures data consistency between tray and window modes
   */
  async ensureDataConsistency(): Promise<void> {
    try {
      await Promise.all([this.syncSessionData(), this.syncProofPackData()]);
    } catch (error) {
      console.error("Failed to ensure data consistency:", error);
      throw error;
    }
  }

  /**
   * Initializes compatibility layer on app startup
   */
  async initialize(): Promise<void> {
    try {
      // Run migration if needed
      await this.migrateToTrayCompatibility();

      // Ensure data consistency
      await this.ensureDataConsistency();

      console.log("Tray compatibility service initialized successfully");
    } catch (error) {
      console.error("Failed to initialize tray compatibility service:", error);
      throw error;
    }
  }
}

// Export singleton instance
export const trayCompatibilityService = TrayCompatibilityService.getInstance();
