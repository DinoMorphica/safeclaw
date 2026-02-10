# SafeClaw – Agent Instructions

## Project Overview

SafeClaw is a **security management dashboard for AI agents**. It monitors, intercepts, and controls what AI agents (specifically OpenClaw) can do on a user's system. Think of it as a firewall between an AI agent and the operating system.

**MVP goal:** Ship a free, local-only tool that any developer can run with `npx safeclaw start` and immediately get three things:

1. **Command Interception** – Block dangerous shell commands before they execute
2. **Session Monitoring** – See everything the agent does in a visual timeline
3. **Access Control** – Toggle what the agent can touch (files, network, MCP servers, etc.)

**Current version:** 0.1.0 (early development). No auth. No premium features. Comprehensive test suite with 46+ tests for core services. The exec approval enforcement layer is implemented and functional — SafeClaw intercepts, queues, and resolves shell command approvals with OpenClaw via a blocklist model. Advanced threat analysis with 10 category-specific analyzers, 200+ threat patterns, and comprehensive secret detection for 15+ credential types.

---

## Monorepo Structure

```
safeclaw-monorepo/
├── apps/
│   ├── cli/            # Backend – Fastify server, SQLite, CLI commands
│   │   ├── bin/safeclaw.js        # npx entry point (shebang → dist/main.js)
│   │   ├── src/
│   │   │   ├── main.ts            # CLI arg parser: start | reset | status | help
│   │   │   ├── interceptor.ts     # Legacy threat engine wrapper
│   │   │   ├── commands/          # start.ts, reset.ts, status.ts
│   │   │   ├── db/                # index.ts, schema.ts, migrate.ts
│   │   │   ├── lib/               # Core utilities
│   │   │   │   ├── threat-classifier.ts    # 10 threat analyzers (TC-SEC, TC-EXF, etc.)
│   │   │   │   ├── threat-patterns.ts      # 200+ regex patterns by category
│   │   │   │   ├── secret-scanner.ts       # 15+ credential type detection
│   │   │   │   ├── threat-remediation.ts   # Context-aware remediation advice
│   │   │   │   ├── openclaw-client.ts      # WebSocket gateway client
│   │   │   │   ├── openclaw-config.ts      # Config file management
│   │   │   │   ├── exec-approvals-config.ts # Exec approvals file utilities
│   │   │   │   ├── banner.ts, config.ts, logger.ts, paths.ts
│   │   │   │   └── session-watcher.ts      # JSONL session file monitoring
│   │   │   ├── server/            # Fastify + Socket.IO
│   │   │   │   ├── index.ts       # Server factory
│   │   │   │   ├── routes.ts      # 23 REST endpoints
│   │   │   │   └── socket.ts      # 18 server→client, 17 client→server events
│   │   │   └── services/
│   │   │       ├── openclaw-monitor.ts         # Central orchestration service
│   │   │       ├── exec-approval-service.ts    # Command interception with blocklist
│   │   │       ├── access-control.ts           # Toggle-based access management
│   │   │       └── __tests__/
│   │   │           ├── exec-approval-service.test.ts  # 730 lines, 46 tests
│   │   │           ├── access-control.test.ts         # 699 lines
│   │   │           └── test-helpers.ts
│   │   ├── drizzle.config.ts
│   │   ├── vitest.config.ts       # Test runner configuration
│   │   ├── tsconfig.json
│   │   └── package.json           # name: "safeclaw"
│   │
│   └── web/            # Frontend – React + Vite + Tailwind
│       ├── src/
│       │   ├── App.tsx            # React Router (7 routes)
│       │   ├── main.tsx           # React entry
│       │   ├── pages/             # 7 pages
│       │   │   ├── DashboardPage.tsx
│       │   │   ├── InterceptionPage.tsx
│       │   │   ├── SessionsPage.tsx
│       │   │   ├── ThreatsPage.tsx              # NEW: Threat center
│       │   │   ├── AccessControlPage.tsx
│       │   │   ├── OpenClawPage.tsx
│       │   │   └── SettingsPage.tsx
│       │   ├── components/        # Layout & specialized components
│       │   │   ├── Layout.tsx, Sidebar.tsx, ConnectionStatus.tsx
│       │   │   └── ActivityDetails/             # Tool-specific renderers
│       │   │       ├── ActivityToolRenderer.tsx
│       │   │       ├── FileOperationRenderer.tsx
│       │   │       ├── ShellCommandRenderer.tsx
│       │   │       ├── WebBrowseRenderer.tsx
│       │   │       ├── MessageRenderer.tsx
│       │   │       ├── ToolCallRenderer.tsx
│       │   │       ├── UnknownRenderer.tsx
│       │   │       ├── ActivityRow.tsx
│       │   │       └── ActivityDetailPanel.tsx
│       │   └── lib/               # Frontend utilities
│       │       ├── socket.ts                    # Socket.IO client
│       │       ├── securityAnalyzer.ts          # Frontend threat analysis
│       │       ├── activityParser.ts            # Activity payload parsing
│       │       ├── activityGrouper.ts           # Interaction grouping (runId)
│       │       └── threat-remediation.ts        # Client-side remediation logic
│       ├── vite.config.ts
│       ├── tsconfig.json, tsconfig.node.json
│       └── package.json           # name: "@safeclaw/web"
│
├── packages/
│   └── shared/         # Shared types and Zod schemas
│       ├── src/
│       │   ├── types.ts           # 40+ TypeScript interfaces & enums
│       │   ├── schemas.ts         # Zod validation schemas
│       │   └── index.ts           # Re-exports everything
│       ├── tsconfig.json
│       └── package.json           # name: "@safeclaw/shared"
│
├── .claude/                       # Claude agent instructions
│   └── CLAUDE.md                  # This file (600+ lines)
├── docs/
│   └── technical_guide.md         # Full product & technical spec
├── pnpm-workspace.yaml
├── tsconfig.base.json
└── package.json                   # Root workspace scripts
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
| Testing | Vitest 2.x | 46+ tests in `apps/cli/src/services/__tests__/` |
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
| `~/.openclaw/exec-approvals.json` | Exec approval allowlist patterns (managed by OpenClaw) |
| `~/.openclaw/agents/*/sessions/*.jsonl` | OpenClaw session journals (monitored by SessionWatcher) |

---

## Database Schema

Seven tables defined in `apps/cli/src/db/schema.ts`:

**command_logs** – Intercepted commands and their status
- `id` (integer PK), `command` (text), `status` (text: ALLOWED|BLOCKED|PENDING)
- `threat_level` (text: NONE|LOW|MEDIUM|HIGH|CRITICAL), `timestamp` (integer)
- `session_id` (text, nullable), `decision_by` (text: user|auto|system, nullable)

**sessions** – SafeClaw monitoring sessions
- `id` (text PK), `started_at` (integer), `ended_at` (integer, nullable)
- `status` (text: ACTIVE|ENDED)

**access_config** – Permission toggles (audit trail for OpenClaw tool-group toggles)
- `id` (integer PK), `category` (text), `key` (text), `value` (text), `updated_at` (integer)
- Default categories: filesystem (on), mcp_servers (on), network (on), system_commands (off)
- **Note:** This table records access control state but is not read for enforcement. The actual enforcement for exec approvals uses `restricted_patterns` (see below). The access toggles modify OpenClaw's `tools.deny` config directly.

**openclaw_sessions** – Tracked OpenClaw agent sessions
- `id` (text PK), `started_at` (integer), `ended_at` (integer, nullable)
- `status` (text), `model` (text, nullable)

**agent_activities** – Individual agent actions within OpenClaw sessions
- `id` (integer PK), `openclaw_session_id` (text), `activity_type` (text)
- `detail` (text), `raw_payload` (text, JSON), `threat_level` (text)
- `timestamp` (integer), `tool_name` (text, nullable), `target_path` (text, nullable)
- `run_id` (text, nullable) – Groups activities by user interaction
- `phase` (text, nullable) – Tool execution phase (call, result, etc.)
- `content_preview` (text, nullable) – Max 10KB content sample from tool results
- `secrets_detected` (text, JSON, nullable) – Array of detected secrets with types and evidence
- `threat_findings` (text, JSON, nullable) – Array of ThreatFinding objects with OWASP refs
- `resolved` (integer, default 0) – Boolean flag for threat resolution
- `resolved_at` (integer, nullable) – Unix timestamp when threat was marked resolved
- Indexed on `openclaw_session_id`, `threat_level`, and `run_id`

**restricted_patterns** – Blocklist patterns for exec approval enforcement
- `id` (integer PK), `pattern` (text, unique), `created_at` (text)
- Contains glob/wildcard patterns like `sudo *`, `rm -rf *`, etc.
- Used by `ExecApprovalService` to decide which commands require manual approval

**exec_approvals** – Records of exec approval requests and their resolutions
- `id` (text PK), `openclaw_session_id` (text), `command` (text)
- `matched_pattern` (text, nullable), `status` (text), `resolved_at` (text, nullable)
- `resolution` (text, nullable), `created_at` (text)

Migration and seeding happen in `apps/cli/src/db/migrate.ts` on server startup.

---

## API Surface

### REST Endpoints (apps/cli/src/server/routes.ts)

**23 REST endpoints organized by domain:**

**Health & Legacy:**
```
GET    /api/health                      → { status, timestamp }
GET    /api/commands?limit=N            → CommandLog[] (legacy)
PUT    /api/commands/:id/decision       → body: { decision, decidedBy } (legacy)
GET    /api/sessions                    → Session[] (SafeClaw sessions)
```

**Access Control:**
```
GET    /api/access-control/state        → AccessControlState with derived MCP server states
PUT    /api/config/access               → body: { category, enabled } - toggle category
PUT    /api/config/access/mcp-server    → body: { serverId, enabled } - toggle individual MCP server
```

**Settings:**
```
GET    /api/settings                    → SafeClawConfig
PUT    /api/settings                    → body: Partial<SafeClawConfig>
```

**OpenClaw Config:**
```
GET    /api/openclaw/config             → OpenClawConfig
PUT    /api/openclaw/config             → body: Partial<OpenClawConfig>
```

**OpenClaw Monitoring:**
```
GET    /api/openclaw/sessions           → OpenClawSession[]
GET    /api/openclaw/activities         → AgentActivity[] with ?sessionId&limit query params
GET    /api/openclaw/threats            → AgentActivity[] with ?severity&resolved&limit filters
PUT    /api/openclaw/activities/:id/resolve → body: { resolved: boolean } - mark threat as resolved
GET    /api/openclaw/status             → { status, connectedSince?, gateway? }
```

**Exec Approvals:**
```
GET    /api/exec-approvals/pending      → ExecApprovalEntry[] (status: pending)
GET    /api/exec-approvals/history      → ExecApprovalEntry[] with ?limit query param
PUT    /api/exec-approvals/:id/decision → body: { decision: 'allow-once'|'allow-always'|'deny' }
```

**Allowlist/Blocklist Management:**
```
GET    /api/allowlist                   → AllowlistState { patterns, lastSync }
POST   /api/allowlist                   → body: { pattern } - add pattern to allowlist
DELETE /api/allowlist                   → body: { pattern } - remove pattern from allowlist
```

### Socket.IO Events (apps/cli/src/server/socket.ts)

**18 Server → Client events:**
- `safeclaw:alert` – Security alerts
- `safeclaw:commandLogged` – Legacy command interception
- `safeclaw:sessionUpdate` – SafeClaw session changes
- `safeclaw:configUpdate` – Configuration changes
- `safeclaw:stats` – Dashboard statistics
- `safeclaw:accessConfig` – Access control state (legacy)
- `safeclaw:accessControlState` – Full access control state with MCP servers
- `safeclaw:settingsData` – SafeClaw settings
- `safeclaw:openclawConfig` – OpenClaw configuration
- `safeclaw:openclawActivity` – New agent activity detected
- `safeclaw:openclawSessionUpdate` – OpenClaw session changes
- `safeclaw:openclawMonitorStatus` – Connection status updates
- `safeclaw:threatResolved` – Threat resolution state changed
- `safeclaw:execApprovalRequested` – New exec approval request
- `safeclaw:execApprovalResolved` – Exec approval decision made
- `safeclaw:approvalHistoryBatch` – Batch of approval history
- `safeclaw:allowlistState` – Allowlist patterns state

**17 Client → Server events:**
- `safeclaw:decision` – Legacy command decision
- `safeclaw:getStats` – Request dashboard stats
- `safeclaw:getRecentCommands` – Request recent commands (legacy)
- `safeclaw:getAccessConfig` – Request access config (legacy)
- `safeclaw:toggleAccess` – Toggle access category
- `safeclaw:toggleMcpServer` – Toggle individual MCP server
- `safeclaw:getSettings` – Request SafeClaw settings
- `safeclaw:updateSettings` – Update SafeClaw settings
- `safeclaw:getOpenclawConfig` – Request OpenClaw config
- `safeclaw:updateOpenclawConfig` – Update OpenClaw config
- `safeclaw:getOpenclawSessions` – Request OpenClaw sessions
- `safeclaw:getOpenclawActivities` – Request agent activities
- `safeclaw:getOpenclawMonitorStatus` – Request connection status
- `safeclaw:reconnectOpenclaw` – Trigger reconnection to gateway
- `safeclaw:resolveActivity` – Mark threat as resolved/unresolved
- `safeclaw:getThreats` – Request threats with filters
- `safeclaw:execDecision` – Submit exec approval decision
- `safeclaw:getPendingApprovals` – Request pending approvals
- `safeclaw:getApprovalHistory` – Request approval history
- `safeclaw:getAllowlist` – Request allowlist state
- `safeclaw:addAllowlistPattern` – Add pattern to allowlist
- `safeclaw:removeAllowlistPattern` – Remove pattern from allowlist

All event types are defined in `packages/shared/src/types.ts` (`ServerToClientEvents`, `ClientToServerEvents`).

---

## Frontend Pages

| Route | Page | Purpose |
|-------|------|---------|
| `/` | DashboardPage | Stats overview: commands, threats, exec approvals; threat breakdown by severity; OpenClaw connection status |
| `/interception` | InterceptionPage | Exec approval management: pending requests (Allow Once/Unrestrict/Deny), approval history, restricted patterns management |
| `/sessions` | SessionsPage | Two tabs: OpenClaw sessions (with activity timeline grouped by interaction/runId) and SafeClaw sessions |
| `/threats` | ThreatsPage | **NEW** - Threat center with filterable threat view (severity + resolved status), summary cards (Critical/High/Medium/Resolved counts), expandable threat cards showing detected secrets, content preview, OWASP-referenced findings, remediation suggestions, and resolve/unresolve toggle |
| `/access` | AccessControlPage | Access control management: 4 category toggles (filesystem, mcp_servers, network, system_commands) + per-MCP-server granular toggles |
| `/openclaw` | OpenClawPage | Edit OpenClaw configuration: model selection, gateway settings, concurrency, WhatsApp channel config |
| `/settings` | SettingsPage | SafeClaw settings: port, auto-open browser toggle, data directory info, version display |

Component hierarchy: `App` → `Layout` (with `Sidebar`) → Page content. Activity details are rendered via `ActivityDetails/` components with tool-specific renderers.

---

## Threat Analysis System

SafeClaw employs a comprehensive, multi-layered threat analysis system that classifies agent activities by threat level (NONE → LOW → MEDIUM → HIGH → CRITICAL) for monitoring and alerting purposes. **Important:** This system does NOT enforce blocking — it only classifies threats for UI display. Actual enforcement happens through the exec approval system (see Exec Approval System section).

### Architecture Overview

The threat analysis system consists of three main components:

1. **threat-classifier.ts** – 10 specialized threat category analyzers
2. **threat-patterns.ts** – 200+ regex patterns organized by threat category
3. **secret-scanner.ts** – Detection engine for 15+ credential types

### Threat Classifiers (10 Categories)

Each classifier analyzes specific threat categories and returns ThreatFinding objects with:
- `categoryId` – Unique identifier (e.g., TC-SEC, TC-EXF)
- `categoryName` – Human-readable name (e.g., "Secret Exposure")
- `severity` – Threat level (NONE/LOW/MEDIUM/HIGH/CRITICAL)
- `evidence` – What triggered the detection
- `reasoning` – Why this is a threat
- `owaspRef` – OWASP Top 10 reference (e.g., "A01:2021 - Broken Access Control")
- `remediation` – Actionable mitigation steps

**The 10 Threat Categories:**

1. **TC-SEC: Secret Exposure**
   - Detects credentials in content sent to cloud services
   - Scans for 15+ secret types (AWS keys, OpenAI tokens, private keys, etc.)
   - Severity: CRITICAL if secrets found in outbound content
   - OWASP: A01:2021 - Broken Access Control

2. **TC-EXF: Data Exfiltration**
   - Identifies data being sent to paste sites, webhooks, or suspicious URLs
   - Monitors: pastebin, gist, hastebin, dpaste, ix.io, paste.ee, etc.
   - Severity: HIGH for paste sites, MEDIUM for webhook URLs
   - OWASP: A01:2021 - Broken Access Control

3. **TC-INJ: Prompt Injection**
   - Detects adversarial instructions in incoming content
   - Patterns: "ignore previous", "disregard instructions", "system override"
   - Severity: CRITICAL for strong patterns, MEDIUM for weak patterns
   - OWASP: A03:2021 - Injection

4. **TC-DES: Destructive Operations**
   - Flags dangerous commands that delete/modify critical data
   - Commands: `rm -rf /`, `DROP TABLE`, `DELETE FROM`, format commands
   - Severity: CRITICAL for root deletion, HIGH for destructive commands
   - OWASP: N/A (operational security)

5. **TC-ESC: Privilege Escalation**
   - Detects attempts to gain elevated privileges
   - Commands: `sudo`, `su`, `usermod`, `chmod 4755` (setuid)
   - Severity: HIGH for privilege escalation attempts
   - OWASP: A01:2021 - Broken Access Control

6. **TC-SUP: Supply Chain Risk**
   - Identifies risky package installations and remote code execution
   - Patterns: `curl | bash`, `wget | sh`, `npm install` with suspicious packages
   - Severity: HIGH for piped execution, MEDIUM for package installs
   - OWASP: A08:2021 - Software and Data Integrity Failures

7. **TC-SFA: Sensitive File Access**
   - Monitors access to credential files and sensitive paths
   - Files: `.ssh/`, `.env`, `.aws/`, `/etc/passwd`, `.git/`, browser profiles
   - Severity: HIGH for credential files, MEDIUM for config files
   - OWASP: A01:2021 - Broken Access Control

8. **TC-SYS: System Modification**
   - Flags modifications to system directories
   - Paths: `/etc/`, `/usr/bin/`, `/System/`, system config files
   - Severity: CRITICAL for system directory writes
   - OWASP: N/A (operational security)

9. **TC-NET: Suspicious Network Activity**
   - Detects raw IP addresses, reverse shells, and network tools
   - Patterns: Raw IPs, `netcat`, `nc -e`, reverse shell commands
   - Severity: HIGH for reverse shells, MEDIUM for raw IPs
   - OWASP: N/A (operational security)

10. **TC-MCP: MCP/Tool Poisoning**
    - Detects malicious instructions in tool responses
    - Looks for prompt injections in MCP server responses
    - Severity: HIGH if injection detected in tool output
    - OWASP: A08:2021 - Software and Data Integrity Failures

### Threat Patterns (200+ Regex Patterns)

Organized in `threat-patterns.ts` by category:

**Prompt Injection Patterns:**
- Strong: `ignore previous`, `disregard all`, `new instructions`, `system override`
- Weak: `forget everything`, `reset context`, `start over`

**Destructive Command Patterns:**
- CRITICAL: `rm -rf /`, `rm -rf /*`, `format C:`, `mkfs`, `:(){:|:&};:`
- HIGH: `rm -rf`, `DROP DATABASE`, `TRUNCATE`, `dd if=/dev/zero`

**Privilege Escalation Patterns:**
- `sudo`, `su -`, `usermod`, `passwd`, `chmod u+s`, `chmod 4755`

**Supply Chain Indicators:**
- `curl.*\|.*bash`, `wget.*\|.*sh`, `npm install -g`, `pip install`
- Suspicious package names with obfuscation patterns

**Exfiltration URL Patterns:**
- 10+ paste sites: pastebin.com, gist.github.com, hastebin.com, dpaste.com, etc.
- Webhook services: hooks.slack.com, discord.com/api/webhooks

**Network Command Patterns:**
- `nc -e`, `netcat.*-e`, `/bin/sh.*>`, `bash -i`, `/dev/tcp/`

**Sensitive Path Patterns (50+ patterns):**
- Credentials: `.ssh/`, `.aws/`, `.gcloud/`, `.azure/`, `.kube/`
- Environment: `.env`, `.env.local`, `.env.production`
- Version control: `.git/`, `.svn/`, `.hg/`
- Databases: `database.db`, `*.sqlite`, `db_backup`
- System: `/etc/passwd`, `/etc/shadow`, `/etc/sudoers`

**System Path Patterns:**
- `/etc/`, `/usr/bin/`, `/usr/sbin/`, `/System/`, `/Library/`, `/var/`

### Secret Scanner (15+ Credential Types)

The `secret-scanner.ts` module detects credentials with high-precision regex patterns:

| Secret Type | Pattern | Evidence |
|------------|---------|----------|
| AWS Access Key | `AKIA[0-9A-Z]{16}` | Full key string |
| OpenAI API Key | `sk-[a-zA-Z0-9]{48}` | Masked string |
| GitHub Token | `ghp_[a-zA-Z0-9]{36}` | Masked string |
| GitLab Token | `glpat-[a-zA-Z0-9]{20}` | Masked string |
| Slack Token | `xoxb-[0-9]{11}-[0-9]{11}-[a-zA-Z0-9]{24}` | Masked string |
| Slack Webhook | `hooks.slack.com/services/T[A-Z0-9]+/B[A-Z0-9]+` | URL |
| Stripe Key | `sk_live_[a-zA-Z0-9]{24}` | Masked string |
| SendGrid Key | `SG\.[a-zA-Z0-9_-]{22}\.[a-zA-Z0-9_-]{43}` | Masked string |
| Twilio Account | `AC[a-z0-9]{32}` | Full string |
| PEM Private Key | `-----BEGIN.*PRIVATE KEY-----` | Key type only |
| Database URL | `postgres://`, `mysql://`, `mongodb://` | URL (credentials masked) |
| JWT Token | `eyJ[a-zA-Z0-9_-]+\.eyJ[a-zA-Z0-9_-]+` | Masked token |
| Basic Auth | `Authorization: Basic [A-Za-z0-9+/=]+` | Masked credentials |
| Password Assignment | `password\s*=\s*['"][^'"]+['"]` | Masked value |
| Generic API Key | `api[_-]?key\s*=\s*['"][^'"]{20,}['"]` | Masked value |

Each detected secret includes:
- `type` – SecretType enum value
- `severity` – Threat level (CRITICAL for most cloud keys)
- `evidence` – Masked or truncated credential string
- `location` – Where it was found (file path, tool name, etc.)

### Activity Flow with Threat Analysis

1. **OpenClaw → WebSocket Gateway** – Agent performs action (file read, shell command, etc.)
2. **OpenClawClient** – Receives event via WebSocket connection
3. **SessionWatcher** – Parses JSONL session files for tool calls/results
4. **OpenClawMonitor** – Orchestrates threat analysis:
   - Extracts content from tool results
   - Runs `classifyThreats()` from threat-classifier
   - Runs `scanForSecrets()` from secret-scanner
   - Determines overall threat level (highest severity across findings)
5. **Database Insert** – Stores activity with:
   - `threat_level` – Overall severity
   - `secrets_detected` – JSON array of detected secrets
   - `threat_findings` – JSON array of ThreatFinding objects
   - `content_preview` – Up to 10KB of content sample
6. **Socket.IO Broadcast** – Real-time notification to frontend
7. **Frontend Display** – Activities shown in Sessions/Threats pages with:
   - Threat badges (color-coded by severity)
   - Expandable details showing findings
   - Remediation suggestions
   - Resolve/unresolve toggle

### Frontend Threat Analysis

The frontend has a parallel analyzer in `apps/web/src/lib/securityAnalyzer.ts` with 9 client-side rules for immediate UI feedback before backend analysis completes. This provides instant visual feedback while activities are streaming in.

### Important: Threat Analysis vs. Enforcement

**Threat Analysis (this system):**
- Passive monitoring and classification
- Does NOT block or prevent actions
- Generates alerts and UI indicators
- Provides remediation guidance

**Exec Approval System (enforcement):**
- Active command interception
- Blocks commands matching restricted patterns
- Requires user approval for flagged commands
- Independent from threat classification

A command can have a CRITICAL threat level but still be auto-approved if it's not on the restricted patterns blocklist. Conversely, a NONE-threat command can be blocked if it matches a restricted pattern.

---

## Exec Approval System (Enforcement Layer)

The exec approval system is the active enforcement layer, implemented in `apps/cli/src/services/exec-approval-service.ts`. It uses a **blocklist model**: commands that match a restricted pattern are queued for manual user approval; all other commands are auto-approved.

### Flow

1. OpenClaw sends an `exec.approval.requested` event via WebSocket when it wants to run a shell command
2. `ExecApprovalService.handleRequest()` checks the command against the `restricted_patterns` table
3. **No match** → auto-approved immediately, `exec.approval.resolve` sent back to OpenClaw with `allow-once`
4. **Match found** → queued as pending, UI notified via Socket.IO (`safeclaw:execApproval`)
5. User sees the pending approval on the Interception page and chooses: Allow Once, Unrestrict (remove the pattern), or Deny
6. SafeClaw sends `exec.approval.resolve` back to the OpenClaw gateway with the decision
7. OpenClaw obeys the decision

### Key files

- `apps/cli/src/services/exec-approval-service.ts` – Core service: pattern matching, queuing, resolution
- `apps/cli/src/server/socket.ts` – Socket.IO event handlers for approval UI interactions
- `apps/web/src/pages/InterceptionPage.tsx` – Frontend approval UI
- `apps/cli/src/db/schema.ts` – `restricted_patterns` and `exec_approvals` tables

### Important distinction: Two separate security systems

1. **Threat analysis engine** (`interceptor.ts`, `securityAnalyzer.ts`) — Classifies activities by threat level (NONE through CRITICAL) for display purposes. Does not block anything.
2. **Exec approval service** (`exec-approval-service.ts`) — Active enforcement. Actually blocks commands matching restricted patterns until user approves.

These systems are independent. A command can have a HIGH threat classification from the threat engine but still be auto-approved by the exec approval service if it doesn't match any restricted pattern.

---

## Access Control System

The Access Control page (`/access`) provides toggles for filesystem, mcp_servers, network, and system_commands. These toggles work by modifying OpenClaw's own config file (`~/.openclaw/openclaw.json`), specifically the `tools.deny` array, via `apps/cli/src/services/access-control.ts`.

### How it works

- Each toggle maps to an OpenClaw tool group (e.g., `system_commands` → `group:runtime`)
- Toggling **off** adds the group to OpenClaw's `tools.deny` list, preventing OpenClaw from using those tools entirely
- Toggling **on** removes the group from the deny list
- The `access_config` database table records the toggle state as an audit trail

### Important: Access toggles and exec approvals are independent

The access control toggles and the exec approval system operate on completely different mechanisms:

| Aspect | Access Control Toggles | Exec Approval System |
|--------|----------------------|---------------------|
| Mechanism | Modifies OpenClaw's `tools.deny` config | Intercepts `exec.approval` events |
| Granularity | Entire tool groups (all-or-nothing) | Individual command patterns |
| Data source | OpenClaw's config file | `restricted_patterns` table |
| Effect | Prevents OpenClaw from even attempting to use tools | Queues specific commands for user review |

If the System Commands toggle is **off**, OpenClaw cannot use runtime tools at all (they're in the deny list). If it's **on**, OpenClaw can use runtime tools, but individual commands may still be caught by the exec approval blocklist.

---

## OpenClaw Integration

SafeClaw connects to OpenClaw via WebSocket at `localhost:18789` (configurable in config). Authentication uses Ed25519 keys from `~/.openclaw/identity/device.json` and tokens from `~/.openclaw/openclaw.json`.

The client (`apps/cli/src/lib/openclaw-client.ts`) subscribes to events: `agent`, `chat`, `lifecycle`, `exec.approval`. The monitor service (`apps/cli/src/services/openclaw-monitor.ts`) parses these into structured activities and persists them.

SafeClaw can also read and modify OpenClaw's config file at `~/.openclaw/openclaw.json` using deep merge logic in `apps/cli/src/lib/openclaw-config.ts`.

---

## SessionWatcher (Session File Monitoring)

The SessionWatcher service (`apps/cli/src/lib/session-watcher.ts`) provides real-time monitoring of OpenClaw's JSONL session journal files at `~/.openclaw/agents/*/sessions/*.jsonl`. This complements WebSocket monitoring by capturing detailed tool calls and results directly from session logs.

### How It Works

1. **File Discovery** – Watches OpenClaw agents directory for new session files
2. **JSONL Parsing** – Reads and parses journal entries line-by-line
3. **Tool Extraction** – Identifies tool calls and tool results from journal entries
4. **Content Extraction** – Extracts content from tool results (file reads, command output, etc.)
5. **Content Caching** – Caches read content for correlation with write operations
6. **Activity Enrichment** – Emits enriched activities with content previews

### Tool Mapping (15+ Tools)

SessionWatcher maps OpenClaw tool names to SafeClaw activity types:

| OpenClaw Tool | SafeClaw Activity Type |
|--------------|---------------------|
| `read_file` | FILE_READ |
| `write_file` | FILE_WRITE |
| `search_files` | FILE_SEARCH |
| `list_directory` | FILE_LIST |
| `execute_command` | COMMAND_EXECUTION |
| `web_search` | WEB_SEARCH |
| `fetch_url` | WEB_BROWSE |
| `send_message` | MESSAGE_SENT |
| `receive_message` | MESSAGE_RECEIVED |
| `memory_store` | MEMORY_OPERATION |
| `memory_retrieve` | MEMORY_OPERATION |
| `mcp_*` | MCP_TOOL_CALL |

### Content Preview Extraction

SessionWatcher extracts content previews (max 10KB) from tool results:

- **File Reads** – First 10KB of file content
- **Command Output** – stdout/stderr output (truncated)
- **Web Responses** – HTTP response bodies
- **MCP Results** – Tool-specific output

### Read/Write Content Correlation

For write operations, SessionWatcher:
1. Checks if the target path was recently read (cache lookup)
2. Includes both "before" (cached read content) and "after" (write content) in preview
3. Enables diff views in the frontend (FileOperationRenderer)
4. Cache expires after 5 minutes to prevent memory bloat

### Integration with OpenClawMonitor

SessionWatcher events are consumed by OpenClawMonitor, which:
- Performs threat analysis on extracted content
- Enriches activities with threat findings
- Stores activities in database with content previews
- Broadcasts to frontend via Socket.IO

---

## Threat Remediation System

The threat remediation system (`apps/cli/src/lib/threat-remediation.ts`) provides context-aware, actionable advice for mitigating detected threats. Each of the 10 threat categories has category-specific remediation logic that adapts based on the evidence.

### Remediation Strategy Types

1. **Immediate Actions** – Steps to take right now
2. **Prevention** – How to avoid this threat in the future
3. **Policy Recommendations** – What rules/patterns to add
4. **Tool Configuration** – Suggested access control changes

### Per-Category Remediation Logic

**TC-SEC: Secret Exposure**
- Rotate exposed credentials immediately
- Remove secrets from code/files
- Use environment variables or secret managers
- Add secret patterns to pre-commit hooks
- If cloud keys: Check CloudTrail/audit logs for unauthorized use

**TC-EXF: Data Exfiltration**
- Block paste site URLs in network policy
- Review what data was sent
- Add exfiltration URLs to blocklist
- Restrict network access for agents
- Consider air-gapped execution for sensitive tasks

**TC-INJ: Prompt Injection**
- Validate and sanitize all external inputs
- Use structured outputs instead of free-form text
- Implement input length limits
- Add injection patterns to MCP response filters
- Review MCP server sources for trust

**TC-DES: Destructive Operations**
- Add command to restricted patterns (if not already blocked)
- Enable backup/snapshot before destructive ops
- Require manual approval for all destructive commands
- Implement command dry-run mode
- Review system state before and after

**TC-ESC: Privilege Escalation**
- Add privilege escalation commands to blocklist
- Review sudo logs for unauthorized attempts
- Configure passwordless sudo restrictions
- Run agents with minimal privileges (non-root)
- Use capabilities instead of setuid where possible

**TC-SUP: Supply Chain Risk**
- Review package contents before installation
- Use lock files for all dependencies
- Pin versions explicitly
- Add supply chain patterns to blocklist
- Scan packages with tools like Snyk/Dependabot

**TC-SFA: Sensitive File Access**
- Restrict file system access to non-sensitive directories
- Use read-only mounts where possible
- Enable file access logging
- Move sensitive files outside agent workspace
- Encrypt sensitive data at rest

**TC-SYS: System Modification**
- Block all system directory writes
- Run agents in containers/sandboxes
- Use immutable infrastructure patterns
- Require manual approval for system changes
- Enable system integrity monitoring (AIDE, Tripwire)

**TC-NET: Suspicious Network Activity**
- Block raw IP connections
- Use allowlist for permitted domains
- Run agents in network-isolated environments
- Monitor outbound connections
- Implement network egress filtering

**TC-MCP: MCP/Tool Poisoning**
- Audit MCP server sources and permissions
- Validate MCP responses against schema
- Use trusted MCP servers only
- Implement response filtering/sanitization
- Monitor MCP server behavior for anomalies

### Dynamic Remediation

Remediation advice adapts based on evidence:

```typescript
// Example: If AWS key detected, suggest AWS-specific actions
if (secretsDetected.some(s => s.type === 'aws_access_key')) {
  return [
    "Rotate AWS access key immediately via IAM console",
    "Check CloudTrail logs for unauthorized API calls",
    "Consider using AWS IAM roles instead of static keys"
  ];
}
```

### Frontend Integration

The ThreatsPage displays remediation advice in threat cards:
- Expandable "Remediation" section
- Actionable bullet-point advice
- Links to relevant documentation (when applicable)
- Copy-to-clipboard functionality for command snippets

---

## Activity Resolution System

The activity resolution system allows users to mark threats as "resolved" or "unresolved", providing a workflow for threat triage and tracking remediation progress.

### Database Schema

Activities have resolution tracking fields:
- `resolved` (integer) – Boolean flag (0 = unresolved, 1 = resolved)
- `resolved_at` (integer) – Unix timestamp when marked resolved

### API Endpoints

```
PUT /api/openclaw/activities/:id/resolve
Body: { resolved: boolean }
```

### Socket.IO Events

**Server emits:**
- `safeclaw:threatResolved` – When resolution state changes

**Client emits:**
- `safeclaw:resolveActivity` – Request to change resolution state

### Frontend UI

**ThreatsPage:**
- Filter threats by resolution status (All | Unresolved | Resolved)
- Summary cards show resolved count
- Resolve/Unresolve toggle in threat cards
- Resolved threats greyed out with timestamp

**SessionsPage:**
- Activities show resolution badge
- Inline resolve/unresolve action

### Use Cases

1. **Threat Triage** – Mark false positives as resolved
2. **Remediation Tracking** – Track which threats have been addressed
3. **Audit Trail** – Historical record of when threats were resolved
4. **Metrics** – Calculate resolution rate and average time-to-resolve

### Filtering

The `/api/openclaw/threats` endpoint supports resolution filtering:
```
GET /api/openclaw/threats?resolved=false  // Unresolved only
GET /api/openclaw/threats?resolved=true   // Resolved only
GET /api/openclaw/threats                 // All threats
```

---

## Interaction Grouping (runId-based)

Activities are grouped by "interaction" using the `runId` field, which represents a single user message/request to the agent. This provides a chronological, conversation-like view of agent behavior.

### How runId Works

1. **Agent Receives User Message** – OpenClaw assigns a unique `runId`
2. **Multiple Tool Calls** – All tool calls in response to that message share the same `runId`
3. **Activity Storage** – `runId` stored in `agent_activities.run_id` field
4. **Frontend Grouping** – Activities with same `runId` displayed together

### Database Indexing

The `agent_activities` table has an index on `run_id` for efficient querying:
```sql
CREATE INDEX idx_agent_activities_run_id ON agent_activities(run_id);
```

### Frontend Display

**SessionsPage (OpenClaw Sessions tab):**
- Activities grouped by `runId`
- Each group shown as an expandable card
- Group header shows:
  - Timestamp of first activity in group
  - Summary of activity types (e.g., "3 file reads, 1 command execution")
  - Highest threat level in group
- Click to expand and see all activities in the interaction

### Activity Grouper Logic

The `apps/web/src/lib/activityGrouper.ts` util handles grouping:

```typescript
// Groups activities by runId, sorts chronologically
function groupActivitiesByInteraction(activities: AgentActivity[]) {
  const grouped = new Map<string, AgentActivity[]>();

  activities.forEach(activity => {
    const runId = activity.runId || 'unknown';
    if (!grouped.has(runId)) {
      grouped.set(runId, []);
    }
    grouped.get(runId)!.push(activity);
  });

  // Sort groups by timestamp of first activity
  return Array.from(grouped.entries())
    .sort(([, a], [, b]) => b[0].timestamp - a[0].timestamp);
}
```

### Benefits

1. **Contextual Understanding** – See all actions taken in response to a single user request
2. **Threat Correlation** – Understand how multiple activities relate to each other
3. **Audit Trail** – Clear timeline of what the agent did for each user interaction
4. **Better UX** – Less overwhelming than flat activity list

---

## Content Preview System

The content preview system extracts and stores samples of content from agent activities, enabling detailed inspection and diff views in the UI.

### Extraction Logic

**Max Size:** 10KB per activity (configurable via `MAX_CONTENT_PREVIEW_SIZE`)

**Sources:**
- **File Reads** – File content from `read_file` tool results
- **File Writes** – Content written to file from `write_file` tool inputs
- **Command Output** – stdout/stderr from `execute_command` tool results
- **Web Responses** – HTTP response bodies from `fetch_url` tool results
- **MCP Responses** – Tool-specific output from MCP server calls

**Storage:** `agent_activities.content_preview` (TEXT column, nullable)

### Truncation Strategy

Content exceeding 10KB is truncated with indication:
```
[First 10KB of content shown]
... [Content truncated - 45KB remaining]
```

### Read/Write Correlation

For write operations, SessionWatcher correlates with previous reads:

1. User requests: "Update the README, fix the typo"
2. Agent reads `/path/to/README.md` → Content cached with runId
3. Agent writes to `/path/to/README.md` → Lookup cache by path
4. Activity stored with both "before" and "after" content
5. Frontend renders side-by-side diff

### Frontend Renderers

**FileOperationRenderer** (apps/web/src/components/ActivityDetails/FileOperationRenderer.tsx):
- Shows file reads with syntax highlighting
- Shows file writes with before/after diff
- Expandable/collapsible content sections
- Line numbers for code files

**ShellCommandRenderer**:
- Shows command execution with output
- Separates stdout vs stderr
- Exit code display
- Expandable output section

**WebBrowseRenderer**:
- Shows URL and HTTP status
- Preview of response body
- Headers display
- Content type detection

### Privacy Considerations

Content preview extraction respects privacy:
- Secrets are NOT included in plaintext (detected and masked)
- `.env` files show structure but mask values
- Binary files not extracted (just metadata)
- Large files truncated to prevent memory issues

### Performance

- Content extraction happens async (doesn't block activity ingestion)
- Old content previews can be pruned (retention policy, future enhancement)
- Database vacuuming recommended for long-running instances

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

## Known Gaps and Future Enhancements

These items are partially implemented or need further development:

### System Architecture

- **Threat engine → enforcement disconnect**: The threat analysis system classifies activities by threat level but does NOT automatically add high-threat patterns to the exec approval blocklist. High-threat activities are only flagged in the UI. Consider adding a feature to automatically suggest or add blocklist patterns based on threat classifications.

- **Access control → exec approval coordination**: The access control toggles (modifying OpenClaw's `tools.deny` config) and the exec approval system (restricted patterns blocklist) operate independently with no coordination. If System Commands toggle is off, exec approvals never fire because OpenClaw can't use runtime tools at all. Consider adding UI indicators to show when access controls make exec approvals redundant.

### Testing

- **Backend test coverage**: Comprehensive test suite exists for ExecApprovalService (730 lines, 46 tests) and AccessControlService (699 lines), covering pattern matching, auto-approve, manual approval, unrestrict, re-restrict with OpenClaw sync, timeout handling, stats, and concurrency. No tests exist for:
  - OpenClawMonitor service
  - SessionWatcher service
  - Threat classification engine
  - Secret scanner
  - API routes (integration tests)
  - Socket.IO event handlers

- **Frontend tests**: No tests exist for React components, pages, or frontend utilities.

### Session Management

- **SafeClaw session lifecycle**: SafeClaw sessions in the `sessions` table are not automatically created/ended. The table exists but is not currently used. OpenClaw sessions are fully tracked.

- **Session correlation**: Activities are not currently linked to SafeClaw sessions (only to OpenClaw sessions via `openclaw_session_id`).

### UI/UX

- **Error boundaries**: No React error boundaries or fallback UI for component failures. App crashes on unexpected errors instead of graceful degradation.

- **Loading states**: Some pages lack proper loading skeletons/spinners during data fetches.

- **Empty states**: Improved empty state designs needed for pages with no data.

### Data Management

- **Export functionality**: No CSV/JSON export for:
  - Activity logs
  - Threat reports
  - Exec approval history
  - Audit trails

- **Data retention**: No automatic pruning of old activities, logs, or content previews. Database can grow indefinitely.

- **Database optimization**: No scheduled vacuum/optimize operations for SQLite.

### Security & Performance

- **Rate limiting**: No rate limiting on API endpoints (local-only tool, so lower priority).

- **Input validation**: API endpoints use Zod for validation, but some endpoints lack schema validation.

- **Content preview limits**: 10KB limit per activity prevents memory bloat, but no global limit on total stored content.

### Monitoring & Observability

- **Metrics collection**: No Prometheus/OpenTelemetry integration for operational metrics.

- **Health checks**: Basic `/api/health` endpoint exists but doesn't check database, OpenClaw connection, or SessionWatcher health.

- **Performance monitoring**: No query performance tracking or slow query logs.

### Documentation

- **API documentation**: No OpenAPI/Swagger spec for REST endpoints.

- **User guide**: No end-user documentation beyond technical README.

- **Architecture diagrams**: No visual system architecture diagrams.

### Future Feature Ideas

These are NOT blocking MVP but could enhance the product:

- **Threat severity thresholds**: Configurable thresholds for auto-blocking threats above certain severity
- **Custom threat rules**: User-defined threat patterns and classifications
- **Notification system**: Email/Slack/webhook notifications for critical threats
- **Multi-agent support**: Track multiple OpenClaw agents simultaneously
- **Historical analytics**: Trend analysis, threat patterns over time
- **Threat intelligence feeds**: Integration with CVE databases, malware signatures
- **Sandbox mode**: Dry-run mode where agents can't execute real commands
- **Approval workflows**: Multi-user approval chains for sensitive operations
- **Policy templates**: Pre-built security policies for different risk profiles
- **Integration testing**: E2E tests with real OpenClaw instance

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
pnpm test                       # Run test suite (exec approval service)

# Clean
pnpm clean                      # Remove all dist/ and public/

# Database
cd apps/cli && pnpm db:push     # Push schema changes
cd apps/cli && pnpm db:studio   # Visual DB inspector

# Production-like
cp -r apps/web/dist/* apps/cli/public/ && node apps/cli/bin/safeclaw.js start
```
