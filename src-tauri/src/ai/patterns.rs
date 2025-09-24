use crate::ai::analysis::{
    AnomalyFlag, AnomalyType, PatternType, Severity, TimeRange, WorkPattern,
};
use chrono::{DateTime, Duration, Utc};
use serde_json::Value;
use std::collections::HashMap;

pub struct PatternAnalyzer {
    typing_threshold: f32,
    mouse_threshold: f32,
    anomaly_threshold: f32,
}

impl PatternAnalyzer {
    pub fn new() -> Self {
        Self {
            typing_threshold: 0.7,
            mouse_threshold: 0.6,
            anomaly_threshold: 0.8,
        }
    }

    pub fn analyze_typing_patterns(&self, keystrokes: &[KeystrokeEvent]) -> Vec<WorkPattern> {
        let mut patterns = Vec::new();

        if keystrokes.is_empty() {
            return patterns;
        }

        // Analyze typing rhythm and speed
        let typing_intervals = self.calculate_typing_intervals(keystrokes);
        let avg_interval = typing_intervals.iter().sum::<f64>() / typing_intervals.len() as f64;
        let std_dev = self.calculate_std_dev(&typing_intervals, avg_interval);

        // Detect consistent typing patterns
        if std_dev < 50.0 && avg_interval > 50.0 && avg_interval < 300.0 {
            let mut characteristics = HashMap::new();
            characteristics.insert("avg_interval_ms".to_string(), Value::from(avg_interval));
            characteristics.insert("std_deviation".to_string(), Value::from(std_dev));
            characteristics.insert(
                "consistency_score".to_string(),
                Value::from(1.0 - (std_dev / avg_interval).min(1.0)),
            );

            patterns.push(WorkPattern {
                pattern_type: PatternType::Typing,
                confidence: self.calculate_typing_confidence(avg_interval, std_dev),
                time_range: TimeRange {
                    start: keystrokes.first().unwrap().timestamp,
                    end: keystrokes.last().unwrap().timestamp,
                },
                characteristics,
                description: format!(
                    "Consistent typing pattern detected with {}ms average interval",
                    avg_interval as u32
                ),
            });
        }

        // Detect burst typing (copy-paste indicators)
        let bursts = self.detect_typing_bursts(keystrokes);
        for burst in bursts {
            let mut characteristics = HashMap::new();
            characteristics.insert("burst_length".to_string(), Value::from(burst.length));
            characteristics.insert("burst_speed".to_string(), Value::from(burst.speed));

            patterns.push(WorkPattern {
                pattern_type: PatternType::Content,
                confidence: burst.confidence,
                time_range: burst.time_range,
                characteristics,
                description: format!(
                    "Potential copy-paste burst detected: {} characters in {}ms",
                    burst.length, burst.duration
                ),
            });
        }

        patterns
    }

    pub fn analyze_mouse_patterns(&self, mouse_events: &[MouseEvent]) -> Vec<WorkPattern> {
        let mut patterns = Vec::new();

        if mouse_events.is_empty() {
            return patterns;
        }

        // Analyze mouse movement smoothness
        let smoothness = self.calculate_mouse_smoothness(mouse_events);
        if smoothness > self.mouse_threshold {
            let mut characteristics = HashMap::new();
            characteristics.insert("smoothness_score".to_string(), Value::from(smoothness));
            characteristics.insert(
                "total_distance".to_string(),
                Value::from(self.calculate_total_distance(mouse_events)),
            );

            patterns.push(WorkPattern {
                pattern_type: PatternType::Mouse,
                confidence: smoothness,
                time_range: TimeRange {
                    start: mouse_events.first().unwrap().timestamp,
                    end: mouse_events.last().unwrap().timestamp,
                },
                characteristics,
                description: "Natural mouse movement pattern detected".to_string(),
            });
        }

        patterns
    }

    pub fn detect_anomalies(
        &self,
        keystrokes: &[KeystrokeEvent],
        mouse_events: &[MouseEvent],
    ) -> Vec<AnomalyFlag> {
        let mut anomalies = Vec::new();

        // Detect suspiciously fast typing
        let fast_typing = self.detect_fast_typing(keystrokes);
        anomalies.extend(fast_typing);

        // Detect robotic mouse movements
        let robotic_mouse = self.detect_robotic_mouse(mouse_events);
        anomalies.extend(robotic_mouse);

        // Detect unusual timing patterns
        let timing_anomalies = self.detect_timing_anomalies(keystrokes);
        anomalies.extend(timing_anomalies);

        anomalies
    }

    pub fn calculate_typing_intervals(&self, keystrokes: &[KeystrokeEvent]) -> Vec<f64> {
        keystrokes
            .windows(2)
            .map(|pair| {
                let duration = pair[1].timestamp.signed_duration_since(pair[0].timestamp);
                duration.num_milliseconds() as f64
            })
            .collect()
    }

    pub fn calculate_std_dev(&self, values: &[f64], mean: f64) -> f64 {
        let variance = values.iter().map(|x| (x - mean).powi(2)).sum::<f64>() / values.len() as f64;
        variance.sqrt()
    }

    pub fn calculate_typing_confidence(&self, avg_interval: f64, std_dev: f64) -> f32 {
        let consistency = 1.0 - (std_dev / avg_interval).min(1.0);
        let speed_factor = if avg_interval > 100.0 && avg_interval < 200.0 {
            1.0
        } else {
            0.8
        };
        (consistency * speed_factor) as f32
    }

    fn detect_typing_bursts(&self, keystrokes: &[KeystrokeEvent]) -> Vec<TypingBurst> {
        let mut bursts = Vec::new();
        let mut current_burst: Option<TypingBurst> = None;

        for window in keystrokes.windows(5) {
            let intervals: Vec<f64> = window
                .windows(2)
                .map(|pair| {
                    pair[1]
                        .timestamp
                        .signed_duration_since(pair[0].timestamp)
                        .num_milliseconds() as f64
                })
                .collect();

            let avg_interval = intervals.iter().sum::<f64>() / intervals.len() as f64;

            // Detect burst (very fast typing)
            if avg_interval < 30.0 {
                match &mut current_burst {
                    Some(burst) => {
                        burst.end = window.last().unwrap().timestamp;
                        burst.length += 1;
                    }
                    None => {
                        current_burst = Some(TypingBurst {
                            start: window.first().unwrap().timestamp,
                            end: window.last().unwrap().timestamp,
                            length: window.len(),
                            speed: avg_interval,
                            confidence: 0.9,
                            duration: 0,
                            time_range: TimeRange {
                                start: window.first().unwrap().timestamp,
                                end: window.last().unwrap().timestamp,
                            },
                        });
                    }
                }
            } else if let Some(burst) = current_burst.take() {
                if burst.length > 10 {
                    bursts.push(burst);
                }
            }
        }

        if let Some(burst) = current_burst {
            if burst.length > 10 {
                bursts.push(burst);
            }
        }

        bursts
            .into_iter()
            .map(|mut burst| {
                burst.duration = burst
                    .end
                    .signed_duration_since(burst.start)
                    .num_milliseconds() as u64;
                burst.time_range = TimeRange {
                    start: burst.start,
                    end: burst.end,
                };
                burst
            })
            .collect()
    }

    fn calculate_mouse_smoothness(&self, mouse_events: &[MouseEvent]) -> f32 {
        if mouse_events.len() < 3 {
            return 0.0;
        }

        let mut direction_changes = 0;
        let mut total_movements = 0;

        for window in mouse_events.windows(3) {
            let dx1 = window[1].x - window[0].x;
            let dy1 = window[1].y - window[0].y;
            let dx2 = window[2].x - window[1].x;
            let dy2 = window[2].y - window[1].y;

            // Calculate angle change
            let dot_product = dx1 * dx2 + dy1 * dy2;
            let magnitude1 = (dx1 * dx1 + dy1 * dy1).sqrt();
            let magnitude2 = (dx2 * dx2 + dy2 * dy2).sqrt();

            if magnitude1 > 0.0 && magnitude2 > 0.0 {
                let cos_angle = dot_product / (magnitude1 * magnitude2);
                if cos_angle < 0.5 {
                    // Significant direction change
                    direction_changes += 1;
                }
                total_movements += 1;
            }
        }

        if total_movements == 0 {
            return 0.0;
        }

        1.0 - (direction_changes as f32 / total_movements as f32)
    }

    fn calculate_total_distance(&self, mouse_events: &[MouseEvent]) -> f32 {
        mouse_events
            .windows(2)
            .map(|pair| {
                let dx = pair[1].x - pair[0].x;
                let dy = pair[1].y - pair[0].y;
                (dx * dx + dy * dy).sqrt()
            })
            .sum()
    }

    fn detect_fast_typing(&self, keystrokes: &[KeystrokeEvent]) -> Vec<AnomalyFlag> {
        let mut anomalies = Vec::new();

        if keystrokes.len() < 10 {
            return anomalies;
        }

        for window in keystrokes.windows(10) {
            let intervals: Vec<f64> = window
                .windows(2)
                .map(|pair| {
                    pair[1]
                        .timestamp
                        .signed_duration_since(pair[0].timestamp)
                        .num_milliseconds() as f64
                })
                .collect();

            let avg_interval = intervals.iter().sum::<f64>() / intervals.len() as f64;

            // Suspiciously fast typing (< 20ms average)
            if avg_interval < 20.0 {
                anomalies.push(AnomalyFlag {
                    flag_type: AnomalyType::SuspiciousTiming,
                    severity: Severity::High,
                    evidence: vec![
                        format!("Average typing interval: {:.1}ms", avg_interval),
                        "Typing speed exceeds human capabilities".to_string(),
                    ],
                    confidence: 0.95,
                    time_range: TimeRange {
                        start: window.first().unwrap().timestamp,
                        end: window.last().unwrap().timestamp,
                    },
                    description: "Suspiciously fast typing detected - possible automated input"
                        .to_string(),
                });
            }
        }

        anomalies
    }

    fn detect_robotic_mouse(&self, mouse_events: &[MouseEvent]) -> Vec<AnomalyFlag> {
        let mut anomalies = Vec::new();

        if mouse_events.len() < 20 {
            return anomalies;
        }

        // Detect perfectly straight lines (robotic movement)
        for window in mouse_events.windows(10) {
            let linearity = self.calculate_linearity(window);
            if linearity > 0.99 {
                anomalies.push(AnomalyFlag {
                    flag_type: AnomalyType::UnusualPattern,
                    severity: Severity::Medium,
                    evidence: vec![
                        format!("Movement linearity: {:.3}", linearity),
                        "Mouse movement too perfect for human behavior".to_string(),
                    ],
                    confidence: 0.8,
                    time_range: TimeRange {
                        start: window.first().unwrap().timestamp,
                        end: window.last().unwrap().timestamp,
                    },
                    description: "Robotic mouse movement pattern detected".to_string(),
                });
            }
        }

        anomalies
    }

    fn detect_timing_anomalies(&self, keystrokes: &[KeystrokeEvent]) -> Vec<AnomalyFlag> {
        let mut anomalies = Vec::new();

        if keystrokes.len() < 50 {
            return anomalies;
        }

        let intervals: Vec<f64> = keystrokes
            .windows(2)
            .map(|pair| {
                pair[1]
                    .timestamp
                    .signed_duration_since(pair[0].timestamp)
                    .num_milliseconds() as f64
            })
            .collect();

        // Detect too-perfect timing (robotic)
        let std_dev = self.calculate_std_dev(
            &intervals,
            intervals.iter().sum::<f64>() / intervals.len() as f64,
        );
        if std_dev < 5.0 {
            anomalies.push(AnomalyFlag {
                flag_type: AnomalyType::UnusualPattern,
                severity: Severity::High,
                evidence: vec![
                    format!("Timing standard deviation: {:.2}ms", std_dev),
                    "Timing too consistent for human behavior".to_string(),
                ],
                confidence: 0.9,
                time_range: TimeRange {
                    start: keystrokes.first().unwrap().timestamp,
                    end: keystrokes.last().unwrap().timestamp,
                },
                description: "Robotic timing pattern detected - too consistent for human input"
                    .to_string(),
            });
        }

        anomalies
    }

    fn calculate_linearity(&self, points: &[MouseEvent]) -> f32 {
        if points.len() < 3 {
            return 0.0;
        }

        let start = &points[0];
        let end = &points[points.len() - 1];

        let expected_dx = (end.x - start.x) / (points.len() - 1) as f32;
        let expected_dy = (end.y - start.y) / (points.len() - 1) as f32;

        let mut total_deviation = 0.0;
        for (i, point) in points.iter().enumerate() {
            let expected_x = start.x + expected_dx * i as f32;
            let expected_y = start.y + expected_dy * i as f32;

            let deviation =
                ((point.x - expected_x).powi(2) + (point.y - expected_y).powi(2)).sqrt();
            total_deviation += deviation;
        }

        let max_distance = ((end.x - start.x).powi(2) + (end.y - start.y).powi(2)).sqrt();
        if max_distance == 0.0 {
            return 1.0;
        }

        1.0 - (total_deviation / (max_distance * points.len() as f32)).min(1.0)
    }
}

impl Default for PatternAnalyzer {
    fn default() -> Self {
        Self::new()
    }
}

#[derive(Debug, Clone)]
pub struct KeystrokeEvent {
    pub timestamp: DateTime<Utc>,
    pub key_code: u32,
    pub is_press: bool,
}

#[derive(Debug, Clone)]
pub struct MouseEvent {
    pub timestamp: DateTime<Utc>,
    pub x: f32,
    pub y: f32,
    pub button: Option<u8>,
}

#[derive(Debug, Clone)]
struct TypingBurst {
    start: DateTime<Utc>,
    end: DateTime<Utc>,
    length: usize,
    speed: f64,
    confidence: f32,
    duration: u64,
    time_range: TimeRange,
}
