# Notari Architecture Overview

## System Architecture

Notari is a desktop application for creating tamper-evident screen recordings with cryptographic verification.

**Platform Support**: Currently macOS only (12.3+). The encryption, verification, and proof pack systems are cross-platform ready. Windows and Linux recording implementations are planned.

```
┌─────────────────────────────────────────────────────────────────┐
│                         Frontend (React)                        │
│  - Window picker UI                                             │
│  - Recording controls                                           │
│  - Video player with decryption                                 │
│  - Recordings library                                           │
│  - Verification UI                                              │
└─────────────────────────────────────────────────────────────────┘
                              ↓ Tauri IPC
┌─────────────────────────────────────────────────────────────────┐
│                      Backend (Rust/Tauri)                       │
│  - Window listing (CoreGraphics)                                │
│  - Recording manager                                            │
│  - Evidence system (encryption, signatures, hashing)            │
│  - Video server (HTTP streaming)                                │
│  - Proof pack management                                        │
└─────────────────────────────────────────────────────────────────┘
                              ↓ Process spawn
┌─────────────────────────────────────────────────────────────────┐
│                    Swift Sidecar (sck-recorder)                 │
│  - ScreenCaptureKit integration                                 │
│  - H.264 encoding (AVAssetWriter)                               │
│  - Frame capture and processing                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Core Components

### 1. Recording System

**Purpose**: Capture individual windows on macOS using ScreenCaptureKit

**Key Files**:
- `src-tauri/src/recording_manager/macos.rs` - Recording orchestration
- `src-tauri/src/recording_commands.rs` - Tauri commands
- `src-tauri/sidecar/SCKRecorder.swift` - ScreenCaptureKit sidecar
- `src/components/WindowPicker.tsx` - Window selection UI

**Flow**:
1. User selects window from picker
2. Backend spawns Swift sidecar with window ID
3. Sidecar captures frames and encodes to .mov
4. Backend monitors process and logs
5. On stop, sidecar finishes writing and exits

**Documentation**: [docs/recording.md](recording.md)

### 2. Evidence System

**Purpose**: Create cryptographically verifiable proof packs

**Key Files**:
- `src-tauri/src/evidence/encryption.rs` - AES-256-GCM encryption
- `src-tauri/src/evidence/manifest.rs` - Evidence manifest structures
- `src-tauri/src/evidence/signature.rs` - Ed25519 signatures
- `src-tauri/src/evidence/hash.rs` - SHA-256 hashing
- `src-tauri/src/evidence/proof_pack.rs` - .notari file packaging

**Components**:
- **Encryption**: AES-256-GCM with 1MB chunks, PBKDF2 key derivation
- **Signatures**: Ed25519 digital signatures for authenticity
- **Hashing**: SHA-256 of plaintext and ciphertext
- **Manifest**: JSON with all metadata, signatures, hashes
- **Proof Pack**: ZIP archive (.notari) with video, manifest, keys

**Documentation**: [docs/encryption.md](encryption.md)

### 3. Video Playback

**Purpose**: Stream encrypted videos without full decryption to disk

**Key Files**:
- `src-tauri/src/video_server.rs` - HTTP server for streaming
- `src-tauri/src/recording_commands.rs` - Playback commands
- `src/components/VideoPlayer.tsx` - React video player

**Flow**:
1. User clicks play on encrypted recording
2. Backend extracts .notari to temp directory
3. Video server starts on random port
4. Frontend fetches video in 1MB chunks
5. Backend decrypts chunks on-demand
6. Frontend creates Blob URL and plays
7. Cleanup on stop: delete temp files, remove stream

**Documentation**: [docs/encryption.md](encryption.md#video-playback)

### 4. Recordings Library

**Purpose**: Browse, play, verify, and manage recordings

**Key Files**:
- `src/components/RecordingsLibrary.tsx` - Main library UI
- `src/components/RecordingCard.tsx` - Individual recording card
- `src/components/VerificationModal.tsx` - Verification UI
- `src-tauri/src/recording_commands.rs` - File operations

**Features**:
- Grid view of recordings with thumbnails
- Play encrypted videos with password
- Verify signatures and hashes
- Export to different formats
- Delete recordings
- View metadata (title, description, tags)

### 5. Settings & Preferences

**Purpose**: Configure app behavior and view logs

**Key Files**:
- `src/components/SettingsModal.tsx` - Settings UI
- `src-tauri/src/preferences.rs` - Preferences storage
- `src-tauri/src/logger.rs` - Logging system

**Settings**:
- Save folder location
- Default encryption toggle
- Theme (light/dark/system)
- Dev/logging tab for debugging

## Data Flow

### Recording Creation

```
User selects window
    ↓
start_window_recording(window_id, password?, metadata?)
    ↓
Spawn sck-recorder sidecar
    ↓
Capture frames → Encode to .mov
    ↓
stop_window_recording()
    ↓
Encrypt video (if password provided)
    ↓
Generate evidence manifest
    ↓
Create .notari proof pack
    ↓
Update recordings library
```

### Video Playback

```
User clicks play
    ↓
Password prompt (if encrypted)
    ↓
start_video_playback(path, password)
    ↓
Extract .notari to temp dir
    ↓
Start video server
    ↓
Frontend: fetch chunks via get_video_chunk()
    ↓
Backend: decrypt chunks on-demand
    ↓
Frontend: create Blob URL
    ↓
Play via <video> element
    ↓
stop_video_playback()
    ↓
Cleanup temp files
```

### Verification

```
User clicks verify
    ↓
Extract .notari file
    ↓
Load evidence manifest
    ↓
Verify Ed25519 signature
    ↓
Calculate SHA-256 hashes
    ↓
Compare with manifest
    ↓
Check encryption integrity
    ↓
Display results
```

## File Formats

### .notari Proof Pack

ZIP archive containing:

```
recording.notari
├── evidence/
│   ├── recording.mov.enc      # Encrypted video (or .mov if not encrypted)
│   ├── recording.mov.json     # Evidence manifest
│   └── public_key.txt         # Ed25519 public key
├── metadata.json              # Proof pack metadata
└── README.txt                 # Human-readable documentation
```

### Evidence Manifest

JSON structure:

```json
{
  "version": "1.0",
  "recording": {
    "session_id": "uuid",
    "started_at": "ISO8601",
    "ended_at": "ISO8601",
    "duration_seconds": 123.45,
    "encrypted": true,
    "encryption": { /* encryption metadata */ }
  },
  "metadata": {
    "window": { /* window info */ },
    "video": { /* video info */ },
    "custom": { /* title, description, tags */ }
  },
  "hash": {
    "algorithm": "SHA-256",
    "plaintext_hash": "hex",
    "ciphertext_hash": "hex"
  },
  "signature": {
    "algorithm": "Ed25519",
    "signature": "base64",
    "public_key": "base64"
  },
  "system": {
    "os": "macOS",
    "os_version": "14.0",
    "device_id": "uuid",
    "app_version": "0.1.0"
  }
}
```

## Security Model

### Threat Model

**Protected Against**:
- Tampering with video content (detected via hash mismatch)
- Forging evidence (detected via signature verification)
- Unauthorized access to encrypted videos (requires password)
- Replay attacks (unique session IDs and timestamps)

**Not Protected Against**:
- Screen recording malware (OS-level threat)
- Compromised device (attacker has full access)
- Social engineering (user shares password)
- Quantum computers (Ed25519 and AES-256 are quantum-vulnerable)

### Cryptographic Primitives

| Component | Algorithm | Key Size | Notes |
|-----------|-----------|----------|-------|
| Encryption | AES-256-GCM | 256 bits | Authenticated encryption |
| Key Derivation | PBKDF2-HMAC-SHA256 | 256 bits | 600,000 iterations |
| Signatures | Ed25519 | 256 bits | Elliptic curve |
| Hashing | SHA-256 | 256 bits | Collision-resistant |

### Password Requirements

- Minimum 8 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one number

## Performance Characteristics

### Recording

- **Frame rate**: 30 FPS (configurable in sidecar)
- **Encoding**: H.264 with hardware acceleration
- **Overhead**: ~5-10% CPU usage during recording
- **File size**: ~1-2 MB per minute (depends on content)

### Encryption

- **Speed**: ~100-200ms for 10MB video
- **Bottleneck**: PBKDF2 key derivation (~100ms)
- **Memory**: Processes 1MB chunks at a time
- **Overhead**: +16 bytes per 1MB chunk (AES-GCM tag)

### Playback

- **Startup**: ~200-300ms (extraction + key derivation)
- **Decryption**: ~5-10ms per 1MB chunk
- **Memory**: Entire video loaded into memory as Blob
- **Seeking**: Instant (Blob URL in memory)

## Development Workflow

### Prerequisites

- Node.js 22+ (LTS) and pnpm 10+
- Rust toolchain (stable)
- macOS 12.3+ for ScreenCaptureKit
- Xcode Command Line Tools
- Apple Developer Account (for code signing)

**See [docs/SETUP.md](SETUP.md) for detailed setup instructions including code signing and permissions.**

### Commands

```bash
# Install dependencies
pnpm install

# Development mode (hot reload)
pnpm tauri dev

# Build for production
pnpm tauri build

# Run tests
cargo test

# Format code
cargo fmt
pnpm format
```

### Project Structure

```
notari/
├── src/                      # Frontend (React/TypeScript)
│   ├── components/           # React components
│   ├── hooks/                # Custom hooks
│   ├── lib/                  # Utilities
│   └── main.tsx              # Entry point
├── src-tauri/                # Backend (Rust)
│   ├── src/
│   │   ├── evidence/         # Encryption, signatures, manifests
│   │   ├── recording_manager/# Recording orchestration
│   │   ├── recording_commands.rs
│   │   ├── video_server.rs
│   │   ├── preferences.rs
│   │   └── lib.rs            # Main entry point
│   ├── sidecar/              # Swift sidecar
│   │   └── SCKRecorder.swift
│   └── tauri.conf.json       # Tauri configuration
├── docs/                     # Documentation
│   ├── recording.md
│   ├── encryption.md
│   ├── ARCHITECTURE.md
│   └── dev/                  # Developer guides
└── README.md
```

## Documentation Index

- **[README.md](../README.md)** - Project overview and quick start
- **[docs/recording.md](recording.md)** - Recording system details
- **[docs/encryption.md](encryption.md)** - Encryption and playback
- **[docs/ARCHITECTURE.md](ARCHITECTURE.md)** - This document
- **[docs/dev/encryption-implementation.md](dev/encryption-implementation.md)** - Implementation guide
- **[docs/dev/encryption-quick-reference.md](dev/encryption-quick-reference.md)** - Quick reference

## Platform Roadmap

### Current Status (macOS)

| Component | Status | Notes |
|-----------|--------|-------|
| Screen Recording | ✅ Complete | ScreenCaptureKit-based |
| Encryption | ✅ Complete | Cross-platform ready |
| Signatures | ✅ Complete | Cross-platform ready |
| Proof Packs | ✅ Complete | Cross-platform ready |
| Video Playback | ✅ Complete | Cross-platform ready |
| Verification | ✅ Complete | Cross-platform ready |

### Windows Support (Planned)

**Recording Options**:
1. **Windows.Graphics.Capture API** (Windows 10 1803+)
   - Modern, permission-based capture
   - Similar to ScreenCaptureKit
   - Requires Windows Runtime (WinRT) bindings

2. **Desktop Duplication API** (Windows 8+)
   - Lower-level, more complex
   - Better performance
   - Requires more permissions

**Implementation Plan**:
- Create `recording_manager/windows.rs`
- Implement window listing via Win32 API
- Use Windows.Graphics.Capture for recording
- Reuse existing encryption/verification systems

### Linux Support (Planned)

**Recording Options**:
1. **PipeWire** (Modern, Wayland-compatible)
   - Portal-based screen capture
   - Works with Wayland and X11
   - Permission dialogs built-in

2. **X11 Screen Capture** (Legacy)
   - Direct X11 API access
   - No Wayland support
   - Simpler but less secure

**Implementation Plan**:
- Create `recording_manager/linux.rs`
- Implement window listing via X11/Wayland protocols
- Use PipeWire for recording (with X11 fallback)
- Reuse existing encryption/verification systems

### Cross-Platform Architecture

The evidence system (encryption, signatures, hashing, proof packs) is already cross-platform:

```rust
// Platform-specific recording
#[cfg(target_os = "macos")]
mod recording_manager::macos;

#[cfg(target_os = "windows")]
mod recording_manager::windows;  // TODO

#[cfg(target_os = "linux")]
mod recording_manager::linux;    // TODO

// Cross-platform evidence system
mod evidence::encryption;   // ✅ Works everywhere
mod evidence::signature;    // ✅ Works everywhere
mod evidence::hash;         // ✅ Works everywhere
mod evidence::proof_pack;   // ✅ Works everywhere
```

## Future Enhancements

### Planned Features

1. **Cloud backup** - Sync recordings to cloud storage
2. **Blockchain anchoring** - Timestamp recordings on blockchain
3. **AI analysis** - Detect work patterns and generate summaries
4. **Windows and Linux support** - Cross-platform recording
5. **Collaboration** - Share recordings with teams
6. **Advanced verification** - Verify against external sources

### Technical Improvements

1. **HTTP streaming** - True streaming instead of Blob URLs
2. **Hardware acceleration** - Use AES-NI for faster encryption
3. **Parallel decryption** - Decrypt multiple chunks concurrently
4. **Compression** - Compress before encrypting
5. **Progressive loading** - Start playback before all chunks loaded
6. **Key rotation** - Re-encrypt with new password

## Troubleshooting

### Common Issues

1. **Recording permission denied**
   - Open System Settings → Privacy & Security → Screen Recording
   - Enable permission for Notari
   - Restart app

2. **Video won't play**
   - Check password is correct
   - Verify file isn't corrupted
   - Check logs in Settings → Dev/Logging

3. **Sidecar fails to spawn**
   - Verify sck-recorder binary exists
   - Check file permissions
   - Review logs for error messages

4. **Encryption fails**
   - Check disk space
   - Verify write permissions
   - Ensure password meets requirements

### Debug Mode

Enable detailed logging:
1. Open Settings → Dev/Logging
2. All backend logs appear here in real-time
3. Filter by category (recording, encryption, video_server)
4. Copy logs for bug reports

## Contributing

### Code Style

- **Rust**: Follow `rustfmt` defaults
- **TypeScript**: Follow project ESLint config
- **Commits**: Use conventional commits format

### Testing

- Write unit tests for new features
- Test encryption/decryption thoroughly
- Verify playback on different file sizes
- Check cleanup of temp files

### Pull Requests

1. Create feature branch
2. Write tests
3. Update documentation
4. Submit PR with clear description

