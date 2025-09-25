#[cfg(test)]
mod tests {
    use crate::notifications::{
        format_duration, Notification, NotificationError, NotificationPreferences, 
        NotificationPriority, NotificationType, QueuedNotification
    };
    use std::time::Duration;


    fn create_test_notification() -> Notification {
        Notification {
            id: "test-id".to_string(),
            notification_type: NotificationType::SessionStart,
            title: "Test Title".to_string(),
            body: "Test Body".to_string(),
            priority: NotificationPriority::Normal,
            sound: Some("test.wav".to_string()),
            timestamp: chrono::Utc::now(),
            data: None,
        }
    }

    #[test]
    fn test_notification_preferences_default() {
        let prefs = NotificationPreferences::default();
        assert!(prefs.enabled_types.get(&NotificationType::SessionStart).unwrap_or(&false));
        assert!(prefs.enabled_types.get(&NotificationType::Error).unwrap_or(&false));
        assert!(!prefs.enabled_types.get(&NotificationType::Info).unwrap_or(&true));
        assert_eq!(prefs.throttle_duration_ms, 1000);
        assert_eq!(prefs.max_queue_size, 10);
        assert!(prefs.batch_similar);
        assert!(prefs.show_sounds);
    }

    #[test]
    fn test_format_duration() {
        assert_eq!(format_duration(Duration::from_secs(30)), "30s");
        assert_eq!(format_duration(Duration::from_secs(90)), "1m 30s");
        assert_eq!(format_duration(Duration::from_secs(3661)), "1h 1m 1s");
        assert_eq!(format_duration(Duration::from_secs(7200)), "2h 0m 0s");
        assert_eq!(format_duration(Duration::from_secs(0)), "0s");
        assert_eq!(format_duration(Duration::from_secs(3600)), "1h 0m 0s");
    }

    #[test]
    fn test_notification_creation() {
        let notification = create_test_notification();

        assert_eq!(notification.notification_type, NotificationType::SessionStart);
        assert_eq!(notification.title, "Test Title");
        assert_eq!(notification.body, "Test Body");
        assert_eq!(notification.priority, NotificationPriority::Normal);
        assert_eq!(notification.sound, Some("test.wav".to_string()));
        assert_eq!(notification.id, "test-id");
    }

    #[test]
    fn test_notification_priority_ordering() {
        assert!(NotificationPriority::Low < NotificationPriority::Normal);
        assert!(NotificationPriority::Normal < NotificationPriority::High);
        assert!(NotificationPriority::High < NotificationPriority::Critical);
        
        let mut priorities = vec![
            NotificationPriority::Critical,
            NotificationPriority::Low,
            NotificationPriority::High,
            NotificationPriority::Normal,
        ];
        priorities.sort();
        
        assert_eq!(priorities, vec![
            NotificationPriority::Low,
            NotificationPriority::Normal,
            NotificationPriority::High,
            NotificationPriority::Critical,
        ]);
    }

    #[test]
    fn test_notification_type_equality() {
        assert_eq!(NotificationType::SessionStart, NotificationType::SessionStart);
        assert_ne!(NotificationType::SessionStart, NotificationType::SessionStop);
        assert_ne!(NotificationType::Error, NotificationType::Warning);
    }

    // Note: Tests requiring NotificationManager are commented out because they need
    // a full Tauri app context which is complex to set up in unit tests.
    // These should be tested through integration tests instead.

    #[test]
    fn test_notification_error_types() {
        let error1 = NotificationError::PermissionDenied;
        let error2 = NotificationError::TypeDisabled(NotificationType::Info);
        let error3 = NotificationError::QueueFull;
        let error4 = NotificationError::InvalidData("test".to_string());
        let error5 = NotificationError::SystemError("test".to_string());
        
        // Test that errors can be formatted
        assert!(!format!("{}", error1).is_empty());
        assert!(!format!("{}", error2).is_empty());
        assert!(!format!("{}", error3).is_empty());
        assert!(!format!("{}", error4).is_empty());
        assert!(!format!("{}", error5).is_empty());
    }

    #[test]
    fn test_notification_serialization() {
        let notification = create_test_notification();
        
        // Test that notification can be serialized to JSON
        let json = serde_json::to_string(&notification).unwrap();
        assert!(!json.is_empty());
        
        // Test that it can be deserialized back
        let deserialized: Notification = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.id, notification.id);
        assert_eq!(deserialized.title, notification.title);
        assert_eq!(deserialized.notification_type, notification.notification_type);
    }

    #[test]
    fn test_preferences_serialization() {
        let prefs = NotificationPreferences::default();
        
        // Test that preferences can be serialized to JSON
        let json = serde_json::to_string(&prefs).unwrap();
        assert!(!json.is_empty());
        
        // Test that it can be deserialized back
        let deserialized: NotificationPreferences = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.throttle_duration_ms, prefs.throttle_duration_ms);
        assert_eq!(deserialized.max_queue_size, prefs.max_queue_size);
        assert_eq!(deserialized.show_sounds, prefs.show_sounds);
    }



    #[test]
    fn test_queued_notification_batching() {
        let notification1 = create_test_notification();
        let mut notification2 = create_test_notification();
        notification2.id = "test-id-2".to_string();
        
        let queued1 = QueuedNotification {
            notification: notification1,
            last_sent: None,
            count: 1,
        };
        
        let queued2 = QueuedNotification {
            notification: notification2,
            last_sent: None,
            count: 2,
        };
        
        // Test that queued notifications have the expected structure
        assert_eq!(queued1.count, 1);
        assert_eq!(queued2.count, 2);
        assert!(queued1.last_sent.is_none());
        assert!(queued2.last_sent.is_none());
    }
}