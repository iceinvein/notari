use crate::ai::{
    analysis::{AIAnalysis, WorkSummary, ProductivityMetrics, AuthenticityAssessment, ContentType},
    models::{ModelRegistry, ModelType},
    patterns::{PatternAnalyzer, KeystrokeEvent, MouseEvent},
};
use crate::capture::types::SessionData;
use std::sync::Arc;
use tokio::sync::RwLock;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum AIProcessorError {
    #[error("Model loading failed: {0}")]
    ModelLoadError(String),
    #[error("Inference failed: {0}")]
    InferenceError(String),
    #[error("Data preprocessing failed: {0}")]
    PreprocessingError(String),
    #[error("Statistical analysis error: {0}")]
    StatisticalError(String),
    #[error("IO error: {0}")]
    IoError(#[from] std::io::Error),
}

pub type Result<T> = std::result::Result<T, AIProcessorError>;

pub struct AIProcessor {
    model_registry: Arc<RwLock<ModelRegistry>>,
    pattern_analyzer: PatternAnalyzer,
    use_local_models: bool,
}

impl AIProcessor {
    pub async fn new() -> Result<Self> {
        let model_registry = Arc::new(RwLock::new(ModelRegistry::default()));
        let pattern_analyzer = PatternAnalyzer::new();

        let processor = Self {
            model_registry,
            pattern_analyzer,
            use_local_models: false, // Start with statistical analysis only
        };

        Ok(processor)
    }

    pub async fn analyze_session(&self, session_data: &SessionData) -> Result<AIAnalysis> {
        let start_time = std::time::Instant::now();
        
        let mut analysis = AIAnalysis::new(
            session_data.session_id.clone(),
            "1.0.0".to_string(),
        );

        // Extract events from session data
        let keystrokes = self.extract_keystrokes(session_data)?;
        let mouse_events = self.extract_mouse_events(session_data)?;

        // Analyze patterns using statistical methods
        let typing_patterns = self.pattern_analyzer.analyze_typing_patterns(&keystrokes);
        let mouse_patterns = self.pattern_analyzer.analyze_mouse_patterns(&mouse_events);
        let anomalies = self.pattern_analyzer.detect_anomalies(&keystrokes, &mouse_events);

        analysis.work_patterns.extend(typing_patterns);
        analysis.work_patterns.extend(mouse_patterns);
        analysis.potential_flags = anomalies;

        // Determine content type
        analysis.content_type = self.determine_content_type(session_data);

        // Calculate confidence score
        analysis.confidence_score = self.calculate_overall_confidence(&analysis);

        // Use statistical analysis (ONNX models can be added later)
        self.enhance_with_statistical_analysis(&mut analysis, &keystrokes, &mouse_events);

        // Generate summary
        analysis.summary = self.generate_summary(&analysis, session_data);

        analysis.processing_time = start_time.elapsed().as_millis() as u64;

        Ok(analysis)
    }

    pub fn generate_summary(&self, analysis: &AIAnalysis, session_data: &SessionData) -> WorkSummary {
        let mut summary = WorkSummary::default();

        // Generate overview
        summary.overview = self.generate_overview_text(analysis, session_data);

        // Extract key activities
        summary.key_activities = self.extract_key_activities(analysis);

        // Calculate time breakdown
        summary.time_breakdown = self.calculate_time_breakdown(session_data);

        // Calculate productivity metrics
        summary.productivity = self.calculate_productivity_metrics(session_data);

        // Assess authenticity
        summary.authenticity = self.assess_authenticity(analysis);

        summary
    }

    fn enhance_with_statistical_analysis(&self, analysis: &mut AIAnalysis, keystrokes: &[KeystrokeEvent], mouse_events: &[MouseEvent]) {
        // Calculate basic statistics
        let typing_speed = self.calculate_typing_speed(keystrokes);
        let mouse_activity = self.calculate_mouse_activity(mouse_events);
        
        // Update confidence based on statistical analysis
        let statistical_confidence = self.calculate_statistical_confidence(typing_speed, mouse_activity);
        analysis.confidence_score = (analysis.confidence_score + statistical_confidence) / 2.0;
    }

    fn extract_keystrokes(&self, _session_data: &SessionData) -> Result<Vec<KeystrokeEvent>> {
        // This would extract keystroke events from the encrypted session data
        // For now, return empty vector as placeholder
        Ok(Vec::new())
    }

    fn extract_mouse_events(&self, _session_data: &SessionData) -> Result<Vec<MouseEvent>> {
        // This would extract mouse events from the encrypted session data
        // For now, return empty vector as placeholder
        Ok(Vec::new())
    }

    fn determine_content_type(&self, _session_data: &SessionData) -> ContentType {
        // Analyze the session data to determine content type
        // This is a simplified implementation
        ContentType::Mixed
    }

    fn calculate_overall_confidence(&self, analysis: &AIAnalysis) -> f32 {
        if analysis.work_patterns.is_empty() {
            return 0.0;
        }

        let pattern_confidence: f32 = analysis.work_patterns.iter()
            .map(|p| p.confidence)
            .sum::<f32>() / analysis.work_patterns.len() as f32;

        let anomaly_penalty = analysis.potential_flags.len() as f32 * 0.1;
        
        (pattern_confidence - anomaly_penalty).max(0.0).min(1.0)
    }

    fn calculate_typing_speed(&self, keystrokes: &[KeystrokeEvent]) -> f32 {
        if keystrokes.len() < 2 {
            return 0.0;
        }

        let total_time = keystrokes.last().unwrap().timestamp
            .signed_duration_since(keystrokes.first().unwrap().timestamp)
            .num_seconds() as f32;

        if total_time > 0.0 {
            (keystrokes.len() as f32 / total_time) * 60.0 // WPM approximation
        } else {
            0.0
        }
    }

    fn calculate_mouse_activity(&self, mouse_events: &[MouseEvent]) -> f32 {
        if mouse_events.len() < 2 {
            return 0.0;
        }

        let total_distance: f32 = mouse_events.windows(2)
            .map(|pair| {
                let dx = pair[1].x - pair[0].x;
                let dy = pair[1].y - pair[0].y;
                (dx * dx + dy * dy).sqrt()
            })
            .sum();

        total_distance
    }

    fn calculate_statistical_confidence(&self, typing_speed: f32, mouse_activity: f32) -> f32 {
        let speed_factor: f32 = if typing_speed > 20.0 && typing_speed < 120.0 { 1.0 } else { 0.7 };
        let activity_factor: f32 = if mouse_activity > 100.0 { 1.0 } else { 0.8 };
        
        (speed_factor * activity_factor).min(1.0)
    }

    fn generate_overview_text(&self, analysis: &AIAnalysis, session_data: &SessionData) -> String {
        let duration_minutes = session_data.duration / 60000; // Convert ms to minutes
        let pattern_count = analysis.work_patterns.len();
        let anomaly_count = analysis.potential_flags.len();

        format!(
            "Work session analyzed over {} minutes with {} behavioral patterns detected. \
            Confidence score: {:.1}%. {} potential anomalies identified.",
            duration_minutes,
            pattern_count,
            analysis.confidence_score * 100.0,
            anomaly_count
        )
    }

    fn extract_key_activities(&self, analysis: &AIAnalysis) -> Vec<String> {
        analysis.work_patterns.iter()
            .map(|pattern| pattern.description.clone())
            .collect()
    }

    fn calculate_time_breakdown(&self, session_data: &SessionData) -> Vec<crate::ai::analysis::TimeBreakdown> {
        // This would analyze the session data to break down time by activity
        // Placeholder implementation
        vec![
            crate::ai::analysis::TimeBreakdown {
                activity: "Active Work".to_string(),
                duration: session_data.duration * 80 / 100, // 80% active
                percentage: 80.0,
            },
            crate::ai::analysis::TimeBreakdown {
                activity: "Idle Time".to_string(),
                duration: session_data.duration * 20 / 100, // 20% idle
                percentage: 20.0,
            },
        ]
    }

    fn calculate_productivity_metrics(&self, session_data: &SessionData) -> ProductivityMetrics {
        ProductivityMetrics {
            active_time: session_data.duration * 80 / 100, // 80% active (placeholder)
            idle_time: session_data.duration * 20 / 100,   // 20% idle (placeholder)
            focus_score: 0.75, // Placeholder focus score
            task_switching: 5,  // Placeholder task switching count
        }
    }

    fn assess_authenticity(&self, analysis: &AIAnalysis) -> AuthenticityAssessment {
        let high_severity_flags = analysis.potential_flags.iter()
            .filter(|flag| matches!(flag.severity, crate::ai::analysis::Severity::High))
            .count();

        let human_likelihood = if high_severity_flags == 0 {
            0.9
        } else {
            0.9 - (high_severity_flags as f32 * 0.2)
        }.max(0.1);

        let consistency_score = analysis.confidence_score;
        let overall_score = (human_likelihood + consistency_score) / 2.0;

        let flags: Vec<String> = analysis.potential_flags.iter()
            .map(|flag| flag.description.clone())
            .collect();

        AuthenticityAssessment {
            overall_score,
            human_likelihood,
            consistency_score,
            flags,
        }
    }
}

impl Default for AIProcessor {
    fn default() -> Self {
        // This will panic if called, but we need it for the trait
        // In practice, always use AIProcessor::new().await
        panic!("Use AIProcessor::new().await instead of default()")
    }
}