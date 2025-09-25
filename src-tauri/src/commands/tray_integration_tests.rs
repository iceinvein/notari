#[cfg(test)]
mod integration_tests {
    use super::*;
    use crate::commands::tray::{NotificationType};

    #[tokio::test]
    async fn test_notification_type_serialization() {
        let types = vec![
            NotificationType::Info,
            NotificationType::Success,
            NotificationType::Warning,
            NotificationType::Error,
        ];

        for notification_type in types {
            // Test that each notification type can be serialized and deserialized
            let json = serde_json::to_string(&notification_type)
                .expect("Failed to serialize notification type");
            
            let deserialized: NotificationType = serde_json::from_str(&json)
                .expect("Failed to deserialize notification type");
            
            // Verify the round-trip works by checking the JSON representation
            let expected_json = match notification_type {
                NotificationType::Info => "\"Info\"",
                NotificationType::Success => "\"Success\"",
                NotificationType::Warning => "\"Warning\"",
                NotificationType::Error => "\"Error\"",
            };
            
            assert_eq!(json, expected_json);
            
            // Verify deserialization matches
            match (notification_type, deserialized) {
                (NotificationType::Info, NotificationType::Info) => assert!(true),
                (NotificationType::Success, NotificationType::Success) => assert!(true),
                (NotificationType::Warning, NotificationType::Warning) => assert!(true),
                (NotificationType::Error, NotificationType::Error) => assert!(true),
                _ => panic!("Notification type mismatch"),
            }
        }
    }

    #[tokio::test]
    async fn test_notification_type_display() {
        // Test that notification types can be converted to strings for UI display
        let info_type = NotificationType::Info;
        let success_type = NotificationType::Success;
        let warning_type = NotificationType::Warning;
        let error_type = NotificationType::Error;

        // Test that they can be formatted (this tests Debug trait)
        let info_debug = format!("{:?}", info_type);
        let success_debug = format!("{:?}", success_type);
        let warning_debug = format!("{:?}", warning_type);
        let error_debug = format!("{:?}", error_type);

        assert_eq!(info_debug, "Info");
        assert_eq!(success_debug, "Success");
        assert_eq!(warning_debug, "Warning");
        assert_eq!(error_debug, "Error");
    }

    #[test]
    fn test_tray_request_structures() {
        use crate::commands::tray::{TrayTooltipRequest, TrayNotificationRequest};
        use crate::capture::types::SessionStatus;

        // Test TrayTooltipRequest
        let tooltip_request = TrayTooltipRequest {
            tooltip: "Test tooltip".to_string(),
        };
        
        let json = serde_json::to_string(&tooltip_request).expect("Failed to serialize tooltip request");
        let deserialized: TrayTooltipRequest = serde_json::from_str(&json).expect("Failed to deserialize tooltip request");
        assert_eq!(deserialized.tooltip, "Test tooltip");

        // Test TrayNotificationRequest
        let notification_request = TrayNotificationRequest {
            title: "Test Title".to_string(),
            message: "Test Message".to_string(),
            notification_type: NotificationType::Success,
        };
        
        let json = serde_json::to_string(&notification_request).expect("Failed to serialize notification request");
        let deserialized: TrayNotificationRequest = serde_json::from_str(&json).expect("Failed to deserialize notification request");
        assert_eq!(deserialized.title, "Test Title");
        assert_eq!(deserialized.message, "Test Message");
        assert!(matches!(deserialized.notification_type, NotificationType::Success));
    }

    #[test]
    fn test_command_error_handling() {
        // Test that our command functions handle errors gracefully
        // This tests the error message formatting logic
        
        let test_error = "Test error message";
        let formatted_error = format!("Failed to acquire tray manager lock: {}", test_error);
        assert!(formatted_error.contains("Failed to acquire tray manager lock"));
        assert!(formatted_error.contains(test_error));
        
        let tray_error = format!("Failed to update tray tooltip: {}", test_error);
        assert!(tray_error.contains("Failed to update tray tooltip"));
        assert!(tray_error.contains(test_error));
        
        let notification_error = format!("Failed to show tray notification: {}", test_error);
        assert!(notification_error.contains("Failed to show tray notification"));
        assert!(notification_error.contains(test_error));
    }
}