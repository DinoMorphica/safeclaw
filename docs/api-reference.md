# API Reference

SafeClaw exposes a REST API and Socket.IO events. All endpoints are served from the dashboard port (default `54335`).

Type definitions for all payloads are in [`packages/shared/src/types.ts`](../packages/shared/src/types.ts).

## REST API

### Health & Legacy

#### `GET /api/health`

```json
{ "status": "ok", "timestamp": "2026-02-19T00:00:00.000Z" }
```

#### `GET /api/commands`

Legacy intercepted command logs.

| Query Param | Type   | Default | Description |
| ----------- | ------ | ------- | ----------- |
| `limit`     | number | 50      | Max results |

**Response:** `CommandLog[]`

#### `PUT /api/commands/:id/decision`

**Body:** `{ "action": "ALLOW" | "DENY" }`

**Response:** Updated `CommandLog`

#### `GET /api/sessions`

**Response:** `Session[]` (ordered by `startedAt` desc)

### Access Control

#### `GET /api/access-control/state`

Returns the current access control state derived from OpenClaw's config.

**Response:** `AccessControlState` (toggles + MCP server states)

#### `GET /api/config`

Returns raw `access_config` rows from the database (audit trail).

**Response:** `{ id, category, key, value, updatedAt }[]`

#### `PUT /api/config/access`

Toggle a tool category on/off.

**Body:** `{ "category": "filesystem" | "mcp_servers" | "network" | "system_commands", "enabled": boolean }`

**Response:** `AccessControlState`

#### `PUT /api/config/access/mcp-server`

Toggle an individual MCP server.

**Body:** `{ "serverName": string, "enabled": boolean }`

**Response:** `AccessControlState`

### Settings

#### `GET /api/settings`

**Response:** `SafeClawConfig`

#### `PUT /api/settings`

**Body:** `Partial<SafeClawConfig>`

**Response:** Updated `SafeClawConfig`

### OpenClaw Config & Monitoring

#### `GET /api/openclaw/config`

**Response:** `OpenClawConfig` or `{ "error": "OpenClaw config not found" }`

#### `PUT /api/openclaw/config`

**Body:** `Partial<OpenClawConfig>`

**Response:** Updated `OpenClawConfig`

#### `GET /api/openclaw/sessions`

**Response:** `OpenClawSession[]`

#### `GET /api/openclaw/activities`

| Query Param | Type   | Default | Description       |
| ----------- | ------ | ------- | ----------------- |
| `sessionId` | string | —       | Filter by session |
| `limit`     | number | 50      | Max results       |

**Response:** `AgentActivity[]`

#### `GET /api/openclaw/threats`

| Query Param | Type                  | Default | Description               |
| ----------- | --------------------- | ------- | ------------------------- |
| `severity`  | ThreatLevel           | —       | Filter by severity        |
| `resolved`  | `"true"` \| `"false"` | —       | Filter by resolved status |
| `limit`     | number                | 100     | Max results               |

**Response:** `AgentActivity[]` (where `threatLevel != "NONE"`)

#### `PUT /api/openclaw/activities/:id/resolve`

**Body:** `{ "resolved": boolean }`

**Response:** Updated `AgentActivity` or `{ "error": "Activity not found" }`

#### `GET /api/openclaw/status`

**Response:**

```json
{
  "connectionStatus": "connected" | "connecting" | "disconnected" | "not_configured",
  "gatewayPort": 18789,
  "lastEventAt": null,
  "activeSessionCount": 0
}
```

### Exec Approvals

#### `GET /api/exec-approvals/pending`

**Response:** `ExecApprovalEntry[]`

#### `GET /api/exec-approvals/history`

| Query Param | Type   | Default | Description |
| ----------- | ------ | ------- | ----------- |
| `limit`     | number | 50      | Max results |

**Response:** `ExecApprovalEntry[]`

#### `PUT /api/exec-approvals/:id/decision`

**Body:** `{ "decision": "allow-once" | "allow-always" | "deny" }`

**Response:** `{ "ok": true }`

### Restricted Patterns (Blocklist)

#### `GET /api/allowlist`

**Response:** `{ "patterns": [{ "pattern": "sudo *" }, ...] }`

#### `POST /api/allowlist`

**Body:** `{ "pattern": "rm -rf *" }`

**Response:** `{ "patterns": [...] }` (updated list)

#### `DELETE /api/allowlist`

**Body:** `{ "pattern": "rm -rf *" }`

**Response:** `{ "patterns": [...] }` (updated list)

### Security Posture

#### `GET /api/security-posture`

**Response:** `SecurityPosture` -- 12 layers with checks, overall score, timestamps.

### Skill Scanner

#### `POST /api/skill-scanner/scan`

Analyze a skill definition for security issues.

**Body:** `{ "content": string }` (1 to 500K chars)

**Response:** `SkillScanResult` -- findings, severity summary, scan duration.

#### `POST /api/skill-scanner/clean`

Remove detected threats from a skill definition.

**Body:** `{ "content": string }` (1 to 500K chars)

**Response:** `{ "cleanedContent": string, "removedCount": number }`

### SRT (Sandbox Runtime)

#### `GET /api/srt/status`

**Response:** `SrtStatus` -- installed, version, enabled, settingsPath, settings.

#### `PUT /api/srt/toggle`

**Body:** `{ "enabled": boolean }`

**Response:** `SrtStatus`

#### `GET /api/srt/settings`

**Response:** `SrtSettings` or `{ "error": "SRT settings file not found" }`

#### `PUT /api/srt/settings`

**Body:** `Partial<SrtSettings>`

**Response:** Updated `SrtSettings`

#### `POST /api/srt/domains/:list`

Add a domain to the allow or deny list.

| Path Param | Values                |
| ---------- | --------------------- |
| `list`     | `"allow"` or `"deny"` |

**Body:** `{ "domain": "example.com" }`

**Response:** Updated `SrtSettings`

Adding a domain to one list automatically removes it from the other.

#### `DELETE /api/srt/domains/:list`

Remove a domain from the allow or deny list.

| Path Param | Values                |
| ---------- | --------------------- |
| `list`     | `"allow"` or `"deny"` |

**Body:** `{ "domain": "example.com" }`

**Response:** Updated `SrtSettings`

---

## Socket.IO Events

Connect to the Socket.IO server at the dashboard URL (default `http://localhost:54335`).

All event types are defined in `packages/shared/src/types.ts` (`ServerToClientEvents`, `ClientToServerEvents`).

### Server to Client

| Event                            | Payload                               | Description                                                             |
| -------------------------------- | ------------------------------------- | ----------------------------------------------------------------------- |
| `safeclaw:stats`                 | `DashboardStats`                      | Dashboard statistics (command counts, threat breakdown, approval stats) |
| `safeclaw:commandLogged`         | `CommandLog`                          | New or updated command log entry                                        |
| `safeclaw:accessConfig`          | `AccessConfigRow[]`                   | Raw access config rows                                                  |
| `safeclaw:accessControlState`    | `AccessControlState`                  | Current toggle + MCP server state                                       |
| `safeclaw:settingsData`          | `SafeClawConfig`                      | Current SafeClaw settings                                               |
| `safeclaw:openclawConfig`        | `OpenClawConfig`                      | Current OpenClaw configuration                                          |
| `safeclaw:openclawActivity`      | `AgentActivity`                       | New or queried agent activity                                           |
| `safeclaw:openclawSessionUpdate` | `OpenClawSession`                     | Session created/updated                                                 |
| `safeclaw:openclawMonitorStatus` | `OpenClawMonitorStatus`               | Connection status broadcast                                             |
| `safeclaw:threatResolved`        | `AgentActivity`                       | Activity resolution toggled                                             |
| `safeclaw:execApprovalRequested` | `ExecApprovalEntry`                   | New pending approval                                                    |
| `safeclaw:execApprovalResolved`  | `ExecApprovalEntry`                   | Approval decision made                                                  |
| `safeclaw:approvalHistoryBatch`  | `ExecApprovalEntry[]`                 | Batch of historical approvals                                           |
| `safeclaw:allowlistState`        | `{ patterns: { pattern: string }[] }` | Current restricted patterns                                             |
| `safeclaw:srtStatus`             | `SrtStatus`                           | SRT status update                                                       |

### Client to Server

| Event                               | Payload                            | Description                  |
| ----------------------------------- | ---------------------------------- | ---------------------------- |
| `safeclaw:getStats`                 | —                                  | Request dashboard stats      |
| `safeclaw:decision`                 | `{ commandId, action }`            | Legacy command decision      |
| `safeclaw:getRecentCommands`        | `{ limit }`                        | Request recent command logs  |
| `safeclaw:getAccessConfig`          | —                                  | Request access config rows   |
| `safeclaw:getAccessControlState`    | —                                  | Request current access state |
| `safeclaw:toggleAccess`             | `{ category, enabled }`            | Toggle a tool category       |
| `safeclaw:toggleMcpServer`          | `{ serverName, enabled }`          | Toggle an MCP server         |
| `safeclaw:getSettings`              | —                                  | Request SafeClaw settings    |
| `safeclaw:updateSettings`           | `Partial<SafeClawConfig>`          | Update settings              |
| `safeclaw:getOpenclawConfig`        | —                                  | Request OpenClaw config      |
| `safeclaw:updateOpenclawConfig`     | `Partial<OpenClawConfig>`          | Update OpenClaw config       |
| `safeclaw:getOpenclawSessions`      | —                                  | Request all sessions         |
| `safeclaw:getOpenclawActivities`    | `{ sessionId?, limit? }`           | Request activities           |
| `safeclaw:getOpenclawMonitorStatus` | —                                  | Request monitor status       |
| `safeclaw:reconnectOpenclaw`        | —                                  | Trigger gateway reconnect    |
| `safeclaw:resolveActivity`          | `{ activityId, resolved }`         | Toggle threat resolution     |
| `safeclaw:getThreats`               | `{ severity?, resolved?, limit? }` | Request threats              |
| `safeclaw:execDecision`             | `{ approvalId, decision }`         | Exec approval decision       |
| `safeclaw:getPendingApprovals`      | —                                  | Request pending approvals    |
| `safeclaw:getApprovalHistory`       | `{ limit }`                        | Request approval history     |
| `safeclaw:getAllowlist`             | —                                  | Request restricted patterns  |
| `safeclaw:addAllowlistPattern`      | `{ pattern }`                      | Add restricted pattern       |
| `safeclaw:removeAllowlistPattern`   | `{ pattern }`                      | Remove restricted pattern    |
| `safeclaw:getSrtStatus`             | —                                  | Request SRT status           |
| `safeclaw:toggleSrt`                | `{ enabled }`                      | Toggle SRT                   |
| `safeclaw:updateSrtDomains`         | `{ list, action, domain }`         | Add/remove SRT domain        |
| `safeclaw:updateSrtSettings`        | `Partial<SrtSettings>`             | Update SRT settings          |
