use crate::ai::{AIProcessor, AIAnalysis};
use crate::capture::types::SessionData;
use std::sync::Arc;
use tokio::sync::Mutex;
use tauri::State;
use serde::{Deserialize, Serialize};

pub type AIState = Arc<Mutex<Option<AIProcessor>>>;

#[derive(Debug, Serialize, Deserialize)]
pub struct AIAnalysisResult {
    pub success: bool,
    pub analysis: Option<AIAnalysis>,
    pub error: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AIProcessorStatus {
    pub initialized: bool,
    pub models_loaded: usize,
    pub version: String,
}

#[tauri::command]
pub async fn initialize_ai_processor(ai_state: State<'_, AIState>) -> Result<bool, String> {
    let mut state = ai_state.lock().await;
    
    match AIProcessor::new().await {
        Ok(processor) => {
            *state = Some(processor);
            Ok(true)
        }
        Err(e) => {
            eprintln!("Failed to initialize AI processor: {}", e);
            Ok(false) // Return false but don't error - we can work without AI
        }
    }
}

#[tauri::command]
pub async fn analyze_session_data(
    session_data: SessionData,
    ai_state: State<'_, AIState>,
) -> Result<AIAnalysisResult, String> {
    let state = ai_state.lock().await;
    
    match state.as_ref() {
        Some(processor) => {
            match processor.analyze_session(&session_data).await {
                Ok(analysis) => Ok(AIAnalysisResult {
                    success: true,
                    analysis: Some(analysis),
                    error: None,
                }),
                Err(e) => Ok(AIAnalysisResult {
                    success: false,
                    analysis: None,
                    error: Some(e.to_string()),
                }),
            }
        }
        None => Ok(AIAnalysisResult {
            success: false,
            analysis: None,
            error: Some("AI processor not initialized".to_string()),
        }),
    }
}

#[tauri::command]
pub async fn get_ai_processor_status(ai_state: State<'_, AIState>) -> Result<AIProcessorStatus, String> {
    let state = ai_state.lock().await;
    
    match state.as_ref() {
        Some(_processor) => Ok(AIProcessorStatus {
            initialized: true,
            models_loaded: 0, // TODO: Get actual count from processor
            version: "1.0.0".to_string(),
        }),
        None => Ok(AIProcessorStatus {
            initialized: false,
            models_loaded: 0,
            version: "1.0.0".to_string(),
        }),
    }
}

#[tauri::command]
pub async fn generate_work_summary(
    session_data: SessionData,
    ai_state: State<'_, AIState>,
) -> Result<Option<crate::ai::analysis::WorkSummary>, String> {
    let state = ai_state.lock().await;
    
    match state.as_ref() {
        Some(processor) => {
            // First analyze the session
            match processor.analyze_session(&session_data).await {
                Ok(analysis) => {
                    let summary = processor.generate_summary(&analysis, &session_data);
                    Ok(Some(summary))
                }
                Err(e) => {
                    eprintln!("Failed to generate summary: {}", e);
                    Ok(None)
                }
            }
        }
        None => Ok(None),
    }
}

pub fn init_ai_state() -> AIState {
    Arc::new(Mutex::new(None))
}