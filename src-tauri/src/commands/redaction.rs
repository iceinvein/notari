use tauri::State;
use serde::{Deserialize, Serialize};
use crate::redaction::{
    engine::{RedactionEngine, RedactionPlan, RedactedProofPack},
    commitment::{CommitmentGenerator, RedactionCommitment},
    proofs::{ProofGenerator, RedactionData, RedactionArea, PartialVerificationResult},
};

#[derive(Debug, Serialize)]
pub struct RedactionResponse<T> {
    pub success: bool,
    pub data: Option<T>,
    pub error: Option<String>,
}

impl<T> RedactionResponse<T> {
    pub fn success(data: T) -> Self {
        Self {
            success: true,
            data: Some(data),
            error: None,
        }
    }
    
    pub fn error(message: String) -> Self {
        Self {
            success: false,
            data: None,
            error: Some(message),
        }
    }
}

#[tauri::command]
pub async fn mark_for_redaction(
    proof_pack_id: String,
    areas: Vec<RedactionArea>,
) -> RedactionResponse<RedactionPlan> {
    // Analyze redaction impact
    let affected_sessions: Vec<String> = areas.iter()
        .map(|area| area.session_id.clone())
        .collect::<std::collections::HashSet<_>>()
        .into_iter()
        .collect();
    
    let verification_capability = match affected_sessions.len() {
        0 => "full".to_string(),
        1..=2 => "partial".to_string(),
        _ => "limited".to_string(),
    };
    
    let critical_data_removed = areas.iter().any(|area| {
        area.reason.to_lowercase().contains("critical") ||
        area.coordinates.as_ref().map_or(false, |coords| coords.width * coords.height > 50000.0)
    });
    
    let mut warnings = Vec::new();
    if verification_capability == "limited" {
        warnings.push("Extensive redactions may significantly limit verification capabilities".to_string());
    }
    if critical_data_removed {
        warnings.push("Redacting large or critical areas may affect proof validity".to_string());
    }
    
    let plan = RedactionPlan {
        proof_pack_id,
        areas,
        estimated_impact: crate::redaction::engine::RedactionImpact {
            verification_capability,
            affected_sessions,
            critical_data_removed,
        },
        warnings,
    };
    
    RedactionResponse::success(plan)
}

#[tauri::command]
pub async fn apply_redactions_backend(
    plan: RedactionPlan,
    redaction_data: RedactionData,
) -> RedactionResponse<RedactedProofPack> {
    match RedactionEngine::apply_redactions(&plan, &redaction_data) {
        Ok(redacted_pack) => RedactionResponse::success(redacted_pack),
        Err(e) => RedactionResponse::error(e),
    }
}

#[tauri::command]
pub async fn generate_commitment_proof(
    area_id: String,
    area_data: Vec<u8>,
    algorithm: String,
) -> RedactionResponse<String> {
    match RedactionEngine::generate_commitment_proof(&area_id, &area_data, &algorithm) {
        Ok(proof) => RedactionResponse::success(proof),
        Err(e) => RedactionResponse::error(e),
    }
}

#[tauri::command]
pub async fn verify_commitment_proof(
    proof: RedactionCommitment,
) -> RedactionResponse<bool> {
    match RedactionEngine::verify_commitment_proof(&proof) {
        Ok(is_valid) => RedactionResponse::success(is_valid),
        Err(e) => RedactionResponse::error(e),
    }
}

#[tauri::command]
pub async fn validate_redaction_integrity_backend(
    redaction_data: RedactionData,
) -> RedactionResponse<bool> {
    match ProofGenerator::verify_redaction_integrity(&redaction_data) {
        Ok(is_valid) => RedactionResponse::success(is_valid),
        Err(e) => RedactionResponse::error(e),
    }
}

#[tauri::command]
pub async fn verify_redacted_pack(
    redacted_pack: RedactedProofPack,
) -> RedactionResponse<PartialVerificationResult> {
    match RedactionEngine::verify_redacted_pack(&redacted_pack) {
        Ok(result) => RedactionResponse::success(result),
        Err(e) => RedactionResponse::error(e),
    }
}

#[tauri::command]
pub async fn get_redaction_capabilities() -> RedactionResponse<crate::redaction::engine::RedactionCapabilities> {
    let capabilities = RedactionEngine::get_capabilities();
    RedactionResponse::success(capabilities)
}

#[tauri::command]
pub async fn generate_separate_hashes(
    original_data: Vec<u8>,
    redacted_areas: Vec<RedactionArea>,
) -> RedactionResponse<(String, String)> {
    match ProofGenerator::generate_separate_hashes(&original_data, &redacted_areas) {
        Ok((original_hash, redacted_hash)) => RedactionResponse::success((original_hash, redacted_hash)),
        Err(e) => RedactionResponse::error(e),
    }
}