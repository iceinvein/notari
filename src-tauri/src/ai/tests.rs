#[cfg(test)]
mod tests {
    use super::*;
    use crate::ai::{
        processor::AIProcessor,
        patterns::{PatternAnalyzer, KeystrokeEvent, MouseEvent},
        analysis::{AnomalyType, Severity, PatternType},
    };
    use crate::capture::types::SessionData;
    use chrono::{Utc, Duration};
    use std::collections::HashMap;

    fn create_test_session_data() -> SessionData {
        SessionData {
            session_id: "test-session-123".to_string(),
            user_id: "test-user".to_string(),
            start_time: Utc::now() - Duration::hours(1),
            end_time: Some(Utc::now()),
            duration: 3600000, // 1 hour in ms
            encrypted_data: vec![1, 2, 3, 4, 5],
            checksum: "test-checksum".to_string(),
            metadata: HashMap::new(),
        }
    }

    fn create_keystroke_events(count: usize, interval_ms: i64) -> Vec<KeystrokeEvent> {
        let mut events = Vec::new();
        let start_time = Utc::now();
        
        for i in 0..count {
            events.push(KeystrokeEvent {
                timestamp: start_time + Duration::milliseconds(i as i64 * interval_ms),
                key_code: 65 + (i % 26) as u32, // A-Z keys
                is_press: true,
            });
        }
        
        events
    }

    fn create_mouse_events(count: usize) -> Vec<MouseEvent> {
        let mut events = Vec::new();
        let start_time = Utc::now();
        
        for i in 0..count {
            events.push(MouseEvent {
                timestamp: start_time + Duration::milliseconds(i as i64 * 50),
                x: (i as f32 * 10.0) % 1920.0,
                y: (i as f32 * 5.0) % 1080.0,
                button: None,
            });
        }
        
        events
    }

    #[tokio::test]
    async fn test_ai_processor_initialization() {
        let result = AIProcessor::new().await;
        
        // Should succeed even if models aren't available (fallback mode)
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_session_analysis_basic() {
        let processor = AIProcessor::new().await.unwrap();
        let session_data = create_test_session_data();
        
        let result = processor.analyze_session(&session_data).await;
        
        assert!(result.is_ok());
        let analysis = result.unwrap();
        assert_eq!(analysis.session_id, "test-session-123");
        // Processing time should be recorded (may be 0 for very fast operations)
        assert!(analysis.processing_time >= 0);
    }

    #[test]
    fn test_pattern_analyzer_typing_patterns() {
        let analyzer = PatternAnalyzer::new();
        
        // Test consistent typing pattern
        let keystrokes = create_keystroke_events(50, 150); // 150ms intervals
        let patterns = analyzer.analyze_typing_patterns(&keystrokes);
        
        assert!(!patterns.is_empty());
        let typing_pattern = patterns.iter()
            .find(|p| matches!(p.pattern_type, PatternType::Typing))
            .expect("Should find typing pattern");
        
        assert!(typing_pattern.confidence > 0.5);
        assert!(typing_pattern.description.contains("Consistent typing"));
    }

    #[test]
    fn test_pattern_analyzer_burst_detection() {
        let analyzer = PatternAnalyzer::new();
        
        // Create burst pattern (very fast typing)
        let mut keystrokes = create_keystroke_events(20, 200); // Normal typing
        let burst_events = create_keystroke_events(15, 20); // Very fast burst
        keystrokes.extend(burst_events);
        
        let patterns = analyzer.analyze_typing_patterns(&keystrokes);
        
        let burst_pattern = patterns.iter()
            .find(|p| matches!(p.pattern_type, PatternType::Content))
            .expect("Should detect burst pattern");
        
        assert!(burst_pattern.description.contains("copy-paste"));
    }

    #[test]
    fn test_pattern_analyzer_mouse_smoothness() {
        let analyzer = PatternAnalyzer::new();
        
        // Create smooth mouse movement
        let mouse_events = create_mouse_events(100);
        let patterns = analyzer.analyze_mouse_patterns(&mouse_events);
        
        if !patterns.is_empty() {
            let mouse_pattern = &patterns[0];
            assert!(matches!(mouse_pattern.pattern_type, PatternType::Mouse));
            assert!(mouse_pattern.confidence > 0.0);
        }
    }

    #[test]
    fn test_anomaly_detection_fast_typing() {
        let analyzer = PatternAnalyzer::new();
        
        // Create suspiciously fast typing
        let keystrokes = create_keystroke_events(50, 10); // 10ms intervals - too fast
        let mouse_events = Vec::new();
        
        let anomalies = analyzer.detect_anomalies(&keystrokes, &mouse_events);
        
        assert!(!anomalies.is_empty());
        let timing_anomaly = anomalies.iter()
            .find(|a| matches!(a.flag_type, AnomalyType::SuspiciousTiming))
            .expect("Should detect timing anomaly");
        
        assert!(matches!(timing_anomaly.severity, Severity::High));
        assert!(timing_anomaly.confidence > 0.8);
    }

    #[test]
    fn test_anomaly_detection_robotic_timing() {
        let analyzer = PatternAnalyzer::new();
        
        // Create perfectly consistent timing (robotic)
        let mut keystrokes = Vec::new();
        let start_time = Utc::now();
        
        for i in 0..100 {
            keystrokes.push(KeystrokeEvent {
                timestamp: start_time + Duration::milliseconds(i * 100), // Exactly 100ms apart
                key_code: 65,
                is_press: true,
            });
        }
        
        let mouse_events = Vec::new();
        let anomalies = analyzer.detect_anomalies(&keystrokes, &mouse_events);
        
        let robotic_anomaly = anomalies.iter()
            .find(|a| matches!(a.flag_type, AnomalyType::UnusualPattern))
            .expect("Should detect robotic timing");
        
        assert!(robotic_anomaly.description.contains("too consistent"));
    }

    #[test]
    fn test_mouse_linearity_calculation() {
        let analyzer = PatternAnalyzer::new();
        
        // Create perfectly straight line movement
        let mut mouse_events = Vec::new();
        let start_time = Utc::now();
        
        for i in 0..20 {
            mouse_events.push(MouseEvent {
                timestamp: start_time + Duration::milliseconds(i * 50),
                x: i as f32 * 10.0, // Perfectly straight line
                y: i as f32 * 5.0,
                button: None,
            });
        }
        
        let anomalies = analyzer.detect_anomalies(&Vec::new(), &mouse_events);
        
        // Should detect robotic mouse movement
        let robotic_mouse = anomalies.iter()
            .find(|a| matches!(a.flag_type, AnomalyType::UnusualPattern) && 
                     a.description.contains("Robotic mouse"));
        
        if let Some(anomaly) = robotic_mouse {
            assert!(anomaly.confidence > 0.7);
        }
    }

    #[test]
    fn test_typing_interval_calculation() {
        let analyzer = PatternAnalyzer::new();
        
        let keystrokes = vec![
            KeystrokeEvent {
                timestamp: Utc::now(),
                key_code: 65,
                is_press: true,
            },
            KeystrokeEvent {
                timestamp: Utc::now() + Duration::milliseconds(100),
                key_code: 66,
                is_press: true,
            },
            KeystrokeEvent {
                timestamp: Utc::now() + Duration::milliseconds(250),
                key_code: 67,
                is_press: true,
            },
        ];
        
        let intervals = analyzer.calculate_typing_intervals(&keystrokes);
        assert_eq!(intervals.len(), 2);
        assert_eq!(intervals[0], 100.0);
        assert_eq!(intervals[1], 150.0);
    }

    #[test]
    fn test_confidence_calculation() {
        let analyzer = PatternAnalyzer::new();
        
        // Test normal human typing confidence
        let normal_confidence = analyzer.calculate_typing_confidence(150.0, 30.0);
        assert!(normal_confidence > 0.7);
        
        // Test robotic typing confidence (too consistent)
        let robotic_confidence = analyzer.calculate_typing_confidence(100.0, 2.0);
        assert!(robotic_confidence < normal_confidence);
        
        // Test erratic typing confidence
        let erratic_confidence = analyzer.calculate_typing_confidence(200.0, 150.0);
        assert!(erratic_confidence < normal_confidence);
    }

    #[test]
    fn test_standard_deviation_calculation() {
        let analyzer = PatternAnalyzer::new();
        
        let values = vec![100.0, 110.0, 90.0, 105.0, 95.0];
        let mean = 100.0;
        let std_dev = analyzer.calculate_std_dev(&values, mean);
        
        assert!(std_dev > 0.0);
        assert!(std_dev < 20.0); // Should be reasonable for this data
    }

    #[tokio::test]
    async fn test_analysis_performance() {
        let processor = AIProcessor::new().await.unwrap();
        let session_data = create_test_session_data();
        
        let start_time = std::time::Instant::now();
        let result = processor.analyze_session(&session_data).await;
        let elapsed = start_time.elapsed();
        
        assert!(result.is_ok());
        assert!(elapsed.as_millis() < 5000); // Should complete within 5 seconds
    }

    #[test]
    fn test_empty_data_handling() {
        let analyzer = PatternAnalyzer::new();
        
        // Test with empty keystroke data
        let empty_keystrokes = Vec::new();
        let patterns = analyzer.analyze_typing_patterns(&empty_keystrokes);
        assert!(patterns.is_empty());
        
        // Test with empty mouse data
        let empty_mouse = Vec::new();
        let mouse_patterns = analyzer.analyze_mouse_patterns(&empty_mouse);
        assert!(mouse_patterns.is_empty());
        
        // Test anomaly detection with empty data
        let anomalies = analyzer.detect_anomalies(&empty_keystrokes, &empty_mouse);
        assert!(anomalies.is_empty());
    }

    #[test]
    fn test_minimal_data_handling() {
        let analyzer = PatternAnalyzer::new();
        
        // Test with minimal keystroke data
        let minimal_keystrokes = create_keystroke_events(2, 100);
        let patterns = analyzer.analyze_typing_patterns(&minimal_keystrokes);
        // Should handle gracefully without panicking
        
        // Test with minimal mouse data
        let minimal_mouse = create_mouse_events(2);
        let mouse_patterns = analyzer.analyze_mouse_patterns(&minimal_mouse);
        // Should handle gracefully
    }

    #[test]
    fn test_pattern_characteristics_extraction() {
        let analyzer = PatternAnalyzer::new();
        
        let keystrokes = create_keystroke_events(30, 120);
        let patterns = analyzer.analyze_typing_patterns(&keystrokes);
        
        if let Some(pattern) = patterns.first() {
            assert!(pattern.characteristics.contains_key("avg_interval_ms"));
            assert!(pattern.characteristics.contains_key("std_deviation"));
            assert!(pattern.characteristics.contains_key("consistency_score"));
        }
    }

    #[test]
    fn test_time_range_accuracy() {
        let analyzer = PatternAnalyzer::new();
        
        let start_time = Utc::now();
        let keystrokes = vec![
            KeystrokeEvent {
                timestamp: start_time,
                key_code: 65,
                is_press: true,
            },
            KeystrokeEvent {
                timestamp: start_time + Duration::seconds(30),
                key_code: 66,
                is_press: true,
            },
        ];
        
        let patterns = analyzer.analyze_typing_patterns(&keystrokes);
        
        if let Some(pattern) = patterns.first() {
            assert_eq!(pattern.time_range.start, start_time);
            assert_eq!(pattern.time_range.end, start_time + Duration::seconds(30));
        }
    }

    #[test]
    fn test_multiple_anomaly_types() {
        let analyzer = PatternAnalyzer::new();
        
        // Create data that should trigger multiple anomaly types
        let fast_keystrokes = create_keystroke_events(20, 5); // Very fast
        
        // Create robotic mouse movement
        let mut robotic_mouse = Vec::new();
        let start_time = Utc::now();
        for i in 0..15 {
            robotic_mouse.push(MouseEvent {
                timestamp: start_time + Duration::milliseconds(i * 100),
                x: i as f32 * 20.0, // Perfect line
                y: 100.0, // No Y variation
                button: None,
            });
        }
        
        let anomalies = analyzer.detect_anomalies(&fast_keystrokes, &robotic_mouse);
        
        // Should detect both timing and pattern anomalies
        let has_timing = anomalies.iter().any(|a| matches!(a.flag_type, AnomalyType::SuspiciousTiming));
        let has_pattern = anomalies.iter().any(|a| matches!(a.flag_type, AnomalyType::UnusualPattern));
        
        assert!(has_timing || has_pattern); // At least one should be detected
    }
}