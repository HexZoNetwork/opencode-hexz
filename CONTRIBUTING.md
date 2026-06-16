# Contributing to HEXZ

Thanks for your interest in contributing to HEXZ! This document covers the basics.

## Getting Started

1. Fork the repository
2. Clone your fork:
   ```bash
   git clone https://github.com/YOUR_USERNAME/opencode-hexz.git
   cd opencode-hexz
   ```
3. Install dependencies:
   ```bash
   bun install
   ```

## Development Workflow

### Making Changes

1. Create a branch:
   ```bash
   git checkout -b feature/your-feature
   ```

2. Make your changes in `src/hexz.ts`

3. Type check:
   ```bash
   bun run typecheck
   ```

4. Build:
   ```bash
   bun run build
   ```

5. Test locally:
   ```bash
   ./install.sh .
   ```

### Code Style

- TypeScript strict mode enabled
- Use explicit types where possible
- Keep functions focused and small
- Add JSDoc comments for public APIs
- Follow existing patterns in the codebase

### Commit Messages

Use conventional commits:

- `feat: add new feature`
- `fix: fix a bug`
- `docs: update documentation`
- `refactor: refactor code`
- `test: add tests`
- `chore: maintenance tasks`

## Adding New Tools

To add a new tool to HEXZ:

1. Define the tool in the `tool` object inside `HexzPlugin`:

```typescript
tool: {
  hexz_newtool: tool({
    description: "Tool description",
    args: {
      param: tool.schema.string(),
    },
    async execute(args, ctx) {
      return `Result: ${args.param}`
    },
  }),
}
```

2. Add it to the `HEXZ_PROMPT` string so the LLM knows about it.

3. Update the README with usage examples.

## Security Considerations

- Always sanitize user inputs
- Use the `sanitizeInput()` helper for search queries
- Validate file paths before operations
- Never log sensitive information
- Follow OWASP guidelines

## Testing

Before submitting:

1. Run type checker: `bun run typecheck`
2. Build: `bun run build`
3. Test installation: `./install.sh .`
4. Test in OpenCode: activate with `/active`, try your changes
5. Test deactivation: `/off`

## Pull Requests

1. Update README if adding features
2. Add yourself to CONTRIBUTORS.md (optional)
3. Keep PRs focused on one change
4. Write clear PR description
5. Reference any related issues

## Questions?

Open an issue at https://github.com/opencode-community/opencode-hexz/issues
