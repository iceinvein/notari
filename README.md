# Notari

Tamper-evident proof-of-work verification through cryptographically secure session capture, AI-powered analysis, and blockchain anchoring.

Notari is a desktop application that combats false positives from AI detection tools by providing verifiable evidence of human work through secure work session capture, AI-powered content analysis, and immutable blockchain verification.

## Technologies Used

- [Tauri](https://tauri.app) - Desktop application framework
- [Vite](https://vitejs.dev/guide/) - Build tool
- [React](https://react.dev) - UI framework
- [HeroUI](https://heroui.com) - UI component library
- [Tailwind CSS](https://tailwindcss.com) - Styling
- [TypeScript](https://www.typescriptlang.org) - Type safety
- [Rust](https://www.rust-lang.org) - Backend/native functionality

## Prerequisites

- Node.js 18+ and pnpm (repo is configured for pnpm)
- Rust toolchain (stable)
- macOS 12.3+ for ScreenCaptureKit-based recording
- Xcode Command Line Tools on macOS (`xcode-select --install`)

## Development

### Install dependencies

```bash
pnpm install
```

### Run the development server

```bash
pnpm tauri dev
```

This will start both the Vite development server and the Tauri application with hot reload.

### Build for production

```bash
pnpm tauri build
```

## Documentation

- Screen recording architecture, commands, and Swift sidecar: [docs/recording.md](docs/recording.md)

## Features

- System tray app with popover (click outside to close; app keeps running)
- Unified header with back button and Settings; theme toggles consolidated in Settings
- Screen/window recording on macOS via ScreenCaptureKit (Swift sidecar); window list + thumbnails
- Permission-aware error UX with one-click "Open Screen Recording Settings"
- Dev Logs tab in Settings; forwards sidecar "[sck]" logs from backend
- Cross-platform scaffolding; screen recording is currently macOS-first

## License

Licensed under the [MIT license](LICENSE).
