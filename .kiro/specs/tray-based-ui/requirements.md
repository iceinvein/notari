# Requirements Document

## Introduction

This specification outlines the transformation of Notari from a traditional desktop application with a main window shell to a system tray-based application with a compact popover interface. This change will make Notari less intrusive and more accessible as a background utility that users can quickly access when needed, similar to productivity tools like Alfred, Raycast, or system utilities.

The tray-based approach aligns better with Notari's core function as a work session monitoring and proof generation tool that should run unobtrusively in the background while users work in their primary applications.

## Requirements

### Requirement 1

**User Story:** As a user, I want Notari to run in the system tray so that it doesn't clutter my desktop with an always-visible window while still being easily accessible.

#### Acceptance Criteria

1. WHEN the application starts THEN Notari SHALL appear as an icon in the system tray
2. WHEN the application starts THEN Notari SHALL NOT display a main window by default
3. WHEN I click the tray icon THEN Notari SHALL display a compact popover interface
4. WHEN I click outside the popover THEN the popover SHALL close automatically
5. WHEN I press the Escape key while the popover is open THEN the popover SHALL close

### Requirement 2

**User Story:** As a user, I want a compact popover interface that provides quick access to essential functions without overwhelming me with too much information at once.

#### Acceptance Criteria

1. WHEN the popover opens THEN it SHALL display a maximum width of 400px and height of 600px
2. WHEN the popover opens THEN it SHALL show the current session status prominently
3. WHEN the popover opens THEN it SHALL provide quick action buttons for start/stop session, create proof pack, and view recent sessions
4. WHEN I need detailed functionality THEN the popover SHALL provide navigation to expanded views within the same popover
5. WHEN the popover content exceeds the viewport THEN it SHALL provide smooth scrolling

### Requirement 3

**User Story:** As a user, I want to control session recording directly from the tray interface so that I can quickly start and stop monitoring without opening a full application window.

#### Acceptance Criteria

1. WHEN no session is active THEN the tray popover SHALL display a prominent "Start Session" button
2. WHEN a session is active THEN the tray popover SHALL display session duration and a "Stop Session" button
3. WHEN a session is active THEN the tray icon SHALL change appearance to indicate recording status
4. WHEN I start a session from the tray THEN the popover SHALL show real-time session statistics
5. WHEN I stop a session THEN the popover SHALL immediately offer to create a proof pack

### Requirement 4

**User Story:** As a user, I want to access my recent sessions and proof packs from the tray interface so that I can quickly review or share my work without navigating through complex menus.

#### Acceptance Criteria

1. WHEN I open the tray popover THEN it SHALL display the 5 most recent sessions
2. WHEN I click on a recent session THEN it SHALL expand to show session details and available actions
3. WHEN I have existing proof packs THEN the popover SHALL provide quick access to view or export them
4. WHEN I need to access older sessions THEN the popover SHALL provide a "View All Sessions" option
5. WHEN I select "View All Sessions" THEN it SHALL open an expanded interface within the popover

### Requirement 5

**User Story:** As a user, I want the tray interface to provide system notifications and status updates so that I stay informed about Notari's activities without constantly checking the interface.

#### Acceptance Criteria

1. WHEN a session starts THEN Notari SHALL display a system notification confirming the start
2. WHEN a session stops THEN Notari SHALL display a system notification with session summary
3. WHEN a proof pack is successfully created THEN Notari SHALL display a success notification
4. WHEN an error occurs THEN Notari SHALL display an error notification with actionable information
5. WHEN blockchain anchoring completes THEN Notari SHALL display a notification with verification details

### Requirement 6

**User Story:** As a user, I want keyboard shortcuts to access Notari functions so that I can interact with the application efficiently without using the mouse.

#### Acceptance Criteria

1. WHEN I press a global hotkey (configurable, default Cmd/Ctrl+Shift+N) THEN the tray popover SHALL toggle open/closed
2. WHEN the popover is open AND I press Cmd/Ctrl+S THEN it SHALL start/stop the current session
3. WHEN the popover is open AND I press Cmd/Ctrl+P THEN it SHALL open the proof pack creation interface
4. WHEN the popover is open AND I press numbers 1-5 THEN it SHALL select the corresponding recent session
5. WHEN the popover is open AND I press Tab THEN it SHALL navigate between interactive elements

### Requirement 7

**User Story:** As a user, I want the tray interface to maintain context and state so that my workflow isn't interrupted when I close and reopen the popover.

#### Acceptance Criteria

1. WHEN I close the popover while creating a proof pack THEN my progress SHALL be saved
2. WHEN I reopen the popover THEN it SHALL return to the same view I was using
3. WHEN I have an active session THEN the session SHALL continue running when the popover is closed
4. WHEN I navigate between different views in the popover THEN the navigation history SHALL be maintained
5. WHEN I restart the application THEN it SHALL remember my preferred popover size and position

### Requirement 8

**User Story:** As a user, I want the tray interface to be responsive and performant so that it feels snappy and doesn't interfere with my primary work applications.

#### Acceptance Criteria

1. WHEN I click the tray icon THEN the popover SHALL appear within 100ms
2. WHEN I interact with popover elements THEN they SHALL respond within 50ms
3. WHEN the popover is open THEN it SHALL NOT impact the performance of other applications
4. WHEN switching between popover views THEN transitions SHALL be smooth and under 200ms
5. WHEN the application is running in the background THEN it SHALL use minimal system resources

### Requirement 9

**User Story:** As a user, I want to customize the tray interface appearance and behavior so that it fits my workflow and preferences.

#### Acceptance Criteria

1. WHEN I access settings THEN I SHALL be able to choose between light and dark themes for the popover
2. WHEN I access settings THEN I SHALL be able to configure the global hotkey combination
3. WHEN I access settings THEN I SHALL be able to set the default popover position (near tray icon or center screen)
4. WHEN I access settings THEN I SHALL be able to enable/disable system notifications
5. WHEN I access settings THEN I SHALL be able to configure which quick actions appear in the main popover view

### Requirement 10

**User Story:** As a user, I want the tray interface to gracefully handle edge cases and errors so that the application remains stable and usable even when problems occur.

#### Acceptance Criteria

1. WHEN the tray icon fails to load THEN Notari SHALL fall back to showing a minimal window interface
2. WHEN the popover fails to render THEN Notari SHALL display an error message and offer to restart
3. WHEN system permissions are insufficient THEN the tray interface SHALL clearly indicate what permissions are needed
4. WHEN the application loses focus unexpectedly THEN the popover SHALL close gracefully
5. WHEN multiple instances are attempted THEN the existing tray instance SHALL be brought to focus instead of creating duplicates