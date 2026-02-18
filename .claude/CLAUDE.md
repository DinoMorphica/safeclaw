# SafeClaw – Developer Reference

## Project Overview

SafeClaw is a **security management dashboard for AI agents**. It monitors, intercepts, and controls what AI agents (OpenClaw) can do on a user's system — a firewall between an AI agent and the OS.

**MVP goal:** Free, local-only tool via `npx safeclaw start` providing:

1. **Command Interception** – Block dangerous shell commands before execution
2. **Session Monitoring** – Visual timeline of everything the agent does
3. **Access Control** – Toggle what the agent can touch (files, network, MCP servers)

**Version:** 0.1.5 | **License:** AGPL-3.0-only | No auth, no premium features yet.

---

## Monorepo Structure

```
safeclaw-monorepo/
├── apps/
│   └── cli/                  # Backend + Frontend (package: "safeclaw")
│       ├── bin/safeclaw.js   # npx entry (shebang → dist/main.js)
│       ├── src/                            # Backend source
│       │   ├── main.ts                    # CLI: start|reset|status|doctor|config|logs
│       │   ├── interceptor.ts             # Unified activity threat analyzer wrapper
│       │   ├── commands/                  # 6 commands: start, reset, status, doctor, config, logs
│       │   ├── db/                        # index.ts (Drizzle singleton), schema.ts (7 tables), migrate.ts
│       │   ├── lib/                       # 12 utility modules
│       │   │   ├── openclaw-client.ts     # WebSocket gateway client (846 lines, largest file)
│       │   │   ├── threat-classifier.ts   # 10 threat category analyzers (553 lines)
│       │   │   ├── threat-patterns.ts     # 200+ regex patterns (206 lines)
│       │   │   ├── secret-scanner.ts      # 15+ credential type detection (89 lines)
│       │   │   ├── session-watcher.ts     # JSONL session file monitor (445 lines)
│       │   │   ├── openclaw-config.ts     # Read/write ~/.openclaw/openclaw.json
│       │   │   ├── exec-approvals-config.ts # Exec approvals file setup
│       │   │   ├── paths.ts              # All ~/.safeclaw/ and ~/.openclaw/ path constants
│       │   │   ├── config.ts             # SafeClaw config file I/O + Zod validation
│       │   │   ├── logger.ts             # Pino dual output (console + file)
│       │   │   ├── banner.ts             # ASCII startup banner
│       │   │   └── version.ts            # Build-time version injection
│       │   ├── server/
│       │   │   ├── index.ts              # Fastify + Socket.IO factory
│       │   │   ├── routes.ts             # 23 REST endpoints (238 lines)
│       │   │   └── socket.ts             # Socket.IO handlers (348 lines)
│       │   └── services/
│       │       ├── openclaw-monitor.ts    # Central orchestrator (486 lines)
│       │       ├── exec-approval-service.ts # Command interception/blocklist (539 lines)
│       │       ├── access-control.ts      # Tool group toggles (337 lines)
│       │       └── __tests__/
│       │           ├── exec-approval-service.test.ts  # 730 lines, 46+ tests
│       │           ├── access-control.test.ts         # 699 lines
│       │           └── test-helpers.ts
│       ├── web/                            # Frontend source (React 18, Vite 6, Tailwind 4)
│       │   ├── index.html                 # Vite entry
│       │   ├── main.tsx
│       │   ├── App.tsx                    # React Router: 7 routes
│       │   ├── index.css
│       │   ├── pages/                     # 7 pages (~1,700 lines total)
│       │   │   ├── DashboardPage.tsx       # Stats overview, threat breakdown, recent activity
│       │   │   ├── InterceptionPage.tsx    # Exec approval UI, restricted patterns, history
│       │   │   ├── SessionsPage.tsx        # OpenClaw sessions + activity timeline (runId groups)
│       │   │   ├── ThreatsPage.tsx         # Threat center: filter, OWASP refs, remediation
│       │   │   ├── AccessControlPage.tsx   # Category toggles + MCP server toggles + sandbox config
│       │   │   ├── OpenClawPage.tsx        # Edit OpenClaw config (model, gateway, plugins)
│       │   │   └── SettingsPage.tsx        # Port, auto-open, version display
│       │   ├── components/
│       │   │   ├── Layout.tsx, Sidebar.tsx, ConnectionStatus.tsx
│       │   │   └── ActivityDetails/        # 6 tool-specific renderers + row/panel
│       │   │       ├── ActivityRow.tsx, ActivityDetailPanel.tsx, ActivityToolRenderer.tsx
│       │   │       └── renderers/          # File, Shell, Web, Message, Tool, Unknown
│       │   ├── lib/
│       │   │   ├── socket.ts              # Typed Socket.IO client
│       │   │   ├── securityAnalyzer.ts    # 10 client-side threat rules (instant UI feedback)
│       │   │   ├── activityParser.ts      # Raw JSON → structured ParsedActivity
│       │   │   ├── activityGrouper.ts     # Group by runId into interactions
│       │   │   └── threat-remediation.ts  # Per-category remediation advice
│       │   └── static/                    # Favicons and icons
│       ├── public/                        # Vite build OUTPUT (served by Fastify)
│       ├── dist/                          # tsup build output
│       ├── vite.config.ts                 # Vite: root=web/, builds to public/
│       ├── tsup.config.ts                 # Build: ESM, Node 20, bundles @safeclaw/shared
│       ├── tsconfig.json                  # Backend TS config (src/ only)
│       ├── tsconfig.web.json              # Frontend TS config (web/ only)
│       ├── vitest.config.ts               # Test: node env, forks pool, 10s timeout
│       └── drizzle.config.ts              # SQLite at ~/.safeclaw/safeclaw.db
│
├── packages/
│   └── shared/               # Shared types + Zod schemas (package: "@safeclaw/shared")
│       └── src/
│           ├── types.ts      # 40+ interfaces, 10+ type unions, Socket.IO event types
│           ├── schemas.ts    # Zod validation schemas for all types
│           └── index.ts      # Re-exports everything
│
├── .claude/
│   ├── CLAUDE.md             # This file
│   └── agents/               # Agent-specific docs (publish, threat-classification, openclaw-tracking)
├── docs/technical_guide.md   # Full product & technical spec
├── pnpm-workspace.yaml       # packages/*, apps/*
├── tsconfig.base.json        # ES2022, ESNext modules, strict, bundler resolution
└── package.json              # Root workspace scripts, Node >=20, pnpm >=9
```

---

## Tech Stack

| Layer           | Technology                | Notes                                                       |
| --------------- | ------------------------- | ----------------------------------------------------------- |
| Package manager | pnpm >=9                  | Workspace protocol (`workspace:*`)                          |
| Runtime         | Node.js >=20              | ES modules everywhere (`"type": "module"`)                  |
| Backend         | Fastify 5                 | + @fastify/cors, @fastify/static                            |
| Real-time       | Socket.IO 4.8             | Typed events (ServerToClientEvents, ClientToServerEvents)   |
| Database        | SQLite via better-sqlite3 | WAL mode, at `~/.safeclaw/safeclaw.db`                      |
| ORM             | Drizzle 0.38              | Schema in `apps/cli/src/db/schema.ts`                       |
| Testing         | Vitest 4.x                | 46+ tests for exec-approval + access-control services       |
| Frontend        | React 18                  | React Router DOM 7, lucide-react icons                      |
| Styling         | Tailwind CSS 4            | Dark theme, custom neutral palette, red primary             |
| Build (web)     | Vite 6                    | Proxies `/api` and `/socket.io` to backend in dev           |
| Build (cli)     | tsup 8.5                  | ESM output, Node 20 target, bundles shared types            |
| Validation      | Zod 3.24                  | Shared schemas for all API payloads                         |
| Logging         | Pino 9                    | Console (pino-pretty) + file (`~/.safeclaw/logs/debug.log`) |
| CLI             | Commander 13              | 6 commands + subcommands                                    |
| OpenClaw        | WebSocket (ws)            | Custom binary gateway protocol at `localhost:18789`         |

---

## Build & Run

```bash
pnpm install                    # Install all dependencies
pnpm build                      # Build all: shared → cli (vite build + tsup)
pnpm build:shared               # Build shared types only
pnpm build:web                  # Build frontend only (vite build)
pnpm build:cli                  # Build backend only (tsup)

pnpm dev:cli                    # Backend with hot reload (tsx watch)
pnpm dev:web                    # Frontend dev server on :5173 (proxies to CLI)

pnpm typecheck                  # Type-check all packages (no emit)
pnpm test                       # Run vitest suite
pnpm clean                      # Remove all dist/ and public/

cd apps/cli && pnpm db:push     # Push schema to SQLite
cd apps/cli && pnpm db:studio   # Open Drizzle Studio GUI
```

**Dev mode:** Vite on :5173 proxies `/api` and `/socket.io` to CLI server on :54335. Open `http://localhost:5173`.

**Production:** `pnpm build` runs `vite build` (outputs to `apps/cli/public/`) then `tsup` (outputs to `apps/cli/dist/`). Then `node apps/cli/bin/safeclaw.js start` serves everything from one port.

**Verification:** `pnpm clean && pnpm build && pnpm typecheck` — if this passes, the project is good.

---

## Data Directories

| Path                                    | Purpose                                                    |
| --------------------------------------- | ---------------------------------------------------------- |
| `~/.safeclaw/config.json`               | SafeClaw settings (port, autoOpenBrowser, userId, premium) |
| `~/.safeclaw/safeclaw.db`               | SQLite database (7 tables)                                 |
| `~/.safeclaw/logs/debug.log`            | Pino debug logs                                            |
| `~/.openclaw/openclaw.json`             | OpenClaw config (SafeClaw reads + modifies this)           |
| `~/.openclaw/identity/device.json`      | Ed25519 device identity for gateway auth                   |
| `~/.openclaw/exec-approvals.json`       | Exec approval config (managed by OpenClaw)                 |
| `~/.openclaw/agents/*/sessions/*.jsonl` | OpenClaw session journals (monitored by SessionWatcher)    |

---

## Database Schema (7 tables in `apps/cli/src/db/schema.ts`)

**command_logs** – Legacy intercepted commands

- id (int PK), command, status (ALLOWED|BLOCKED|PENDING), threat_level, timestamp, session_id, decision_by

**sessions** – SafeClaw sessions (not currently auto-managed)

- id (text PK), started_at, ended_at, status (ACTIVE|ENDED)

**access_config** – Audit trail for access control toggles

- id (int PK), category, key, value, updated_at
- Defaults: filesystem(on), mcp_servers(on), network(on), system_commands(off)

**openclaw_sessions** – Tracked OpenClaw agent sessions

- id (text PK), started_at, ended_at, status, model

**agent_activities** – Individual agent actions (core table)

- id (int PK), openclaw_session_id, activity_type, detail, raw_payload (JSON)
- threat_level, timestamp, tool_name, target_path, run_id, phase
- content_preview (max 10KB), read_content_preview (for write correlation)
- secrets_detected (JSON), threat_findings (JSON), resolved (bool), resolved_at
- Indexes: openclaw_session_id, threat_level, run_id

**restricted_patterns** – Blocklist for exec approval enforcement

- id (int PK), pattern (unique text), created_at
- Glob patterns (e.g., `sudo *`, `rm -rf *`) checked by ExecApprovalService

**exec_approvals** – Approval request records

- id (text PK), command, cwd, security, session_key
- requested_at, expires_at, decision, decided_by, decided_at, matched_pattern

Migrations run automatically on startup via `apps/cli/src/db/migrate.ts`.

---

## CLI Commands

| Command                 | Options                                | Purpose                                             |
| ----------------------- | -------------------------------------- | --------------------------------------------------- |
| `start`                 | `-p/--port`, `--no-open`, `--verbose`  | Launch dashboard server                             |
| `reset`                 | `--force`                              | Delete database + reset config                      |
| `status`                | `--json`                               | Show SafeClaw status                                |
| `doctor`                | —                                      | 8 health checks (Node version, DB, ports, OpenClaw) |
| `config list\|get\|set` | —                                      | Manage config keys (port, autoOpenBrowser, premium) |
| `logs`                  | `-n/--lines`, `-f/--follow`, `--clear` | View/follow/clear debug logs                        |

---

## REST API (23 endpoints in `apps/cli/src/server/routes.ts`)

**Health & Legacy:**

```
GET  /api/health                         → { status, timestamp }
GET  /api/commands?limit=N               → CommandLog[]
PUT  /api/commands/:id/decision          → { decision, decidedBy }
GET  /api/sessions                       → Session[]
```

**Access Control:**

```
GET  /api/access-control/state           → AccessControlState (toggles + MCP servers)
GET  /api/config                         → access_config rows
PUT  /api/config/access                  → { category, enabled }
PUT  /api/config/access/mcp-server       → { serverName, enabled }
```

**Settings:**

```
GET  /api/settings                       → SafeClawConfig
PUT  /api/settings                       → Partial<SafeClawConfig>
```

**OpenClaw:**

```
GET  /api/openclaw/config                → OpenClawConfig
PUT  /api/openclaw/config                → Partial<OpenClawConfig>
GET  /api/openclaw/sessions              → OpenClawSession[]
GET  /api/openclaw/activities?sessionId&limit → AgentActivity[]
GET  /api/openclaw/threats?severity&resolved&limit → AgentActivity[]
PUT  /api/openclaw/activities/:id/resolve → { resolved: boolean }
GET  /api/openclaw/status                → { connectionStatus, gatewayPort, activeSessionCount }
```

**Exec Approvals:**

```
GET  /api/exec-approvals/pending         → ExecApprovalEntry[]
GET  /api/exec-approvals/history?limit   → ExecApprovalEntry[]
PUT  /api/exec-approvals/:id/decision    → { decision: allow-once|allow-always|deny }
```

**Restricted Patterns (Blocklist):**

```
GET    /api/allowlist                    → { patterns[] }
POST   /api/allowlist                    → { pattern }
DELETE /api/allowlist                    → { pattern }
```

---

## Socket.IO Events (in `apps/cli/src/server/socket.ts`)

**Server → Client (16 events):**
`safeclaw:stats`, `safeclaw:commandLogged`, `safeclaw:accessConfig`, `safeclaw:accessControlState`, `safeclaw:settingsData`, `safeclaw:openclawConfig`, `safeclaw:openclawActivity`, `safeclaw:openclawSessionUpdate`, `safeclaw:openclawMonitorStatus`, `safeclaw:threatResolved`, `safeclaw:execApprovalRequested`, `safeclaw:execApprovalResolved`, `safeclaw:approvalHistoryBatch`, `safeclaw:allowlistState`, `safeclaw:sessionUpdate`, `safeclaw:configUpdate`

**Client → Server (23 events):**
`safeclaw:getStats`, `safeclaw:decision`, `safeclaw:getRecentCommands`, `safeclaw:getAccessConfig`, `safeclaw:getAccessControlState`, `safeclaw:toggleAccess`, `safeclaw:toggleMcpServer`, `safeclaw:getSettings`, `safeclaw:updateSettings`, `safeclaw:getOpenclawConfig`, `safeclaw:updateOpenclawConfig`, `safeclaw:getOpenclawSessions`, `safeclaw:getOpenclawActivities`, `safeclaw:getOpenclawMonitorStatus`, `safeclaw:reconnectOpenclaw`, `safeclaw:resolveActivity`, `safeclaw:getThreats`, `safeclaw:execDecision`, `safeclaw:getPendingApprovals`, `safeclaw:getApprovalHistory`, `safeclaw:getAllowlist`, `safeclaw:addAllowlistPattern`, `safeclaw:removeAllowlistPattern`

All typed in `packages/shared/src/types.ts` (ServerToClientEvents, ClientToServerEvents).

---

## Frontend Pages

| Route           | Page              | Key Features                                                                                                                |
| --------------- | ----------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `/`             | DashboardPage     | Stats cards (commands, threats, approvals), threat severity breakdown, recent activities                                    |
| `/interception` | InterceptionPage  | Pending approvals with countdown (Allow Once/Unrestrict/Deny), restricted patterns CRUD, history                            |
| `/sessions`     | SessionsPage      | OpenClaw sessions list, activity timeline grouped by runId (interaction), threat badges                                     |
| `/threats`      | ThreatsPage       | Filter by severity + resolved status, summary cards, expandable cards with OWASP refs, secrets, remediation, resolve toggle |
| `/access`       | AccessControlPage | 4 category toggles (filesystem/mcp/network/system), per-MCP-server toggles, workspace config, Docker sandbox settings       |
| `/openclaw`     | OpenClawPage      | Model selection, gateway config, concurrency, WhatsApp config, plugin toggles                                               |
| `/settings`     | SettingsPage      | Port, auto-open browser, version, data directory info                                                                       |

**Component hierarchy:** App → Layout (Sidebar + ConnectionStatus) → Page → ActivityDetails (6 tool-specific renderers: File, Shell, Web, Message, Tool, Unknown)

**State management:** React hooks + Socket.IO for real-time updates (no Redux/Zustand).

---

## Core Architecture: Three Independent Security Systems

SafeClaw has three security systems that operate **independently**:

### 1. Threat Analysis Engine (Passive Monitoring)

**Purpose:** Classify activities by threat level for UI display. Does NOT block anything.

**Components:**

- `threat-classifier.ts` – 10 category analyzers returning ThreatFinding objects
- `threat-patterns.ts` – 200+ regex patterns across 6 categories
- `secret-scanner.ts` – 15+ credential type detectors (AWS, OpenAI, GitHub, Stripe, PEM keys, DB URLs, JWT, etc.)
- `securityAnalyzer.ts` (frontend) – 10 client-side rules for instant UI feedback

**10 Threat Categories:**

| ID     | Name                  | Detects                                      | Severity        |
| ------ | --------------------- | -------------------------------------------- | --------------- |
| TC-SEC | Secret Exposure       | Credentials in outbound content              | CRITICAL        |
| TC-EXF | Data Exfiltration     | Paste sites, webhooks, suspicious URLs       | HIGH            |
| TC-INJ | Prompt Injection      | Adversarial instructions ("ignore previous") | CRITICAL/MEDIUM |
| TC-DES | Destructive Ops       | rm -rf /, DROP TABLE, fork bombs             | CRITICAL/HIGH   |
| TC-ESC | Privilege Escalation  | sudo, su, usermod, chmod setuid              | HIGH            |
| TC-SUP | Supply Chain Risk     | curl\|bash, npm install suspicious pkgs      | HIGH/MEDIUM     |
| TC-SFA | Sensitive File Access | .ssh/, .env, .aws/, /etc/passwd              | HIGH/MEDIUM     |
| TC-SYS | System Modification   | Writes to /etc/, /usr/bin/, /System/         | CRITICAL        |
| TC-NET | Network Activity      | Raw IPs, reverse shells, netcat              | HIGH/MEDIUM     |
| TC-MCP | MCP/Tool Poisoning    | Prompt injection in MCP responses            | HIGH            |

Each finding includes: categoryId, severity, evidence, reasoning, owaspRef, remediation.

**Activity flow:** OpenClaw action → OpenClawClient/SessionWatcher → OpenClawMonitor (classifyActivity + scanForSecrets) → DB insert (threat_level, threat_findings, secrets_detected, content_preview) → Socket.IO broadcast → Frontend display.

### 2. Exec Approval System (Active Enforcement)

**Purpose:** Intercept and block shell commands matching restricted patterns. **Blocklist model.**

**Service:** `exec-approval-service.ts` (539 lines, 46+ tests)

**Flow:**

1. OpenClaw sends `exec.approval.requested` via WebSocket gateway
2. ExecApprovalService checks command against `restricted_patterns` table (glob matching)
3. **No match** → auto-approve with `allow-once`, send back immediately
4. **Match** → queue as pending, notify UI via Socket.IO, start 10-min timeout
5. User decides: **Allow Once** | **Allow Always** (removes pattern) | **Deny**
6. Decision sent to OpenClaw gateway via `exec.approval.resolve`
7. Timeout (10 min) → auto-deny

**Key detail:** "Allow Always" (unrestrict) removes the matched pattern from the blocklist and syncs with OpenClaw's allowlist.

### 3. Access Control Toggles (Tool Group Blocks)

**Purpose:** Enable/disable entire tool groups by modifying OpenClaw's `tools.deny` config.

**Service:** `access-control.ts` (337 lines)

**Toggle mappings:**

- `filesystem` → `group:fs`
- `system_commands` → `group:runtime`
- `network` → `group:web` + `browser.enabled`
- `mcp_servers` → per-plugin enable/disable + `mcp__<name>` deny entries

**How:** Directly modifies `~/.openclaw/openclaw.json` tools.deny array via deep merge. The `access_config` DB table is an audit trail only.

### Independence of These Systems

A command can be CRITICAL threat level but auto-approved (not in blocklist). A NONE-threat command can be blocked (matches a restricted pattern). If System Commands toggle is off, exec approvals never fire (OpenClaw can't use runtime tools at all).

---

## Key Services

### OpenClawMonitor (`services/openclaw-monitor.ts`, 486 lines)

Central orchestrator. Creates OpenClawClient + SessionWatcher + ExecApprovalService. Handles: activity ingestion → threat analysis → DB persistence → Socket.IO broadcast. Manages session lifecycle (start/end). Singleton pattern.

### OpenClawClient (`lib/openclaw-client.ts`, 846 lines)

WebSocket client to OpenClaw gateway at localhost:18789. Custom binary protocol (req/res/event). Auth via Ed25519 keys. Subscribes to: agent, chat, lifecycle, exec.approval events. Emits typed events: activity, sessionStart, sessionEnd, statusChange, execApproval.

### SessionWatcher (`lib/session-watcher.ts`, 445 lines)

Monitors `~/.openclaw/agents/*/sessions/*.jsonl` files. Parses tool calls/results from JSONL entries. Maps 15+ OpenClaw tools to SafeClaw activity types (read_file→file_read, execute_command→shell_command, etc.). Extracts content previews (max 10KB). Caches read content for write correlation (before/after diffs, 5-min expiry).

### ExecApprovalService (`services/exec-approval-service.ts`, 539 lines)

Blocklist enforcement. Loads restricted_patterns from DB. Glob-to-regex matching (\*, ? wildcards, case-insensitive). In-memory pending queue with setTimeout timers. Syncs pattern changes with OpenClaw's allowlist via gateway API.

### AccessControlService (`services/access-control.ts`, 337 lines)

Derives current state from OpenClaw's config. Applies toggles by adding/removing groups from tools.deny. Per-MCP-server granular control. Audit trail in access_config table.

---

## Shared Types (`packages/shared/src/types.ts`)

**Key type unions:** CommandStatus, ThreatLevel (NONE→CRITICAL), SessionStatus, ActivityType (7 types), SecretType (17 types), OpenClawConnectionStatus, ThreatCategoryId (10 categories), ExecDecision (allow-once/allow-always/deny), AccessCategory (4 categories)

**Key interfaces:** ThreatFinding, CommandLog, Session, AgentActivity (13+ fields), OpenClawSession, OpenClawMonitorStatus, DashboardStats, ExecApprovalEntry, SafeClawConfig, AccessControlState, McpServerState, OpenClawConfig (hierarchical with tools, browser, sandbox, plugins, channels)

**Socket.IO types:** ServerToClientEvents (18 events), ClientToServerEvents (21 events) — fully typed.

All types have corresponding Zod schemas in `schemas.ts` with `.passthrough()` for extensibility.

---

## Key Conventions

**Code style:**

- ES modules everywhere (`import`/`export`, `"type": "module"`)
- TypeScript strict mode
- Shared types from `@safeclaw/shared` — never duplicate
- Zod for runtime validation at API boundaries
- Pino for logging (never `console.log` in production)

**Naming:**

- DB columns: `snake_case`
- TS interfaces/types: `PascalCase`
- Socket events: `safeclaw:camelCase`
- Files: `kebab-case.ts`, React components: `PascalCase.tsx`

**Singletons:** OpenClawMonitor, ExecApprovalService, Drizzle DB, Socket.IO server — all use lazy init + getter pattern.

### Adding new features

1. Types in `packages/shared/src/types.ts`
2. Zod schemas in `packages/shared/src/schemas.ts` (if needed)
3. DB schema in `apps/cli/src/db/schema.ts` (if persistence needed)
4. REST routes in `apps/cli/src/server/routes.ts`
5. Socket.IO events in `apps/cli/src/server/socket.ts`
6. UI in `apps/cli/web/pages/` or `apps/cli/web/components/`
7. **Rebuild shared first** (`pnpm build:shared`) before other packages see new types

### Adding a new page

1. Create `apps/cli/web/pages/NewPage.tsx`
2. Add route in `apps/cli/web/App.tsx`
3. Add sidebar link in `apps/cli/web/components/Sidebar.tsx`

---

## Verification

```bash
# After shared type changes
pnpm build:shared && pnpm typecheck

# After backend changes
pnpm build:shared && pnpm build:cli    # or: pnpm dev:cli

# After frontend changes
pnpm dev:web    # with dev:cli running in another terminal

# Full verification
pnpm clean && pnpm build && pnpm typecheck

# Run tests
pnpm test
```

**Smoke test:** `pnpm dev:cli` + `pnpm dev:web` → open localhost:5173 → Dashboard loads, sidebar works, no console errors.

---

## Test Coverage

**Tested (comprehensive):**

- ExecApprovalService: 46+ tests (730 lines) — pattern matching, auto-approve, manual approval, unrestrict/re-restrict, timeout, gateway communication, DB persistence, OpenClaw sync, stats, concurrency
- AccessControlService: 699 lines — state derivation, toggles, MCP server toggles, DB audit, OpenClaw sync, error handling

**Not tested:** OpenClawMonitor, SessionWatcher, threat classifier, secret scanner, API routes, Socket.IO handlers, all frontend code.

---

## Known Gaps

- **Threat → enforcement disconnect:** Threat analysis doesn't auto-suggest blocklist patterns
- **Access → approval independence:** No UI indicator when access toggles make approvals redundant
- **SafeClaw sessions:** Table exists but not auto-managed
- **Frontend:** No error boundaries, some pages lack loading states, no tests
- **Data:** No export (CSV/JSON), no retention/pruning, no DB vacuum
- **Docs:** No OpenAPI spec, no user guide

---

## Quick Reference

```bash
pnpm install                    # Install deps
pnpm dev:cli                    # Backend hot reload
pnpm dev:web                    # Frontend hot reload (:5173)
pnpm build                      # Build all (shared → vite + tsup)
pnpm typecheck                  # Type-check everything
pnpm test                       # Run test suite
pnpm clean                      # Remove all artifacts
cd apps/cli && pnpm db:studio   # Visual DB inspector
```
