use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelConfig {
    pub model_path: String,
    pub model_type: ModelType,
    pub input_shape: Vec<usize>,
    pub output_shape: Vec<usize>,
    pub confidence_threshold: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
pub enum ModelType {
    TextAnalysis,
    ImageAnalysis,
    BehaviorAnalysis,
    AnomalyDetection,
    Summarization,
}

#[derive(Debug, Clone)]
pub struct ModelRegistry {
    models: HashMap<ModelType, ModelConfig>,
}

impl ModelRegistry {
    pub fn new() -> Self {
        Self {
            models: HashMap::new(),
        }
    }

    pub fn register_model(&mut self, model_type: ModelType, config: ModelConfig) {
        self.models.insert(model_type, config);
    }

    pub fn get_model(&self, model_type: &ModelType) -> Option<&ModelConfig> {
        self.models.get(model_type)
    }

    pub fn get_all_models(&self) -> &HashMap<ModelType, ModelConfig> {
        &self.models
    }

    pub fn load_default_models(&mut self) {
        // Register default lightweight models for local inference
        self.register_model(
            ModelType::TextAnalysis,
            ModelConfig {
                model_path: "models/text_analysis.onnx".to_string(),
                model_type: ModelType::TextAnalysis,
                input_shape: vec![1, 512],
                output_shape: vec![1, 768],
                confidence_threshold: 0.7,
            },
        );

        self.register_model(
            ModelType::BehaviorAnalysis,
            ModelConfig {
                model_path: "models/behavior_analysis.onnx".to_string(),
                model_type: ModelType::BehaviorAnalysis,
                input_shape: vec![1, 100],
                output_shape: vec![1, 10],
                confidence_threshold: 0.6,
            },
        );

        self.register_model(
            ModelType::AnomalyDetection,
            ModelConfig {
                model_path: "models/anomaly_detection.onnx".to_string(),
                model_type: ModelType::AnomalyDetection,
                input_shape: vec![1, 50],
                output_shape: vec![1, 1],
                confidence_threshold: 0.8,
            },
        );
    }
}

impl Default for ModelRegistry {
    fn default() -> Self {
        let mut registry = Self::new();
        registry.load_default_models();
        registry
    }
}