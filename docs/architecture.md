# Architecture

SafeClaw sits between an AI agent (OpenClaw) and the host operating system, providing monitoring, interception, and access control.

```
User prompt ─> OpenClaw Agent ─> SafeClaw ─> OS / Network / MCP
                                    │
                          Dashboard (localhost:54335)
                                    │
                          SQLite  (~/.safeclaw/safeclaw.db)
```

## Security Subsystems

SafeClaw has five independent security subsystems. They do not depend on each other and can produce contradictory results by design (a CRITICAL threat can be auto-approved; a NONE-threat command can be blocked).

### 1. Threat Analysis Engine (passive)

Classifies every agent activity by threat level for display in the UI. **Does not block anything.**

- 10 TC-\* categories (see [Security Analysis](security-analysis.md))
- 200+ regex patterns across 6 pattern groups
- 17 credential-type secret scanner
- Produces `ThreatFinding[]` stored in the `agent_activities` table

### 2. Exec Approval System (active enforcement)

Intercepts shell commands matching a restricted-pattern blocklist. **Blocklist model** -- commands that don't match are auto-approved.

- Gateway sends `exec.approval.requested`
- `ExecApprovalService` checks against `restricted_patterns` (glob matching)
- No match: auto-approve (`allow-once`), respond immediately
- Match: queue as pending, notify UI, start 10-minute timeout
- User decides: Allow Once | Allow Always (removes pattern) | Deny
- Timeout: auto-deny

### 3. Access Control Toggles (tool group blocks)

Enables/disables entire tool groups by modifying OpenClaw's `tools.deny` config.

| Toggle            | OpenClaw mapping                                       |
| ----------------- | ------------------------------------------------------ |
| `filesystem`      | `group:fs`                                             |
| `system_commands` | `group:runtime`                                        |
| `network`         | `group:web` + `browser.enabled`                        |
| `mcp_servers`     | Per-plugin enable/disable + `mcp__<name>` deny entries |

### 4. Skill Scanner (static pre-execution)

Analyzes markdown skill definitions before the agent uses them. 15 SK-\* categories detect hidden content, prompt injection, shell execution, data exfiltration, and more.

### 5. Security Posture (cross-layer health score)

Evaluates 12 security layers with 40+ checks. Computes an overall percentage score (passed / total). Layers: sandbox, filesystem, network, egress-proxy, exec, mcp, gateway, secrets, supply-chain, input-output, monitoring, human-in-loop.

## Data Flow

```
OpenClaw action
    ├─> OpenClawClient (WebSocket gateway, port 18789)
    └─> SessionWatcher  (JSONL files in ~/.openclaw/agents/*/sessions/)
            │
            v
    OpenClawMonitor (central orchestrator)
        ├── classifyActivity()  ─> ThreatFinding[]
        ├── scanForSecrets()    ─> SecretType[]
        ├── DB insert (agent_activities table)
        └── Socket.IO broadcast ─> Frontend
```

## Key Services

| Service                | File                                | Role                                                               |
| ---------------------- | ----------------------------------- | ------------------------------------------------------------------ |
| OpenClawMonitor        | `services/openclaw-monitor.ts`      | Central orchestrator, activity ingestion, session lifecycle        |
| OpenClawClient         | `lib/openclaw-client.ts`            | WebSocket client to gateway (custom binary protocol, Ed25519 auth) |
| SessionWatcher         | `services/session-watcher.ts`       | Monitors JSONL session files, maps 15+ tool types                  |
| ExecApprovalService    | `services/exec-approval-service.ts` | Blocklist enforcement, glob matching, 10-min timeout               |
| AccessControlService   | `services/access-control.ts`        | Derives state from OpenClaw config, applies tool group toggles     |
| SecurityPostureService | `services/security-posture.ts`      | 12-layer health scoring                                            |

## Frontend

React 18 single-page app served by Fastify in production, proxied via Vite in development.

| Route            | Page                 | Purpose                                         |
| ---------------- | -------------------- | ----------------------------------------------- |
| `/`              | DashboardPage        | Stats, threat breakdown, recent activity        |
| `/security`      | SecurityWorkflowPage | Security posture visualization                  |
| `/interception`  | InterceptionPage     | Pending approvals, restricted patterns, history |
| `/sessions`      | SessionsPage         | Session list, activity timeline by runId        |
| `/threats`       | ThreatsPage          | Filter by severity, OWASP refs, remediation     |
| `/skill-scanner` | SkillScannerPage     | Paste-and-scan skill definitions                |
| `/access`        | AccessControlPage    | Category toggles, MCP server toggles, sandbox   |
| `/openclaw`      | OpenClawPage         | Model, gateway, concurrency, plugins            |
| `/settings`      | SettingsPage         | Port, auto-open, version, data dirs             |

**Stack:** React Router DOM 7, Tailwind CSS 4, lucide-react icons, Socket.IO client. No state management library -- React hooks + Socket.IO events.

**Component hierarchy:** `App` > `Layout` (Sidebar + ConnectionStatus) > `Page` > `ActivityDetails` (6 tool-specific renderers: File, Shell, Web, Message, Tool, Unknown).

## Database

SQLite via better-sqlite3 (WAL mode) at `~/.safeclaw/safeclaw.db`. Managed by Drizzle ORM 0.38.

7 tables: `command_logs`, `sessions`, `access_config`, `openclaw_sessions`, `agent_activities`, `restricted_patterns`, `exec_approvals`. See [CLAUDE.md](../.claude/CLAUDE.md) for column-level detail.

Migrations run automatically on startup via `db/migrate.ts`.

## Build Pipeline

```
pnpm build
  1. pnpm build:shared     ─> packages/shared/dist/  (tsc)
  2. vite build             ─> apps/cli/public/       (frontend assets)
  3. tsup                   ─> apps/cli/dist/main.js  (backend bundle, ESM, Node 20)
```

The CLI serves the frontend from `public/` via `@fastify/static`. In dev mode, Vite on `:5173` proxies `/api` and `/socket.io` to the backend on `:54335`.
