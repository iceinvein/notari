# Notari

Tamper-evident proof-of-work verification through cryptographically secure session capture, AI-powered analysis, and blockchain anchoring.

Notari is a desktop application that combats false positives from AI detection tools by providing verifiable evidence of human work through secure work session capture, AI-powered content analysis, and immutable blockchain verification.

**Platform Support**: Currently macOS only (12.3+). Windows and Linux support planned.

## Technologies Used

- [Tauri](https://tauri.app) - Desktop application framework
- [Vite](https://vitejs.dev/guide/) - Build tool
- [React](https://react.dev) - UI framework
- [HeroUI](https://heroui.com) - UI component library
- [Tailwind CSS](https://tailwindcss.com) - Styling
- [TypeScript](https://www.typescriptlang.org) - Type safety
- [Rust](https://www.rust-lang.org) - Backend/native functionality

## Quick Start

### Prerequisites

- Node.js 18+ and pnpm
- Rust toolchain (stable)
- **macOS 12.3+** (required for ScreenCaptureKit)
- Xcode Command Line Tools
- **Apple Developer Account** (for code signing)

**Note**: Screen recording is currently macOS-only. See [docs/SETUP.md](docs/SETUP.md) for detailed setup instructions.

### Install and Run

```bash
# Install dependencies
pnpm install

# Run development server
pnpm tauri dev

# Build for production
pnpm tauri build
```

**First-time setup**: See [docs/SETUP.md](docs/SETUP.md) for code signing configuration and screen recording permissions.

## Documentation

### Getting Started

- **[Setup Guide](docs/SETUP.md)** - Development environment, code signing, and permissions

### System Documentation

- **[Architecture Overview](docs/ARCHITECTURE.md)** - System architecture, data flow, and component interaction
- **[Recording System](docs/recording.md)** - Screen recording architecture, commands, and Swift sidecar
- **[Encryption System](docs/encryption.md)** - AES-256-GCM chunked encryption, video playback, and security

### Developer Guides

- **[Encryption Implementation](docs/dev/encryption-implementation.md)** - Detailed implementation notes and bug history
- **[Encryption Quick Reference](docs/dev/encryption-quick-reference.md)** - Code snippets and common operations

## Features

### Core Capabilities

- **Screen Recording**: Capture individual windows using macOS ScreenCaptureKit
- **Encryption**: AES-256-GCM chunked encryption with password protection
- **Digital Signatures**: Ed25519 signatures for tamper detection
- **Proof Packs**: Self-contained .notari files with video, manifest, and verification data
- **Video Playback**: Stream encrypted videos without full decryption to disk
- **Verification**: Validate signatures, hashes, and encryption integrity
- **Custom Metadata**: Add titles, descriptions, and tags to recordings

### Security Features

- **Password-protected encryption** with PBKDF2 key derivation (600,000 iterations)
- **Chunked encryption** for efficient streaming playback
- **SHA-256 hashing** of both plaintext and encrypted videos
- **Ed25519 digital signatures** for authenticity verification
- **Tamper detection** through cryptographic verification
- **Secure temporary file handling** with automatic cleanup

### User Experience

- **System tray app** with popover (click outside to close; app keeps running)
- **Unified header** with back button and Settings icon
- **Window picker** with thumbnails for easy selection
- **Permission-aware UX** with one-click "Open Screen Recording Settings"
- **Dev/Logging tab** in Settings for debugging and monitoring
- **Theme support** (light/dark/system) consolidated in Settings

## Platform Support

| Platform | Status | Notes |
|----------|--------|-------|
| macOS 12.3+ | ✅ Supported | Full feature support via ScreenCaptureKit |
| Windows | 🚧 Planned | Encryption and verification work; recording TBD |
| Linux | 🚧 Planned | Encryption and verification work; recording TBD |

**Current Limitations**:

- Screen recording requires macOS 12.3+ (ScreenCaptureKit API)
- Encryption, signatures, and proof pack systems are cross-platform ready
- Windows/Linux recording implementations are planned for future releases

## License

MIT License - see [LICENSE](LICENSE) file for details.
