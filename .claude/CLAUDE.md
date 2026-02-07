# SafeClaw – Agent Instructions

## Project Overview

SafeClaw is a **security management dashboard for AI agents**. It monitors, intercepts, and controls what AI agents (specifically OpenClaw) can do on a user's system. Think of it as a firewall between an AI agent and the operating system.

**MVP goal:** Ship a free, local-only tool that any developer can run with `npx safeclaw start` and immediately get three things:

1. **Command Interception** – Block dangerous shell commands before they execute
2. **Session Monitoring** – See everything the agent does in a visual timeline
3. **Access Control** – Toggle what the agent can touch (files, network, MCP servers, etc.)

**Current version:** 0.1.0 (early development). No tests exist yet. No auth. No premium features. The enforcement layer (actually blocking commands) is not wired up — the tool currently monitors and displays but does not yet prevent execution.

---

## Monorepo Structure

```
safeclaw-monorepo/
├── apps/
│   ├── cli/            # Backend – Fastify server, SQLite, CLI commands
│   │   ├── bin/safeclaw.js        # npx entry point (shebang → dist/main.js)
│   │   ├── src/
│   │   │   ├── main.ts            # CLI arg parser: start | reset | status | help
│   │   │   ├── interceptor.ts     # Threat pattern matching engine
│   │   │   ├── commands/          # start.ts, reset.ts, status.ts
│   │   │   ├── db/                # index.ts, schema.ts, migrate.ts
│   │   │   ├── lib/               # banner, config, logger, paths, openclaw-*
│   │   │   ├── server/            # index.ts (Fastify factory), routes.ts, socket.ts
│   │   │   └── services/          # openclaw-monitor.ts
│   │   ├── drizzle.config.ts
│   │   ├── tsconfig.json
│   │   └── package.json           # name: "safeclaw"
│   │
│   └── web/            # Frontend – React + Vite + Tailwind
│       ├── src/
│       │   ├── App.tsx            # React Router (6 routes)
│       │   ├── main.tsx           # React entry
│       │   ├── pages/             # 6 pages (see Frontend section)
│       │   ├── components/        # Layout, Sidebar, ConnectionStatus, ActivityDetails/
│       │   └── lib/               # socket.ts, securityAnalyzer.ts, activityParser.ts, activityGrouper.ts
│       ├── vite.config.ts
│       ├── tsconfig.json
│       └── package.json           # name: "@safeclaw/web"
│
├── packages/
│   └── shared/         # Shared types and Zod schemas
│       ├── src/
│       │   ├── types.ts           # 30+ TypeScript interfaces
│       │   ├── schemas.ts         # Zod validation schemas
│       │   └── index.ts           # Re-exports everything
│       ├── tsconfig.json
│       └── package.json           # name: "@safeclaw/shared"
│
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── package.json                   # Root workspace scripts
└── docs/
    └── technical_guide.md         # Full product & technical spec
```

---

## Tech Stack

| Layer | Technology | Notes |
|-------|-----------|-------|
| Package manager | pnpm >=9 | Workspace protocol (`workspace:*`) |
| Backend runtime | Node.js >=20 | ES modules (`"type": "module"`) |
| Backend framework | Fastify 5 | With `@fastify/cors`, `@fastify/static` |
| Real-time | Socket.IO 4.8 | Server + client, typed events |
| Database | SQLite via better-sqlite3 | Stored at `~/.safeclaw/safeclaw.db` |
| ORM | Drizzle ORM 0.38 | Schema in `apps/cli/src/db/schema.ts` |
| Frontend | React 18 | With React Router DOM 7 |
| Styling | Tailwind CSS 4 | Via Vite plugin, dark theme |
| Build (web) | Vite 6 | Proxies `/api` and `/socket.io` to :3000 in dev |
| Build (cli) | TypeScript (`tsc`) | Output to `dist/` |
| Validation | Zod 3.24 | Shared schemas for API payloads |
| Logging | Pino 9 | Console (pino-pretty) + file (`~/.safeclaw/logs/debug.log`) |
| OpenClaw comms | WebSocket (ws) | Connects to OpenClaw gateway at `localhost:18789` |

---

## How to Build and Run

### Install dependencies

```bash
pnpm install
```

### Build everything (shared → web → cli)

```bash
pnpm build
```

Order matters: shared must build first (types), then web (static assets), then cli. The root `pnpm build` runs `pnpm -r build` which respects dependency order.

### Individual builds

```bash
pnpm build:shared    # pnpm --filter @safeclaw/shared build
pnpm build:web       # pnpm --filter @safeclaw/web build
pnpm build:cli       # pnpm --filter safeclaw build
```

### Development mode

```bash
# Terminal 1 – Backend (watches and restarts)
pnpm dev:cli         # tsx watch src/main.ts start

# Terminal 2 – Frontend (Vite dev server on :5173)
pnpm dev:web         # vite dev
```

In dev mode, the Vite dev server on port 5173 proxies `/api` and `/socket.io` requests to the CLI server on port 3000. Open `http://localhost:5173` for hot-reloading frontend development.

### Production-like run

After building, the CLI serves the web frontend as static files from `apps/cli/public/`:

```bash
# Copy web build output into CLI's public folder
cp -r apps/web/dist/* apps/cli/public/

# Run the CLI
node apps/cli/bin/safeclaw.js start
# → Dashboard at http://localhost:3000
```

### Type checking (no emit)

```bash
pnpm typecheck       # Runs tsc --noEmit across all packages
```

### Database commands

```bash
cd apps/cli
pnpm db:push         # Push schema to SQLite (via drizzle-kit)
pnpm db:studio       # Open Drizzle Studio GUI
```

### Clean all build artifacts

```bash
pnpm clean           # Removes dist/ folders and apps/cli/public/*
```

---

## Data Directories

| Path | Purpose |
|------|---------|
| `~/.safeclaw/config.json` | SafeClaw settings (port, auto-open browser, userId, premium flag) |
| `~/.safeclaw/safeclaw.db` | SQLite database (command logs, sessions, activities, access config) |
| `~/.safeclaw/logs/debug.log` | Application debug logs |
| `~/.openclaw/openclaw.json` | OpenClaw config (SafeClaw can read and modify this) |
| `~/.openclaw/identity/device.json` | Ed25519 device identity for gateway auth |

---

## Database Schema

Five tables defined in `apps/cli/src/db/schema.ts`:

**command_logs** – Intercepted commands and their status
- `id` (integer PK), `command` (text), `status` (text: ALLOWED|BLOCKED|PENDING)
- `threat_level` (text: NONE|LOW|MEDIUM|HIGH|CRITICAL), `timestamp` (integer)
- `session_id` (text, nullable), `decision_by` (text: user|auto|system, nullable)

**sessions** – SafeClaw monitoring sessions
- `id` (text PK), `started_at` (integer), `ended_at` (integer, nullable)
- `status` (text: ACTIVE|ENDED)

**access_config** – Permission toggles (seeded with defaults on init)
- `id` (integer PK), `category` (text), `key` (text), `value` (text), `updated_at` (integer)
- Default categories: filesystem (on), database (off), mcp_servers (on), network (on), system_commands (off)

**openclaw_sessions** – Tracked OpenClaw agent sessions
- `id` (text PK), `started_at` (integer), `ended_at` (integer, nullable)
- `status` (text), `model` (text, nullable)

**agent_activities** – Individual agent actions within OpenClaw sessions
- `id` (integer PK), `openclaw_session_id` (text), `activity_type` (text)
- `detail` (text), `raw_payload` (text, JSON), `threat_level` (text)
- `timestamp` (integer), `tool_name` (text, nullable), `target_path` (text, nullable)
- Indexed on `openclaw_session_id` and `threat_level`

Migration and seeding happen in `apps/cli/src/db/migrate.ts` on server startup.

---

## API Surface

### REST Endpoints (apps/cli/src/server/routes.ts)

```
GET    /api/health                   → { status, timestamp }
GET    /api/commands?limit=N         → CommandLog[]
PUT    /api/commands/:id/decision    → body: { decision, decidedBy }
GET    /api/sessions                 → Session[]
GET    /api/config                   → AccessConfigEntry[]
PUT    /api/config/access            → body: { category, enabled }
GET    /api/settings                 → SafeClawConfig
PUT    /api/settings                 → body: Partial<SafeClawConfig>
GET    /api/openclaw/config          → OpenClawConfig
PUT    /api/openclaw/config          → body: Partial<OpenClawConfig>
GET    /api/openclaw/sessions        → OpenClawSession[]
GET    /api/openclaw/activities?sessionId=X → AgentActivity[]
GET    /api/openclaw/status          → { status, connectedSince?, gateway? }
```

### Socket.IO Events (apps/cli/src/server/socket.ts)

Server emits: `safeclaw:alert`, `safeclaw:commandLogged`, `safeclaw:sessionUpdate`, `safeclaw:configUpdate`, `safeclaw:stats`, `safeclaw:accessConfig`, `safeclaw:settingsData`, `safeclaw:openclawConfig`, `safeclaw:openclawActivity`, `safeclaw:openclawSessionUpdate`, `safeclaw:openclawMonitorStatus`

Client emits: `safeclaw:getStats`, `safeclaw:decision`, `safeclaw:getRecentCommands`, `safeclaw:getAccessConfig`, `safeclaw:toggleAccess`, `safeclaw:getSettings`, `safeclaw:updateSettings`, `safeclaw:getOpenclawConfig`, `safeclaw:updateOpenclawConfig`, `safeclaw:getOpenclawSessions`, `safeclaw:getOpenclawActivities`, `safeclaw:getOpenclawMonitorStatus`, `safeclaw:reconnectOpenclaw`

All event types are defined in `packages/shared/src/types.ts` (`ServerToClientEvents`, `ClientToServerEvents`).

---

## Frontend Pages

| Route | Page | Purpose |
|-------|------|---------|
| `/` | DashboardPage | Stats overview: total/blocked/allowed/pending commands, threat breakdown, block rate |
| `/interception` | InterceptionPage | Pending command approvals (allow/deny), command history with threat badges |
| `/sessions` | SessionsPage | Two tabs: OpenClaw sessions (with grouped activities) and SafeClaw sessions |
| `/access` | AccessControlPage | Toggle switches for 5 access categories |
| `/openclaw` | OpenClawPage | Edit OpenClaw config: model, gateway, concurrency, WhatsApp, channels |
| `/settings` | SettingsPage | SafeClaw port, auto-open browser, data directory, version info |

Component hierarchy: `App` → `Layout` (with `Sidebar`) → Page content. Activity details are rendered via `ActivityDetails/` components with tool-specific renderers.

---

## Threat Analysis

The backend threat engine lives in `apps/cli/src/interceptor.ts`. It pattern-matches against:

- **Shell commands:** `rm -rf /` (CRITICAL), `sudo` (HIGH), `curl | bash` (MEDIUM), etc.
- **File paths:** System dirs like `/etc`, `/usr` (CRITICAL), sensitive files like `.ssh`, `.aws` (HIGH)
- **URLs:** Paste sites (HIGH), raw IP addresses (MEDIUM)

The frontend has a parallel analyzer in `apps/web/src/lib/securityAnalyzer.ts` with 9 rules for UI-side threat display.

Activities flow: OpenClaw gateway → WebSocket → `OpenClawClient` → `OpenClawMonitor` (threat analysis + DB insert) → Socket.IO → React dashboard.

---

## OpenClaw Integration

SafeClaw connects to OpenClaw via WebSocket at `localhost:18789` (configurable in config). Authentication uses Ed25519 keys from `~/.openclaw/identity/device.json` and tokens from `~/.openclaw/openclaw.json`.

The client (`apps/cli/src/lib/openclaw-client.ts`) subscribes to events: `agent`, `chat`, `lifecycle`, `exec.approval`. The monitor service (`apps/cli/src/services/openclaw-monitor.ts`) parses these into structured activities and persists them.

SafeClaw can also read and modify OpenClaw's config file at `~/.openclaw/openclaw.json` using deep merge logic in `apps/cli/src/lib/openclaw-config.ts`.

---

## Key Conventions

### Code style
- ES modules everywhere (`"type": "module"`, `import`/`export`)
- TypeScript strict mode enabled
- Shared types in `packages/shared` — always import from `@safeclaw/shared`
- Zod schemas for runtime validation of API payloads
- Pino for backend logging (never `console.log` in production code)

### Naming
- Database columns: `snake_case`
- TypeScript interfaces and types: `PascalCase`
- Socket events: `safeclaw:camelCase` prefix for all events
- Files: `kebab-case.ts` for most files, `PascalCase.tsx` for React components

### Adding new features
1. Define types in `packages/shared/src/types.ts`
2. Add Zod schemas in `packages/shared/src/schemas.ts` if needed
3. Add database schema in `apps/cli/src/db/schema.ts` if persistence is needed
4. Add REST routes in `apps/cli/src/server/routes.ts`
5. Add Socket.IO events in `apps/cli/src/server/socket.ts` for real-time updates
6. Build the UI page/component in `apps/web/src/pages/` or `apps/web/src/components/`
7. Rebuild shared first (`pnpm build:shared`) before other packages can see new types

### Adding a new page
1. Create `apps/web/src/pages/NewPage.tsx`
2. Add route in `apps/web/src/App.tsx`
3. Add sidebar link in `apps/web/src/components/Sidebar.tsx`

---

## How to Verify Changes

### After modifying shared types
```bash
pnpm build:shared && pnpm typecheck
```

### After modifying backend code
```bash
pnpm build:shared && pnpm build:cli
# Or for quick iteration:
pnpm dev:cli
```

### After modifying frontend code
```bash
pnpm dev:web
# Open http://localhost:5173 and verify visually
# Make sure dev:cli is running in another terminal for API access
```

### Full verification
```bash
pnpm clean && pnpm build && pnpm typecheck
```
This builds all packages in dependency order and type-checks everything. If this passes, the project is in a good state.

### Manual smoke test
1. Run `pnpm dev:cli` in one terminal
2. Run `pnpm dev:web` in another terminal
3. Open `http://localhost:5173`
4. Verify: Dashboard loads with stats, Sidebar navigation works, no console errors
5. If OpenClaw is running locally, verify: Sessions page shows connection, activities stream in

### Database verification
```bash
cd apps/cli && pnpm db:studio
```
Opens Drizzle Studio to inspect the SQLite database directly.

---

## Known Gaps (MVP Completion Items)

These are not yet implemented but are needed for a complete MVP:

- **Enforcement layer**: The system monitors but does not actually block commands. The approval/deny flow in InterceptionPage sends decisions but nothing prevents OpenClaw from executing.
- **Exec approval response**: OpenClaw sends `exec.approval` events but SafeClaw does not respond back with allow/deny decisions.
- **Test suite**: Zero tests exist. No test runner is configured.
- **SafeClaw session lifecycle**: SafeClaw sessions are not automatically created/ended.
- **Error boundaries**: No React error boundaries or fallback UI.
- **Export functionality**: No CSV/JSON export for audit logs.
- **Rate limiting**: No rate limiting on API endpoints.

---

## Useful Commands Reference

```bash
# Install
pnpm install

# Development
pnpm dev:cli                    # Backend with hot reload
pnpm dev:web                    # Frontend with hot reload

# Build
pnpm build                      # Build all (shared → web → cli)
pnpm build:shared               # Build shared types only
pnpm build:web                  # Build frontend only
pnpm build:cli                  # Build backend only

# Verify
pnpm typecheck                  # Type-check all packages

# Clean
pnpm clean                      # Remove all dist/ and public/

# Database
cd apps/cli && pnpm db:push     # Push schema changes
cd apps/cli && pnpm db:studio   # Visual DB inspector

# Production-like
cp -r apps/web/dist/* apps/cli/public/ && node apps/cli/bin/safeclaw.js start
```
