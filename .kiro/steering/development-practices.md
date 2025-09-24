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
5. Run `pnpm typecheck` to ensure TypeScript compilation is clean
6. Run `pnpm lint` to ensure code follows linting rules (use `pnpm lint:fix` for auto-fixes)
7. Test using the patterns shown in Context7 examples
8. Run `pnpm typecheck` and `pnpm lint` again before committing

### Key Libraries to Always Check
- **React**: Hook patterns, component lifecycle, performance optimizations
- **Tauri**: Command patterns, event handling, platform-specific APIs
- **TypeScript**: Type definitions, interface patterns, generic usage
- **Tailwind CSS**: Utility classes, responsive design, custom configurations
- **Hero UI**: Component APIs, styling patterns, accessibility features
- **Vitest**: Testing patterns, mocking strategies, coverage setup
- **ONNX Runtime**: Model loading, inference patterns, performance optimization
- **Stripe**: Payment integration, webhook handling, subscription management

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
- **Always run `pnpm typecheck` before committing code** - Ensure TypeScript compilation is clean
- **Always run `pnpm lint` before committing code** - Ensure code follows linting rules
- Run type checking and linting regularly during development to catch issues early
- Use `pnpm lint:fix` to automatically fix linting issues when possible
- For legitimate exceptions, use `// biome-ignore lint/rule-name: reason` comments with proper justification

### Development Commands
```bash
# Type check TypeScript code
pnpm typecheck

# Run type checking in watch mode
pnpm typecheck --watch

# Lint code with Biome
pnpm lint

# Auto-fix linting issues
pnpm lint:fix

# Other common commands
npm run dev          # Start development server
npm run test         # Run tests
npm run format       # Format code
```

### Pre-Commit Checklist
Before committing code, ensure the following commands pass without errors:

```bash
# 1. Type checking
pnpm typecheck

# 2. Linting
pnpm lint

# 3. Tests (if applicable)
npm run test

# Quick check all at once
pnpm typecheck && pnpm lint && npm run test
```