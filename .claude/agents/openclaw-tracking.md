# OpenClaw Activity Tracking Architecture

## Overview

SafeClaw tracks OpenClaw AI agent activities using a **dual-source** approach because the gateway WebSocket does NOT broadcast tool call events.

## Event Sources

### Source 1: Gateway WebSocket (real-time, limited)

Connects to `ws://127.0.0.1:{port}` (default 18789) using Ed25519 device auth.

**Events received:**
- `agent` with `stream=lifecycle` — session start/end (phase: start/end/error)
- `agent` with `stream=assistant` — LLM text streaming (skipped, not security-relevant)
- `chat` — final message delivery (WhatsApp, agent responses)
- `exec.approval.requested` — command approval requests
- `tick` — keepalive
- `presence` — online status

**Events NOT received:**
- `agent` with `stream=tool` — tool invocations (file reads, writes, shell commands). These are processed internally by the `[agent/embedded]` subsystem but **never broadcast** to WebSocket clients. This was confirmed via gateway log analysis.

### Source 2: Session JSONL Files (complete, file-tailed)

OpenClaw stores complete interaction histories at:
```
~/.openclaw/agents/{agentName}/sessions/{sessionId}.jsonl
```

Active sessions are listed in:
```
~/.openclaw/agents/{agentName}/sessions/sessions.json
```

**JSONL entry types:**
```jsonl
{"type":"session","id":"...","timestamp":"...","cwd":"..."}
{"type":"model_change","id":"...","modelId":"claude-haiku-4-5"}
{"type":"message","id":"...","parentId":"...","message":{"role":"user","content":[{"type":"text","text":"..."}]}}
{"type":"message","id":"...","parentId":"...","message":{"role":"assistant","content":[{"type":"toolCall","id":"toolu_...","name":"read","arguments":{"file_path":"/path"}}]}}
{"type":"message","id":"...","parentId":"...","message":{"role":"toolResult","toolCallId":"toolu_...","content":[{"type":"text","text":"FULL FILE CONTENT"}]}}
```

The `parentId` chain creates a tree structure. Each `role: "user"` message starts a new interaction run.

## Architecture

```
┌─────────────────┐     ┌──────────────────┐
│ Gateway WS      │     │ Session JSONL     │
│ (chat/lifecycle)│     │ (tool calls+content)│
└────────┬────────┘     └────────┬───────────┘
         │                       │
    OpenClawClient         SessionWatcher
         │                       │
         └───────┬───────────────┘
                 │
         OpenClawMonitor
         ├── analyzeActivityThreat() → classifyActivity()
         │   ├── 10 threat category analyzers (see threat-classification.md)
         │   └── scanForSecrets() (via TC-SEC analyzer)
         ├── DB insert (agent_activities + threat_findings JSON)
         └── Socket.IO emit → React dashboard
```

## Interaction Grouping

Activities are grouped by `runId`:
- Session watcher: Uses the `id` of the nearest preceding `role: "user"` message
- Gateway events: Extracts `payload.runId` from chat events

All tool calls between two user messages belong to the same interaction run.

## Secret Scanning

Content from tool results is scanned for:

| Pattern | Type | Severity |
|---------|------|----------|
| `AKIA[0-9A-Z]{16}` | AWS_ACCESS_KEY | CRITICAL |
| `sk-[a-zA-Z0-9]{20,}` | OPENAI_API_KEY | CRITICAL |
| `ghp_[a-zA-Z0-9]{36}` | GITHUB_TOKEN | CRITICAL |
| `-----BEGIN.*PRIVATE KEY-----` | PEM_PRIVATE_KEY | CRITICAL |
| `[rs]k_(live\|test)_...` | STRIPE_KEY | CRITICAL |
| `xox[bpars]-...` | SLACK_TOKEN | HIGH |
| `postgres://...@...` | DATABASE_URL | HIGH |
| `PASSWORD=...` | PASSWORD_IN_ENV | HIGH |
| `eyJ...` (JWT) | JWT_TOKEN | MEDIUM |

Content is truncated to 10KB before storage.

## Read→Write Content Association

When an agent reads a file then edits it within the same interaction (runId), the session watcher automatically associates the read content with the write activity:

- `recentReadContent` map in `SessionWatcher` caches content keyed by `"{runId}:{targetPath}"` when `file_read` results arrive
- When a `file_write` result arrives for the same file path + runId, the cached read content is attached as `readContentPreview`
- The cache is cleared when a new user message starts a new interaction
- The frontend `FileOperationRenderer` displays this as "Original Content (before edit)" on write activities

## Key Files

- `apps/cli/src/lib/openclaw-client.ts` — Gateway WebSocket client
- `apps/cli/src/services/session-watcher.ts` — JSONL file tailer
- `apps/cli/src/services/openclaw-monitor.ts` — Combines both sources, persists to DB
- `apps/cli/src/lib/secret-scanner.ts` — Secret pattern detection
- `apps/cli/src/lib/threat-classifier.ts` — Content-aware threat classifier (10 categories)
- `apps/cli/src/lib/threat-patterns.ts` — All regex patterns for threat detection
- `apps/cli/src/interceptor.ts` — Thin wrapper calling classifier
- `apps/cli/src/db/schema.ts` — `agent_activities` table with `run_id`, `content_preview`, `read_content_preview`, `secrets_detected`, `threat_findings`
