# Notari - Proof of Work System

**Tamper-evident proof-of-work verification through cryptographically secure session capture, AI-powered analysis, and blockchain anchoring.**

Notari is a desktop application that combats false positives from AI detection tools by providing verifiable evidence of human work through secure work session capture, AI-powered content analysis, and immutable blockchain verification.

## 🎯 Core Purpose

Combat false positives from AI detection tools by providing verifiable evidence of human work through:

- **Secure Work Session Capture** - Tamper-evident timestamps and cryptographic signatures
- **AI-Powered Content Analysis** - Intelligent summarization and context extraction
- **Redactable "Proof Packs"** - Privacy-controlled sharing with selective information hiding
- **Blockchain Anchoring** - Immutable verification through decentralized networks

## 👥 Target Users

- **Students** - Proving original academic work and research
- **Professionals** - Demonstrating authentic work output and processes
- **Creators** - Validating original content creation and intellectual property
- **Verifiers** - Teachers, employers, and clients needing to validate work authenticity

## ✨ Key Features

### 🔒 Tamper-Proof Session Capture

- Cross-platform screen and input monitoring (Windows/macOS)
- Device-specific encryption with hardware-backed security
- Continuous cryptographic timestamping
- Interrupt-resistant data integrity

### 🤖 AI-Powered Analysis

- Local ONNX Runtime inference for privacy
- Work pattern analysis and context extraction
- AI-generated content detection and flagging
- Relevance scoring for session segments

### 📦 Proof Pack Management

- Structured evidence bundling (JSON/PDF export)
- Chronological organization with clear timestamps
- Multi-session relationship tracking
- Unique identifier generation

### 🎭 Privacy & Redaction

- Selective information hiding with integrity preservation
- Cryptographic proof of redacted content existence
- Verification capability maintenance for non-redacted areas
- Impact warnings for critical proof elements

### ⛓️ Blockchain Verification

- Arweave primary anchoring with Ethereum fallback
- Merkle proof generation for efficient verification
- Permanent verification URLs
- Transaction ID and block information storage

### 🎨 Modern User Experience

- System tray-based interface for unobtrusive operation
- Compact popover design (400px × 600px max)

## 🏗️ Technology Stack

### Desktop Framework

- **Tauri** - Rust backend with web frontend
- **React 19** with TypeScript
- **Vite** - Build system and development server
- **pnpm** - Package manager

### UI & Styling

- **Tailwind CSS 4** - Utility-first CSS framework
- **Hero UI** - Modern React component library
- **Framer Motion** - Animation and transitions

### Backend Technologies

- **Rust** - High-performance system operations
- **SQLite** - Local data storage with encryption
- **AES-256-GCM** - Cryptographic security
- **ONNX Runtime** - Local AI inference

### Development Tools

- **Biome** - Linting and code formatting
- **Vitest** - Testing framework
- **React Testing Library** - Component testing

### Blockchain & Payments

- **Arweave** - Primary blockchain for permanent storage
- **Ethereum** - Secondary blockchain network
- **Stripe** - Payment processing and subscriptions

## 🚀 Quick Start

### Prerequisites

- **Node.js** 18+ and **pnpm** 8+
- **Rust** 1.70+ with Cargo
- **Platform-specific dependencies:**
  - **Windows**: Visual Studio Build Tools
  - **macOS**: Xcode Command Line Tools

### Installation

```bash
# Clone the repository
git clone https://github.com/dikrana/notari.git
cd notari

# Install dependencies
pnpm install

# Install Rust dependencies
cd src-tauri && cargo build && cd ..
```

### Development

```bash
# Start development server
pnpm dev

# Run in Tauri development mode
pnpm tauri:dev

# Run tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Type checking
pnpm typecheck

# Lint code
pnpm lint

# Auto-fix linting issues
pnpm lint:fix

# Format code
pnpm format
```

### Building

```bash
# Build web assets
pnpm build

# Build Tauri application
pnpm tauri:build

# Build for specific platforms
pnpm tauri:build -- --target x86_64-pc-windows-msvc  # Windows
pnpm tauri:build -- --target x86_64-apple-darwin     # macOS
```

## 📁 Project Structure

```text
notari/
├── src/                    # React frontend source
│   ├── components/         # Reusable React components
│   │   ├── layout/        # Application layout components
│   │   ├── session/       # Session management UI
│   │   ├── proofpack/     # Proof Pack creation and management
│   │   ├── redaction/     # Privacy and redaction tools
│   │   └── verification/  # Verification interface
│   ├── hooks/             # Custom React hooks
│   ├── services/          # API and service layer
│   ├── types/             # TypeScript type definitions
│   └── styles/            # Global styles and Tailwind config
├── src-tauri/             # Rust backend source
│   ├── src/
│   │   ├── capture/       # Platform-specific capture engines
│   │   ├── crypto/        # Cryptographic operations
│   │   ├── storage/       # Database and file operations
│   │   └── commands/      # Tauri command handlers
│   ├── Cargo.toml         # Rust dependencies
│   └── tauri.conf.json    # Tauri configuration
├── .kiro/                 # Project specifications and documentation
│   ├── specs/             # Feature specifications
│   └── steering/          # Architecture and development guides
└── public/                # Static assets
```

## 🧪 Testing

```bash
# Run all tests
pnpm test

# Run tests with coverage
pnpm test:coverage

# Run tests with UI
pnpm test:ui

# Run specific test suites
pnpm test src/components/session
pnpm test src/components/proofpack
```

## 🔧 Development Workflow

### Pre-Commit Checklist

Before committing code, ensure these commands pass:

```bash
# Type checking
pnpm typecheck

# Linting
pnpm lint

# Tests
pnpm test

# Quick check all at once
pnpm typecheck && pnpm lint && pnpm test
```

### Code Quality Standards

- **TypeScript Strict Mode** - No `any` types without justification
- **Biome Linting** - Consistent code style and best practices
- **Component Testing** - React Testing Library for UI components
- **Security First** - Cryptographic operations isolated in Rust backend

## 🏢 Enterprise Features

- **SSO Integration** - Single sign-on for organizational deployment
- **Policy Management** - Administrative controls and compliance
- **GDPR Compliance** - Data deletion and export capabilities
- **Audit Trails** - Comprehensive verification activity logs
- **Multi-Device Key Management** - Secure key rotation and revocation

## 💰 Monetization

- **Tiered Subscriptions** - Different Proof Pack limits and features
- **Pay-Per-Use Credits** - Flexible pricing for occasional users
- **Enterprise Plans** - Organizational features and support
- **Stripe Integration** - Secure payment processing

## 🔐 Security Architecture

- **Device-Specific Encryption** - Hardware-backed key generation where available
- **End-to-End Encryption** - All sensitive data encrypted before storage
- **Platform Keychain Integration** - Secure key storage
- **Cryptographic Signatures** - Tamper-evident session data
- **Blockchain Anchoring** - Immutable verification records

## 📋 System Requirements

### Minimum Requirements

- **OS**: Windows 10+ or macOS 10.15+
- **RAM**: 4GB minimum, 8GB recommended
- **Storage**: 2GB available space
- **Network**: Internet connection for blockchain anchoring

### Recommended Setup

- **OS**: Windows 11 or macOS 12+
- **RAM**: 16GB for optimal AI processing
- **Storage**: SSD with 10GB+ available space
- **Network**: Broadband connection for faster blockchain operations

## 🤝 Contributing

1. **Fork the repository**
2. **Create a feature branch** (`git checkout -b feature/amazing-feature`)
3. **Run pre-commit checks** (`pnpm typecheck && pnpm lint && pnpm test`)
4. **Commit changes** (`git commit -m 'Add amazing feature'`)
5. **Push to branch** (`git push origin feature/amazing-feature`)
6. **Open a Pull Request**

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
