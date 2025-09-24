import { invoke } from "@tauri-apps/api/core";
import { useCallback } from "react";
import type {
  PartialVerificationResult,
  ProofPack,
  RedactedProofPack,
  RedactionArea,
  RedactionPlan,
  RedactionProof,
} from "../types";

interface RedactionResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface UseRedactionEngine {
  markForRedaction: (
    proofPack: ProofPack,
    areas: RedactionArea[],
  ) => Promise<RedactionPlan>;
  applyRedactions: (plan: RedactionPlan) => Promise<RedactedProofPack>;
  verifyRedactedPack: (
    pack: RedactedProofPack,
  ) => Promise<PartialVerificationResult>;
  generateRedactionProof: (areas: RedactionArea[]) => Promise<RedactionProof[]>;
  validateRedactionIntegrity: (pack: RedactedProofPack) => Promise<boolean>;
}

export const useRedactionEngine = (): UseRedactionEngine => {
  const markForRedaction = useCallback(
    async (
      proofPack: ProofPack,
      areas: RedactionArea[],
    ): Promise<RedactionPlan> => {
      const response: RedactionResponse<RedactionPlan> = await invoke(
        "mark_for_redaction",
        {
          proofPackId: proofPack.id,
          areas: areas.map((area) => ({
            ...area,
            coordinates: area.coordinates
              ? {
                  x: area.coordinates.x,
                  y: area.coordinates.y,
                  width: area.coordinates.width,
                  height: area.coordinates.height,
                }
              : null,
          })),
        },
      );

      if (!response.success || !response.data) {
        throw new Error(response.error || "Failed to create redaction plan");
      }

      return response.data;
    },
    [],
  );

  const applyRedactions = useCallback(
    async (plan: RedactionPlan): Promise<RedactedProofPack> => {
      const response: RedactionResponse<RedactedProofPack> = await invoke(
        "apply_redactions",
        {
          plan: {
            proofPackId: plan.proofPackId,
            areas: plan.areas.map((area) => ({
              ...area,
              coordinates: area.coordinates
                ? {
                    x: area.coordinates.x,
                    y: area.coordinates.y,
                    width: area.coordinates.width,
                    height: area.coordinates.height,
                  }
                : null,
            })),
            estimatedImpact: plan.estimatedImpact,
            warnings: plan.warnings,
          },
        },
      );

      if (!response.success || !response.data) {
        throw new Error(response.error || "Failed to apply redactions");
      }

      return response.data;
    },
    [],
  );

  const verifyRedactedPack = useCallback(
    async (pack: RedactedProofPack): Promise<PartialVerificationResult> => {
      const response: RedactionResponse<PartialVerificationResult> =
        await invoke("verify_redacted_pack", {
          redactedPack: {
            originalId: pack.originalId,
            redactedId: pack.redactedId,
            redactionData: pack.redactionData,
            partialVerificationCapable: pack.partialVerificationCapable,
          },
        });

      if (!response.success || !response.data) {
        throw new Error(response.error || "Failed to verify redacted pack");
      }

      return response.data;
    },
    [],
  );

  const generateRedactionProof = useCallback(
    async (areas: RedactionArea[]): Promise<RedactionProof[]> => {
      const response: RedactionResponse<RedactionProof[]> = await invoke(
        "generate_redaction_proof",
        {
          areas: areas.map((area) => ({
            ...area,
            coordinates: area.coordinates
              ? {
                  x: area.coordinates.x,
                  y: area.coordinates.y,
                  width: area.coordinates.width,
                  height: area.coordinates.height,
                }
              : null,
          })),
        },
      );

      if (!response.success || !response.data) {
        throw new Error(response.error || "Failed to generate redaction proof");
      }

      return response.data;
    },
    [],
  );

  const validateRedactionIntegrity = useCallback(
    async (pack: RedactedProofPack): Promise<boolean> => {
      const response: RedactionResponse<boolean> = await invoke(
        "validate_redaction_integrity",
        {
          redactedPack: {
            originalId: pack.originalId,
            redactedId: pack.redactedId,
            redactionData: pack.redactionData,
            partialVerificationCapable: pack.partialVerificationCapable,
          },
        },
      );

      if (!response.success) {
        throw new Error(
          response.error || "Failed to validate redaction integrity",
        );
      }

      return response.data || false;
    },
    [],
  );

  return {
    markForRedaction,
    applyRedactions,
    verifyRedactedPack,
    generateRedactionProof,
    validateRedactionIntegrity,
  };
};
