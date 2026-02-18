# SafeClaw

**Security management dashboard for AI agents** — intercept, monitor, and control what AI agents can do on your system.

[![npm version](https://img.shields.io/npm/v/safeclaw)](https://www.npmjs.com/package/safeclaw)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/node-%3E%3D20-brightgreen)](https://nodejs.org)
[![CI](https://github.com/DinoMorphica/safeclaw/actions/workflows/ci.yml/badge.svg)](https://github.com/DinoMorphica/safeclaw/actions/workflows/ci.yml)

---

SafeClaw acts as a firewall between AI agents and your operating system. It monitors agent activity in real-time, intercepts dangerous commands before they execute, and gives you granular control over what agents can access.

## Features

- **Command Interception** — Block dangerous shell commands (rm -rf, sudo, etc.) with a pattern-based blocklist
- **Session Monitoring** — Visual timeline of everything the agent does, grouped by interaction
- **Threat Detection** — 10-category threat analysis engine with 200+ patterns, secret scanning, and OWASP references
- **Access Control** — Toggle what the agent can touch: filesystem, network, system commands, MCP servers
- **Real-time Dashboard** — Web UI with live updates via Socket.IO

<!-- TODO: Add screenshot -->

## Quick Start

```bash
npx safeclaw start
```

This starts the SafeClaw dashboard server and opens the web UI in your browser. SafeClaw will automatically connect to any running OpenClaw agent instance.

## Development

### Prerequisites

- [Node.js](https://nodejs.org) >= 20
- [pnpm](https://pnpm.io) >= 9

### Setup

```bash
git clone https://github.com/DinoMorphica/safeclaw.git
cd safeclaw
pnpm install
```

### Dev Mode

Run the backend and frontend in separate terminals:

```bash
# Terminal 1: Backend with hot reload
pnpm dev:cli

# Terminal 2: Frontend dev server (http://localhost:5173)
pnpm dev:web
```

### Build

```bash
pnpm build          # Build all (shared types → frontend → backend)
pnpm typecheck      # Type-check all packages
pnpm test           # Run test suite
```

### Other Commands

```bash
pnpm clean          # Remove all build artifacts
pnpm lint           # Run ESLint
pnpm format:check   # Check formatting with Prettier
```

## Project Structure

```
safeclaw-monorepo/
├── apps/
│   └── cli/                        # Main package: "safeclaw" (backend + frontend)
│       ├── bin/                    # npx entry point (safeclaw.js)
│       ├── src/                    # Backend source
│       │   ├── main.ts            # CLI entry: start, reset, status, doctor, config, logs
│       │   ├── commands/          # 6 CLI commands
│       │   ├── db/                # Drizzle ORM schema + migrations (SQLite)
│       │   ├── lib/               # Utilities: threat patterns, secret scanner, OpenClaw client
│       │   ├── server/            # Fastify server, REST routes, Socket.IO handlers
│       │   └── services/          # Core services: monitor, exec approvals, access control
│       │       └── __tests__/     # Vitest tests (105 tests)
│       └── web/                    # Frontend source (React 18, Vite 6, Tailwind 4)
│           ├── pages/             # 9 pages: Dashboard, Interception, Sessions, Threats, etc.
│           ├── components/        # Layout, Sidebar, ActivityDetails renderers
│           └── lib/               # Socket client, activity parser, security analyzer
├── packages/
│   └── shared/                     # @safeclaw/shared — TypeScript types + Zod schemas
│       └── src/
│           ├── types.ts           # 40+ interfaces, Socket.IO event types
│           └── schemas.ts         # Zod validation schemas
├── .github/workflows/              # CI and publish workflows
├── docs/                           # Technical documentation
├── eslint.config.mjs               # ESLint 9 flat config
├── .prettierrc                     # Prettier config
├── .husky/                         # Git hooks (pre-commit: lint-staged)
├── tsconfig.base.json              # Shared TypeScript config
├── pnpm-workspace.yaml             # pnpm workspace: apps/*, packages/*
└── package.json                    # Root scripts, devDependencies, lint-staged
```

See [`.claude/CLAUDE.md`](.claude/CLAUDE.md) for detailed architecture documentation.

## Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines on how to get started.

## Security

To report security vulnerabilities, please see [SECURITY.md](SECURITY.md).

## License

[MIT](LICENSE) — see the [LICENSE](LICENSE) file for details.
