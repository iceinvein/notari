use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use chrono::{DateTime, Utc};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AIAnalysis {
    pub session_id: String,
    pub content_type: ContentType,
    pub work_patterns: Vec<WorkPattern>,
    pub confidence_score: f32,
    pub relevance_scores: Vec<RelevanceScore>,
    pub potential_flags: Vec<AnomalyFlag>,
    pub summary: WorkSummary,
    pub processing_time: u64,
    pub model_version: String,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ContentType {
    Text,
    Image,
    Code,
    Mixed,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkPattern {
    pub pattern_type: PatternType,
    pub confidence: f32,
    pub time_range: TimeRange,
    pub characteristics: HashMap<String, serde_json::Value>,
    pub description: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum PatternType {
    Typing,
    Mouse,
    Application,
    Content,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TimeRange {
    pub start: DateTime<Utc>,
    pub end: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RelevanceScore {
    pub segment: TimeRange,
    pub score: f32,
    pub reasoning: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnomalyFlag {
    pub flag_type: AnomalyType,
    pub severity: Severity,
    pub evidence: Vec<String>,
    pub confidence: f32,
    pub time_range: TimeRange,
    pub description: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum AnomalyType {
    AiGenerated,
    CopyPaste,
    UnusualPattern,
    SuspiciousTiming,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum Severity {
    Low,
    Medium,
    High,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkSummary {
    pub overview: String,
    pub key_activities: Vec<String>,
    pub time_breakdown: Vec<TimeBreakdown>,
    pub productivity: ProductivityMetrics,
    pub authenticity: AuthenticityAssessment,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TimeBreakdown {
    pub activity: String,
    pub duration: u64,
    pub percentage: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProductivityMetrics {
    pub active_time: u64,
    pub idle_time: u64,
    pub focus_score: f32,
    pub task_switching: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuthenticityAssessment {
    pub overall_score: f32,
    pub human_likelihood: f32,
    pub consistency_score: f32,
    pub flags: Vec<String>,
}

impl AIAnalysis {
    pub fn new(session_id: String, model_version: String) -> Self {
        Self {
            session_id,
            content_type: ContentType::Mixed,
            work_patterns: Vec::new(),
            confidence_score: 0.0,
            relevance_scores: Vec::new(),
            potential_flags: Vec::new(),
            summary: WorkSummary::default(),
            processing_time: 0,
            model_version,
            created_at: Utc::now(),
        }
    }
}

impl Default for WorkSummary {
    fn default() -> Self {
        Self {
            overview: String::new(),
            key_activities: Vec::new(),
            time_breakdown: Vec::new(),
            productivity: ProductivityMetrics::default(),
            authenticity: AuthenticityAssessment::default(),
        }
    }
}

impl Default for ProductivityMetrics {
    fn default() -> Self {
        Self {
            active_time: 0,
            idle_time: 0,
            focus_score: 0.0,
            task_switching: 0,
        }
    }
}

impl Default for AuthenticityAssessment {
    fn default() -> Self {
        Self {
            overall_score: 0.0,
            human_likelihood: 0.0,
            consistency_score: 0.0,
            flags: Vec::new(),
        }
    }
}