# Technology Stack

## Framework & Build System
- **Desktop Framework**: Tauri (Rust backend + web frontend)
- **Frontend**: React with TypeScript
- **Build System**: Vite
- **Package Manager**: npm/yarn

## Development Tools
- **Linting & Formatting**: Biome
- **Testing Framework**: Vitest
- **Component Testing**: React Testing Library

## UI & Styling
- **CSS Framework**: Tailwind CSS
- **Component Library**: Hero UI components
- **Theming**: Custom CSS properties with React context
- **Responsive Design**: Tailwind CSS breakpoints

## Core Technologies
- **Database**: SQLite (local storage)
- **Encryption**: AES-256-GCM
- **AI Processing**: ONNX Runtime (local inference)
- **Blockchain**: Arweave (primary), Ethereum (secondary)
- **Payment Processing**: Stripe

## Platform-Specific APIs
- **Windows**: DirectX/Windows Graphics Capture API, Windows Input API
- **macOS**: AVFoundation (screen capture), CGEvent API (input monitoring)

## Common Commands

### Development
```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Run tests
npm run test

# Run tests in watch mode
npm run test:watch

# Lint code
npm run lint

# Format code
npm run format
```

### Building
```bash
# Build for development
npm run build

# Build for production
npm run build:prod

# Build Tauri app for current platform
npm run tauri:build

# Build for Windows (from any platform)
npm run tauri:build -- --target x86_64-pc-windows-msvc

# Build for macOS (from any platform)  
npm run tauri:build -- --target x86_64-apple-darwin
```

### Testing
```bash
# Run unit tests
npm run test:unit

# Run integration tests
npm run test:integration

# Run end-to-end tests
npm run test:e2e

# Generate test coverage report
npm run test:coverage
```

## Security Considerations
- All cryptographic operations must use established libraries
- Device-specific key generation with hardware-backed security where available
- End-to-end encryption for all sensitive data
- Secure key storage and rotation mechanisms
- Regular security audits and penetration testing