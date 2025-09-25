# Development Practices

## Library Documentation and Best Practices

### Context7 Integration
When working with any library or creating new functionality:

1. **Always Check Context7 First**: Before implementing any library integration or using external packages, use Context7 to get the most up-to-date documentation and best practices
2. **Verify Current Patterns**: Check Context7 for current usage patterns, especially for:
   - React hooks and component patterns
   - Tauri command implementations
   - TypeScript interface definitions
   - Tailwind CSS utility patterns
   - Hero UI component usage
   - Vitest testing patterns
   - Biome configuration
3. **Stay Updated**: Libraries evolve rapidly - Context7 ensures you're using current APIs and avoiding deprecated patterns

### Implementation Workflow
1. Identify the library or functionality needed
2. Query Context7 for current documentation and examples
3. Review the recommended patterns and best practices
4. Implement following the documented patterns
5. **Run `pnpm test` to ensure no regressions** - This is critical after any changes
6. Run `pnpm typecheck` to ensure TypeScript compilation is clean
7. Run `pnpm lint` to ensure code follows linting rules (use `pnpm lint:fix` for auto-fixes)
8. Test using the patterns shown in Context7 examples
9. Run `pnpm test`, `pnpm typecheck` and `pnpm lint` again before committing

### Key Libraries to Always Check
- **React**: Hook patterns, component lifecycle, performance optimizations
- **Tauri**: Command patterns, event handling, platform-specific APIs
- **TypeScript**: Type definitions, interface patterns, generic usage
- **Tailwind CSS**: Utility classes, responsive design, custom configurations
- **Hero UI**: Component APIs, styling patterns, accessibility features
- **Vitest**: Testing patterns, mocking strategies, coverage setup
- **ONNX Runtime**: Model loading, inference patterns, performance optimization
- **Stripe**: Payment integration, webhook handling, subscription management

### Testing Best Practices
Testing is a critical part of our development process. Follow these guidelines:

#### When to Run Tests
- **After every change**: Run `pnpm test` after making any code changes
- **Before committing**: Always ensure all tests pass before committing
- **During development**: Use `pnpm test:watch` for continuous testing
- **Before pushing**: Run full test suite including coverage checks

#### Test Types We Use
- **Unit Tests**: Test individual functions, hooks, and components in isolation
- **Integration Tests**: Test component interactions and data flow
- **Performance Tests**: Ensure performance requirements are met
- **Resource Management Tests**: Verify memory usage and cleanup
- **Regression Tests**: Prevent previously fixed bugs from reoccurring

#### Test Writing Guidelines
- Write tests for all new functionality
- Update tests when modifying existing code
- Use descriptive test names that explain what is being tested
- Mock external dependencies appropriately
- Test both success and error scenarios
- Include performance assertions for critical paths

#### Test Commands
```bash
# Run all tests once
pnpm test

# Run tests in watch mode (recommended during development)
pnpm test:watch

# Run tests with coverage report
pnpm test:coverage

# Run specific test file
pnpm test src/path/to/test.test.ts

# Run tests matching a pattern
pnpm test --grep "performance"
```

### Project Setup and Scaffolding
- **Use CLI Tools for Project Setup**: Always prefer using official CLI tools and generators instead of manually creating project files
- **Tauri Setup**: Use `npm create tauri-app@latest` or `cargo create-tauri-app` for new Tauri projects
- **React Setup**: Use `npm create vite@latest` with React + TypeScript template
- **Hero UI Setup**: Use `npx @heroui/cli@latest init` for Hero UI initialization and component generation
- **Component Generation**: Use CLI tools or generators when available for creating components, services, and tests
- **Package Installation**: Use package managers (`npm`, `yarn`, `cargo`) for adding dependencies rather than manual file creation

### Code Quality Standards
- Follow the patterns and conventions shown in Context7 documentation
- Use TypeScript strictly - no `any` types without explicit justification
- Implement proper error handling as shown in library documentation
- Follow security best practices documented for each library
- Write tests that match the patterns shown in Context7 examples
- **Always run `pnpm test` after making changes** - This prevents regressions and ensures code quality
- **Always run `pnpm typecheck` before committing code** - Ensure TypeScript compilation is clean
- **Always run `pnpm lint` before committing code** - Ensure code follows linting rules
- **Always run `cargo check` before committing Rust changes** - Ensure Rust code compiles correctly
- Run tests, type checking, linting, and Rust compilation regularly during development to catch issues early
- Use `pnpm lint:fix` to automatically fix linting issues when possible
- For legitimate exceptions, use `// biome-ignore lint/rule-name: reason` comments with proper justification

### Development Commands
```bash
# Run tests (CRITICAL - run after any changes)
pnpm test

# Run tests in watch mode during development
pnpm test:watch

# Run tests with coverage report
pnpm test:coverage

# Type check TypeScript code
pnpm typecheck

# Run type checking in watch mode
pnpm typecheck --watch

# Lint code with Biome
pnpm lint

# Auto-fix linting issues
pnpm lint:fix

# Check Rust code compilation (run from project root)
cargo check --manifest-path src-tauri/Cargo.toml

# Check Rust code with all features
cargo check --manifest-path src-tauri/Cargo.toml --all-features

# Run Rust tests
cargo test --manifest-path src-tauri/Cargo.toml

# Other common commands
pnpm dev          # Start development server
pnpm format       # Format code
```

### Pre-Commit Checklist
Before committing code, ensure the following commands pass without errors:

```bash
# 1. Run tests FIRST to ensure no regressions
pnpm test

# 2. Type checking (TypeScript)
pnpm typecheck

# 3. Linting (JavaScript/TypeScript)
pnpm lint

# 4. Rust compilation check (if Rust changes were made)
cargo check --manifest-path src-tauri/Cargo.toml

# Quick check all at once (frontend)
pnpm test && pnpm typecheck && pnpm lint

# Quick check all at once (including Rust)
pnpm test && pnpm typecheck && pnpm lint && cargo check --manifest-path src-tauri/Cargo.toml
```

**⚠️ IMPORTANT**: Always run `pnpm test` after making ANY changes to ensure you haven't introduced regressions. The test suite includes:
- Unit tests for components and utilities
- Performance tests for critical paths  
- Integration tests for complex workflows
- Resource management and optimization tests
- Debouncing and throttling behavior tests

If tests fail, fix the issues before committing. Never commit code with failing tests.

### Rust-Specific Guidelines
When working with Rust code in the `src-tauri/` directory:

- **Always run `cargo check`** before committing to ensure compilation
- **Use `cargo clippy`** for additional linting and best practice suggestions
- **Run `cargo fmt`** to format Rust code consistently
- **Test Rust code** with `cargo test` when adding new functionality
- **Check for unused dependencies** with `cargo machete` (if available)
- **Update Cargo.lock** when adding new dependencies

```bash
# Rust development workflow
cd src-tauri  # or use --manifest-path from project root

# Check compilation
cargo check

# Run clippy for linting
cargo clippy

# Format code
cargo fmt

# Run tests
cargo test

# Build for development
cargo build

# Build for release
cargo build --release
```