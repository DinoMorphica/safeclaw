# Threat Classification System

## Overview

SafeClaw uses a **content-aware** threat classification engine that evaluates AI agent activities based on what they actually do and what data they touch, not merely what type of action they are. A file read is only dangerous if the file contains secrets; a shell command is only critical if it's destructive.

The system is grounded in OWASP LLM Top 10 (2025) and MCP security research (Invariant Labs).

## Design Principles

1. **Content over action** — Threat level is determined by what's IN the content, not the action type. Reading `.env` with API keys = CRITICAL (secrets go to model provider cloud). Reading `README.md` = NONE.
2. **Multiple findings per activity** — A single activity can trigger findings across multiple categories simultaneously (e.g., a shell command that is both destructive AND uses sudo).
3. **Backward-compatible severity** — The single `threatLevel` field (NONE–CRITICAL) is still computed as the max severity across all findings, so existing dashboard/session summary logic works unchanged.
4. **Evidence-based** — Each finding includes the specific evidence string that triggered it, so analysts can verify.

## 10 Threat Categories

| ID | Name | What it detects | OWASP Ref |
|----|------|----------------|-----------|
| TC-SEC | Secret Exposure | API keys, tokens, PEM keys, DB URLs in content previews. These get sent to model provider cloud. | LLM02 |
| TC-EXF | Data Exfiltration | Commands/URLs targeting paste sites, transfer services, ngrok, webhook.site. Code patterns like `fetch(process.env)`. | LLM02 |
| TC-INJ | Prompt Injection Risk | Directive patterns in consumed content (web pages, tool responses): "ignore previous", "you are now", base64-encoded instructions. | LLM01 |
| TC-DES | Destructive Operation | `rm -rf /`, `mkfs`, `dd`, fork bombs, `DROP TABLE`, `TRUNCATE`. | LLM06 |
| TC-ESC | Privilege Escalation | `sudo`, `chmod 777`, `chown root`, `usermod`, `su -`, setuid changes. | LLM06 |
| TC-SUP | Supply Chain Risk | `npm install <pkg>`, `pip install`, `curl | bash`, `brew install`, modifying package.json/requirements.txt/Dockerfile. | LLM03 |
| TC-SFA | Sensitive File Access | `.ssh/`, `.env`, `.aws/credentials`, `.pem`, `.p12`, keychain files. Read vs write severity differs. | LLM02 |
| TC-SYS | System Modification | Writing to `/etc/`, `/usr/bin/`, `/boot/`, `.bashrc`, `.zshrc`, crontab, systemd units. | LLM06 |
| TC-NET | Suspicious Network | Raw IP connections, network commands (`curl POST`, `wget`, `netcat`, `ssh`, `scp`), messaging activity. | LLM02 |
| TC-MCP | MCP/Tool Poisoning | Directive content detected in tool responses that could manipulate agent behavior. | LLM01 |

## Architecture

```
Activity arrives (from SessionWatcher or OpenClawClient)
         │
         ▼
  ┌─────────────────────────┐
  │  classifyActivity()     │  apps/cli/src/lib/threat-classifier.ts
  │  ├── analyzeSecretExposure()     TC-SEC
  │  ├── analyzeDataExfiltration()   TC-EXF
  │  ├── analyzePromptInjection()    TC-INJ
  │  ├── analyzeDestructiveOps()     TC-DES
  │  ├── analyzePrivilegeEscalation()TC-ESC
  │  ├── analyzeSupplyChain()        TC-SUP
  │  ├── analyzeSensitiveFileAccess()TC-SFA
  │  ├── analyzeSystemModification() TC-SYS
  │  ├── analyzeNetworkActivity()    TC-NET
  │  └── analyzeMcpToolPoisoning()   TC-MCP
  └─────────┬───────────────┘
            │
            ▼
  ThreatClassification {
    threatLevel: ThreatLevel       // max(finding severities) or NONE
    findings: ThreatFinding[]      // all triggered findings
    secretsDetected: string[]|null // extracted from TC-SEC findings
  }
            │
            ▼
  OpenClawMonitor
  ├── stores findings as JSON in `threat_findings` column
  ├── emits via Socket.IO with parsed findings
  └── threatLevel feeds into session summaries & dashboard stats
```

## Data Flow

### Backend

1. `OpenClawMonitor.processActivity()` calls `analyzeActivityThreat()` (thin wrapper in `interceptor.ts`)
2. `analyzeActivityThreat()` calls `classifyActivity()` with 6 params: activityType, detail, targetPath, contentPreview, readContentPreview, toolName
3. `classifyActivity()` runs all 10 analyzers independently, aggregates findings
4. Findings are serialized as JSON into `threat_findings` column in SQLite
5. Socket.IO emission includes parsed `threatFindings` array on each `AgentActivity`

### Frontend

1. `securityAnalyzer.ts` checks if `activity.threatFindings` exists
2. If yes: maps `ThreatFinding[]` → `SecurityIndicator[]` with category icons (TC-SEC=key, TC-DES=explosion, etc.), severity colors, and OWASP refs
3. If no (old data): falls back to legacy client-side regex rules
4. `ActivityDetailPanel.tsx` renders findings with category badge (e.g. `TC-SEC`), reason text, and OWASP reference tag

## Severity Determination

Each analyzer assigns severity based on specific evidence:

- **CRITICAL**: Secrets in content, `rm -rf /`, `sudo rm`, writing to `/boot/`, fork bombs
- **HIGH**: Exfiltration URLs, strong prompt injection, `sudo` usage, SSH key access, `curl | bash`
- **MEDIUM**: Weak prompt injection signals, raw IP connections, `npm install`, dependency file writes
- **LOW**: General network commands, build file access, messaging activity

The overall `threatLevel` = max severity across all findings. If no findings, `threatLevel` = NONE.

## Pattern Library

All regex patterns are centralized in `apps/cli/src/lib/threat-patterns.ts`:

- Prompt injection: strong patterns (explicit directives) and weak patterns (behavioral nudges)
- Destructive commands: CRITICAL tier (rm -rf /, mkfs, dd of=/dev) and HIGH tier (rm -rf, git push --force)
- Privilege escalation: 3 tiers (CRITICAL/HIGH/MEDIUM)
- Supply chain: HIGH (curl|bash, pip install) and MEDIUM (npm install, brew install)
- Exfiltration: URL patterns (pastebin, transfer.sh, ngrok) and code patterns (fetch+env, eval+atob)
- Sensitive paths: rules with separate read/write severity levels
- System paths: rules with path-based severity
- Dependency and build/CI file patterns for supply chain detection

## Key Files

| File | Purpose |
|------|---------|
| `apps/cli/src/lib/threat-classifier.ts` | Core engine — 10 analyzer functions + `classifyActivity()` |
| `apps/cli/src/lib/threat-patterns.ts` | All regex patterns organized by threat category |
| `apps/cli/src/lib/secret-scanner.ts` | Secret detection patterns (used by TC-SEC analyzer) |
| `apps/cli/src/interceptor.ts` | Thin wrapper — calls `classifyActivity()`, returns `ActivityThreatResult` |
| `apps/cli/src/services/openclaw-monitor.ts` | Pipeline — passes params, stores/emits findings |
| `apps/web/src/lib/securityAnalyzer.ts` | Frontend — maps findings to UI indicators, legacy fallback |
| `apps/web/src/components/ActivityDetails/ActivityDetailPanel.tsx` | Renders finding cards with category badges |
| `packages/shared/src/types.ts` | `ThreatCategoryId`, `ThreatFinding`, `AgentActivity.threatFindings` |
| `packages/shared/src/schemas.ts` | Zod schemas for runtime validation |
| `apps/cli/src/db/schema.ts` | `threat_findings TEXT` column on `agent_activities` |

## Adding a New Threat Category

1. Add the new `TC-XXX` ID to `ThreatCategoryId` in `packages/shared/src/types.ts`
2. Add regex patterns to `apps/cli/src/lib/threat-patterns.ts`
3. Add analyzer function `analyzeNewCategory()` in `apps/cli/src/lib/threat-classifier.ts`
4. Call the new analyzer from `classifyActivity()`
5. Add icon mapping in `apps/web/src/lib/securityAnalyzer.ts` (`CATEGORY_ICONS`)
6. Rebuild shared: `pnpm build:shared && pnpm typecheck`

## Adding Patterns to Existing Categories

1. Add regex to the appropriate export in `threat-patterns.ts`
2. If needed, add matching logic in the category's analyzer function in `threat-classifier.ts`
3. Typecheck: `pnpm build:shared && pnpm typecheck`

## References

- [OWASP Top 10 for LLM Applications 2025](https://genai.owasp.org/llm-top-10/)
  - LLM01: Prompt Injection
  - LLM02: Sensitive Information Disclosure
  - LLM03: Supply Chain Vulnerabilities
  - LLM06: Excessive Agency
- [Invariant Labs — MCP Security Research](https://invariantlabs.ai/blog/mcp-security-notification-tool-poisoning-attacks)
  - Tool Poisoning Attacks
  - Data Exfiltration via tool descriptions
  - Cross-server credential abuse
