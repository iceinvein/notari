# Implementation Plan

- [x] 1. Set up Tauri tray infrastructure and permissions
  - Configure Tauri permissions for tray functionality in tauri.conf.json
  - Add required tray permissions: core:tray:allow-new, core:tray:allow-set-icon, core:tray:allow-set-tooltip, core:tray:allow-set-menu
  - Create tray icon assets in multiple sizes for cross-platform support
  - _Requirements: 1.1, 1.2_

- [x] 2. Implement core TrayManager in Rust backend
  - Create src-tauri/src/tray/mod.rs with TrayManager struct
  - Implement tray initialization, icon setting, and basic event handling
  - Add methods for updating tray icon based on session state (idle, recording, processing)
  - Write unit tests for TrayManager functionality
  - _Requirements: 1.1, 1.3, 3.3_

- [x] 3. Create PopoverManager for window positioning and lifecycle
  - Implement src-tauri/src/window/popover.rs with PopoverManager struct
  - Add window creation with proper size constraints (400x600px, frameless, always-on-top)
  - Implement tray-relative positioning calculation for cross-platform support
  - Create window event handlers for focus/blur and auto-hide behavior
  - Write unit tests for window positioning and lifecycle management
  - _Requirements: 1.4, 1.5, 2.1, 2.2_

- [x] 4. Set up global hotkey system
  - Create src-tauri/src/hotkey/mod.rs with HotkeyManager struct
  - Implement global hotkey registration for popover toggle (default Cmd/Ctrl+Shift+N)
  - Add configurable hotkey system with validation and conflict detection
  - Integrate hotkey events with PopoverManager to show/hide popover
  - Write unit tests for hotkey registration and event handling
  - _Requirements: 6.1, 6.2, 6.3_

- [x] 5. Create Tauri commands for tray and window operations
  - Implement src-tauri/src/commands/tray.rs with commands for show_popover, hide_popover, toggle_popover
  - Add commands for updating tray icon state and tooltip
  - Create commands for hotkey configuration and management
  - Add proper error handling and return types for all commands
  - Write integration tests for command functionality
  - _Requirements: 1.1, 1.3, 6.4_

- [x] 6. Implement compact UI router and navigation system
  - Create src/components/tray/TrayRouter.tsx with view stack management
  - Implement navigation methods: navigateTo, goBack, getCurrentView
  - Add view transition animations and state preservation
  - Create TypeScript interfaces for TrayView and navigation state
  - Write unit tests for router functionality and navigation logic
  - _Requirements: 2.4, 7.2, 7.4_

- [x] 7. Design and implement main tray dashboard component
  - Create src/components/tray/TrayDashboard.tsx as the primary popover view
  - Implement compact layout with session status, quick actions, and recent sessions
  - Add responsive design for 400px width constraint
  - Integrate with existing session state management
  - Write component tests for dashboard rendering and interactions
  - _Requirements: 2.1, 2.2, 2.3, 4.1_

- [x] 8. Create compact session controls component
  - Implement src/components/tray/SessionControls.tsx for start/stop session functionality
  - Add real-time session duration display and status indicators
  - Integrate with existing session management services
  - Implement session pause/resume functionality for tray interface
  - Write unit tests for session control interactions and state updates
  - _Requirements: 3.1, 3.2, 3.4, 6.2_

- [x] 9. Build recent sessions list component
  - Create src/components/tray/RecentSessionsList.tsx with scrollable session list
  - Implement session item expansion for details and quick actions
  - Add proof pack creation shortcuts from session items
  - Integrate with existing session storage and retrieval
  - Write component tests for list rendering and session interactions
  - _Requirements: 4.1, 4.2, 4.4_

- [x] 10. Implement system notification manager
  - Create src-tauri/src/notifications/mod.rs with NotificationManager struct
  - Add methods for displaying session start/stop, proof pack creation, and error notifications
  - Implement notification queuing and throttling to prevent spam
  - Add user preference controls for notification types and frequency
  - Write unit tests for notification display and management
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

- [x] 11. Create tray-specific proof pack manager
  - Implement src/components/tray/ProofPackManager.tsx for compact proof pack creation
  - Add quick proof pack generation from active or recent sessions
  - Implement simplified redaction interface optimized for small screen space
  - Add export and sharing options accessible from tray interface
  - Write component tests for proof pack creation workflow
  - _Requirements: 3.5, 4.3_

- [x] 12. Build settings and preferences panel
  - Create src/components/tray/TraySettings.tsx for configuration options
  - Implement theme selection (light/dark/system), hotkey configuration, and notification preferences
  - Add popover position and behavior settings
  - Integrate with existing settings storage and synchronization
  - Write component tests for settings persistence and validation
  - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

- [x] 13. Implement tray state management and synchronization
  - Create src/stores/trayStore.ts with Zustand or similar state management
  - Add state synchronization between tray UI and background services
  - Implement state persistence for popover position and user preferences
  - Add real-time updates for session status and recent sessions
  - Write unit tests for state management and synchronization logic
  - _Requirements: 7.1, 7.3, 8.1, 8.2_

- [ ] 14. Add keyboard navigation and accessibility
  - Implement keyboard shortcuts within popover (Tab navigation, number keys for session selection)
  - Add ARIA labels and accessibility attributes for screen readers
  - Implement focus management and keyboard-only navigation
  - Add escape key handling for popover dismissal
  - Write accessibility tests and keyboard navigation tests
  - _Requirements: 1.5, 6.4, 6.5_

- [x] 15. Create error handling and fallback systems
  - Implement graceful fallback to window interface when tray is unavailable
  - Add error boundaries for tray UI components with recovery options
  - Create user-friendly error messages for permission and initialization failures
  - Implement retry mechanisms for failed tray operations
  - Write error handling tests and fallback scenario tests
  - _Requirements: 10.1, 10.2, 10.3, 10.5_

- [x] 16. Optimize performance and resource usage
  - Implement lazy loading for tray UI components and reduce initial bundle size
  - Add debouncing for frequent tray updates and state changes
  - Optimize background service resource usage when popover is hidden
  - Implement efficient event handling to minimize CPU usage
  - Write performance tests and resource usage monitoring
  - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

- [x] 17. Add smooth animations and transitions
  - Implement popover show/hide animations with proper easing
  - Add view transition animations within the popover interface
  - Create loading states and progress indicators for async operations
  - Optimize animations for 60fps performance on all supported platforms
  - Write animation tests and performance validation
  - _Requirements: 2.5, 8.4_

- [x] 18. Integrate with existing application architecture
  - Update main application entry point to initialize tray instead of main window
  - Modify existing components to work within compact tray interface constraints
  - Ensure backward compatibility with existing session and proof pack data
  - Update application lifecycle to handle tray-based startup and shutdown
  - Write integration tests for tray and existing functionality interaction
  - _Requirements: 1.1, 1.2, 7.3_

- [x] 19. Implement cross-platform compatibility and testing
  - Test tray functionality on macOS (menu bar integration, notification center)
  - Test Windows system tray behavior and high DPI support
  - Validate popover positioning across multiple monitor configurations
  - Ensure consistent behavior across different operating system versions
  - Write platform-specific tests and compatibility validation
  - _Requirements: 1.1, 2.1, 8.3_

- [ ] 20. Add comprehensive logging and debugging support
  - Implement detailed logging for tray operations, window management, and user interactions
  - Add debug mode with additional tray information and diagnostics
  - Create development tools for testing tray behavior and popover positioning
  - Add telemetry for performance monitoring and error tracking
  - Write logging tests and debug mode validation
  - _Requirements: 10.4, 8.5_