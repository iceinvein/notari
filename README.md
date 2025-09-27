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

## Features

- **System Tray Integration**: Runs as a system tray application
- **Popover Interface**: Clean, accessible popover UI inspired by modern desktop applications
- **Keyboard Navigation**: Full keyboard accessibility with proper focus management
- **Cross-platform**: Works on Windows, macOS, and Linux

## License

Licensed under the [MIT license](LICENSE).
