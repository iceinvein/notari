# Project Structure

## Root Directory Organization
```
notari/
├── src/                    # Main application source code
├── src-tauri/             # Tauri Rust backend code
├── public/                # Static assets
├── tests/                 # Test files
├── docs/                  # Documentation
├── .kiro/                 # Kiro configuration and specs
└── dist/                  # Build output
```

## Frontend Structure (`src/`)
```
src/
├── components/            # Reusable React components
│   ├── ui/               # Base UI components (Hero UI)
│   ├── capture/          # Session capture components
│   ├── proof-pack/       # Proof Pack management
│   ├── verification/     # Verification interface
│   └── redaction/        # Redaction tools
├── pages/                # Main application pages/views
├── hooks/                # Custom React hooks
├── services/             # API and service layer
│   ├── crypto/           # Cryptographic operations
│   ├── ai/               # AI processing services
│   ├── blockchain/       # Blockchain integration
│   └── storage/          # Local storage management
├── types/                # TypeScript type definitions
├── utils/                # Utility functions
├── styles/               # Global styles and Tailwind config
└── main.tsx              # Application entry point
```

## Backend Structure (`src-tauri/`)
```
src-tauri/
├── src/
│   ├── capture/          # Platform-specific capture engines
│   ├── crypto/           # Cryptographic operations
│   ├── storage/          # Database and file operations
│   ├── commands/         # Tauri command handlers
│   └── main.rs           # Rust application entry
├── Cargo.toml            # Rust dependencies
└── tauri.conf.json       # Tauri configuration
```

## Core Component Architecture

### Modular Design Principles
- **Separation of Concerns**: Each module handles a specific domain
- **Interface-Driven**: Clear contracts between components
- **Platform Abstraction**: Cross-platform compatibility through adapters
- **Security Boundaries**: Isolated cryptographic and sensitive operations

### Key Modules
1. **Capture Engine** (`src/services/capture/`, `src-tauri/src/capture/`)
2. **AI Processor** (`src/services/ai/`)
3. **Proof Pack Assembler** (`src/services/proof-pack/`)
4. **Redaction Engine** (`src/components/redaction/`, `src/services/redaction/`)
5. **Blockchain Anchor** (`src/services/blockchain/`)
6. **Verification API** (`src/services/verification/`)

### Data Flow
- Frontend components communicate with Tauri backend via commands
- Rust backend handles platform-specific operations and security
- SQLite database stores session metadata and user preferences
- Encrypted files stored separately from database records

## File Naming Conventions
- **Components**: PascalCase (e.g., `CaptureEngine.tsx`)
- **Services**: camelCase (e.g., `cryptoService.ts`)
- **Types**: PascalCase with `.types.ts` suffix (e.g., `Session.types.ts`)
- **Tests**: Same as source file with `.test.ts` suffix
- **Hooks**: camelCase starting with `use` (e.g., `useSession.ts`)

## Configuration Files
- **Tauri**: `src-tauri/tauri.conf.json`
- **Vite**: `vite.config.ts`
- **TypeScript**: `tsconfig.json`
- **Tailwind**: `tailwind.config.js`
- **Biome**: `biome.json`
- **Package**: `package.json`

## Security Architecture
- Sensitive operations isolated in Rust backend
- Frontend never handles raw cryptographic keys
- Database encryption keys stored in platform keychain
- Session data encrypted before storage