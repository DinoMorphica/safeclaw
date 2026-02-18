# Contributing to SafeClaw

Thank you for your interest in contributing to SafeClaw! This guide will help you get started.

## Prerequisites

- **Node.js** >= 20
- **pnpm** >= 9

## Getting Started

1. Fork the repository
2. Clone your fork:
   ```bash
   git clone https://github.com/<your-username>/safeclaw.git
   cd safeclaw
   ```
3. Install dependencies:
   ```bash
   pnpm install
   ```
4. Start development servers:
   ```bash
   pnpm dev:cli    # Backend with hot reload
   pnpm dev:web    # Frontend dev server on :5173 (in another terminal)
   ```
5. Open `http://localhost:5173` in your browser.

## Project Structure

```
safeclaw/
├── apps/cli/          # Backend (Fastify + Socket.IO) + Frontend (React + Vite)
│   ├── src/           # Backend source
│   └── web/           # Frontend source
├── packages/shared/   # Shared types and Zod schemas
└── docs/              # Technical documentation
```

See `.claude/CLAUDE.md` for a detailed architecture reference.

## Development Workflow

```bash
pnpm build              # Build all (shared -> cli)
pnpm typecheck          # Type-check all packages
pnpm test               # Run test suite
pnpm lint               # Lint all files
pnpm format:check       # Check formatting
```

After modifying shared types, rebuild shared first:

```bash
pnpm build:shared && pnpm typecheck
```

## Code Style

- **TypeScript** strict mode everywhere
- **ES modules** (`import`/`export`, `"type": "module"`)
- Shared types from `@safeclaw/shared` — never duplicate type definitions
- **Naming conventions:**
  - DB columns: `snake_case`
  - TypeScript interfaces/types: `PascalCase`
  - Socket.IO events: `safeclaw:camelCase`
  - Files: `kebab-case.ts`, React components: `PascalCase.tsx`

## Submitting a Pull Request

1. Create a feature branch from `main`:
   ```bash
   git checkout -b feat/my-feature
   ```
2. Make your changes
3. Ensure everything passes:
   ```bash
   pnpm build && pnpm typecheck && pnpm test
   ```
4. Commit using [Conventional Commits](https://www.conventionalcommits.org/):
   - `feat:` — new feature
   - `fix:` — bug fix
   - `docs:` — documentation only
   - `refactor:` — code restructuring without behavior change
   - `test:` — adding or updating tests
   - `chore:` — tooling, CI, dependencies
5. Push and open a pull request against `main`

## Reporting Issues

- Use [GitHub Issues](https://github.com/DinoMorphica/safeclaw/issues) for bugs and feature requests
- Check existing issues before creating a new one
- Include reproduction steps for bugs

## License

By contributing, you agree that your contributions will be licensed under the [AGPL-3.0-only](LICENSE) license.
