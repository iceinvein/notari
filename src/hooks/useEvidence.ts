import { useQuery } from "@tanstack/react-query";
import { invoke } from "@tauri-apps/api/core";

// Evidence types (must match Rust enum with UPPERCASE serialization)
export type VerificationStatus = "VERIFIED" | "FAILED" | "WARNING";
export type CheckResult = "PASS" | "FAIL" | "SKIP";

export type VerificationChecks = {
	manifest_structure: CheckResult;
	signature_valid: CheckResult;
	hash_match: CheckResult;
};

export type RecordingInfoSummary = {
	session_id: string;
	created_at: string;
	duration_seconds: number;
	window_title: string;
};

export type SignatureInfoSummary = {
	algorithm: string;
	public_key: string;
	verified_by: string;
};

export type VerificationInfo = {
	timestamp: string;
	status: VerificationStatus;
	checks: VerificationChecks;
	recording_info: RecordingInfoSummary;
	signature_info: SignatureInfoSummary;
};

export type VerificationReport = {
	verification: VerificationInfo;
};

// Query keys
const EVIDENCE_QUERY_KEYS = {
	hasSigningKey: ["evidence", "hasSigningKey"] as const,
	publicKey: ["evidence", "publicKey"] as const,
	verifyRecording: (manifestPath: string, videoPath: string) =>
		["evidence", "verify", manifestPath, videoPath] as const,
};

// Check if signing key exists
export function useHasSigningKeyQuery() {
	return useQuery({
		queryKey: EVIDENCE_QUERY_KEYS.hasSigningKey,
		queryFn: async (): Promise<boolean> => {
			return await invoke("has_signing_key");
		},
		staleTime: 60000, // Cache for 1 minute
	});
}

// Get public key
export function usePublicKeyQuery() {
	return useQuery({
		queryKey: EVIDENCE_QUERY_KEYS.publicKey,
		queryFn: async (): Promise<string | null> => {
			try {
				return await invoke<string>("export_public_key");
			} catch (error) {
				console.error("Failed to get public key:", error);
				return null;
			}
		},
		staleTime: 300000, // Cache for 5 minutes
	});
}

// Verify a recording
export function useVerifyRecordingQuery(manifestPath: string | null, videoPath: string | null) {
	return useQuery({
		queryKey: EVIDENCE_QUERY_KEYS.verifyRecording(manifestPath || "", videoPath || ""),
		queryFn: async (): Promise<VerificationReport> => {
			if (!manifestPath || !videoPath) {
				throw new Error("Manifest path and video path are required");
			}
			return await invoke<VerificationReport>("verify_recording", {
				manifestPath,
				videoPath,
			});
		},
		enabled: !!manifestPath && !!videoPath,
		staleTime: 0, // Always fresh
	});
}

// Helper to format public key fingerprint (first 8 chars)
export function formatPublicKeyFingerprint(publicKey: string): string {
	if (!publicKey || publicKey.length < 8) return "N/A";
	return `${publicKey.substring(0, 8)}...`;
}

// Helper to get verification status color
export function getVerificationStatusColor(
	status: VerificationStatus
): "success" | "danger" | "warning" {
	switch (status) {
		case "VERIFIED":
			return "success";
		case "FAILED":
			return "danger";
		case "WARNING":
			return "warning";
		default:
			return "warning";
	}
}
