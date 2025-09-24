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
5. Test using the patterns shown in Context7 examples

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