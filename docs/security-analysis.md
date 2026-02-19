# Security Analysis

How SafeClaw detects and categorizes security threats across three analysis engines.

## Detection vs. Enforcement

SafeClaw separates detection from enforcement:

- **Detection** (informational): Threat Analysis Engine and Skill Scanner classify activities and content by severity. They produce findings for display but do not block anything.
- **Enforcement** (active): Exec Approval System blocks shell commands matching the restricted-pattern blocklist. Access Control Toggles disable entire tool groups.

A CRITICAL threat can be auto-approved (not in the blocklist). A NONE-severity command can be blocked (matches a restricted pattern).

---

## Runtime Threat Analysis

The threat classifier (`lib/threat-classifier.ts`) runs 10 independent analyzers on every agent activity. Each produces `ThreatFinding` objects with: `categoryId`, `categoryName`, `severity`, `reason`, `evidence`, `owaspRef`.

### 10 TC-\* Categories

| ID     | Name                  | Detects                                                   | Severity         | OWASP        |
| ------ | --------------------- | --------------------------------------------------------- | ---------------- | ------------ |
| TC-SEC | Secret Exposure       | Credentials in content sent to model provider             | CRITICAL         | LLM02        |
| TC-EXF | Data Exfiltration     | Paste sites, webhooks, code exfil patterns, obfuscation   | CRITICAL--MEDIUM | LLM02, LLM05 |
| TC-INJ | Prompt Injection      | Adversarial instructions in consumed content              | HIGH--MEDIUM     | LLM01        |
| TC-DES | Destructive Ops       | `rm -rf /`, `DROP TABLE`, fork bombs, destructive SQL     | CRITICAL--MEDIUM | LLM06        |
| TC-ESC | Privilege Escalation  | `sudo`, `su`, `usermod`, `chmod` setuid, SUID exploits    | CRITICAL--MEDIUM | LLM06        |
| TC-SUP | Supply Chain Risk     | `curl\|bash`, `npm install`, dependency/CI file edits     | HIGH--MEDIUM     | LLM03        |
| TC-SFA | Sensitive File Access | `.ssh/`, `.env`, `.aws/`, `/etc/passwd`, browser profiles | HIGH--MEDIUM     | LLM02        |
| TC-SYS | System Modification   | Writes to `/etc/`, `/usr/bin/`, `/System/`, `/Library/`   | CRITICAL--HIGH   | LLM06        |
| TC-NET | Suspicious Network    | Raw IP URLs, network commands, external messages          | MEDIUM--LOW      | —            |
| TC-MCP | MCP/Tool Poisoning    | Agent-directive content in tool responses                 | HIGH             | LLM01        |

### Pattern Library

`lib/threat-patterns.ts` organizes 200+ regex patterns into groups:

| Group                            | Examples                                                            |
| -------------------------------- | ------------------------------------------------------------------- |
| Prompt injection (strong)        | "ignore previous instructions", "new instructions:"                 |
| Prompt injection (weak)          | "act as", "pretend you are"                                         |
| Destructive (critical)           | `rm -rf /`, `:(){:\|:&};:`, `mkfs`, `dd if=/dev/zero`               |
| Destructive (high)               | `DROP TABLE`, `DELETE FROM`, `TRUNCATE`                             |
| Privilege (critical/high/medium) | `sudo rm`, `chmod 4755`, `chown root`, `usermod`                    |
| Supply chain (high/medium)       | `curl\|bash`, `npm install -g`, `pip install`                       |
| Exfiltration URLs                | pastebin.com, transfer.sh, ngrok.io, webhook.site, etc.             |
| Network commands                 | curl, wget, nc, netcat patterns                                     |
| Code exfiltration                | `fetch()` with env vars, `XMLHttpRequest`, `navigator.sendBeacon`   |
| Obfuscation                      | `atob()`, `Buffer.from(base64)`, `String.fromCharCode`, hex escapes |
| Sensitive paths                  | `.ssh/`, `.aws/`, `.env`, `id_rsa`, browser credential stores       |
| System paths                     | `/etc/`, `/usr/bin/`, `/System/`, `/Library/LaunchDaemons/`         |
| Dependency files                 | `package.json`, `requirements.txt`, `Gemfile`, `go.mod`             |
| Build/CI files                   | `Dockerfile`, `.github/workflows/`, `Jenkinsfile`, `.gitlab-ci.yml` |

### Secret Scanner

`lib/secret-scanner.ts` detects 17 credential types:

| Type              | Pattern                                                  | Severity |
| ----------------- | -------------------------------------------------------- | -------- |
| AWS_ACCESS_KEY    | `AKIA[0-9A-Z]{16}`                                       | CRITICAL |
| AWS_SECRET_KEY    | `aws_secret_access_key=...`                              | CRITICAL |
| OPENAI_API_KEY    | `sk-[a-zA-Z0-9]{20,}`                                    | CRITICAL |
| GITHUB_TOKEN      | `ghp_`, `github_pat_`, `gho_` prefixes                   | CRITICAL |
| GITLAB_TOKEN      | `glpat-` prefix                                          | CRITICAL |
| PEM_PRIVATE_KEY   | `-----BEGIN ... PRIVATE KEY-----`                        | CRITICAL |
| STRIPE_KEY        | `sk_live_`, `rk_live_`, `sk_test_`                       | CRITICAL |
| SENDGRID_KEY      | `SG.xxx.xxx`                                             | CRITICAL |
| TWILIO_KEY        | `SK[a-f0-9]{32}`                                         | CRITICAL |
| SLACK_TOKEN       | `xox[bpars]-` prefix                                     | HIGH     |
| SLACK_WEBHOOK     | `hooks.slack.com/services/`                              | HIGH     |
| DATABASE_URL      | `postgres://`, `mysql://`, `mongodb://` with credentials | HIGH     |
| BASIC_AUTH_HEADER | `Authorization: Basic ...`                               | HIGH     |
| PASSWORD_IN_ENV   | `PASSWORD=`, `SECRET=`, `API_KEY=` patterns              | HIGH     |
| JWT_TOKEN         | `eyJ...eyJ...` (three dot-separated base64 segments)     | MEDIUM   |
| GENERIC_API_KEY   | `api_key=` or `apikey=` patterns                         | MEDIUM   |
| GENERIC_SECRET    | `secret=` or `private_key=` patterns                     | MEDIUM   |

### Activity Flow

```
Agent activity arrives
    │
    ├── classifyActivity(input)
    │     ├── 10 analyzers run independently
    │     ├── Each returns ThreatFinding[]
    │     └── Overall threatLevel = max severity across all findings
    │
    ├── scanForSecrets(contentPreview)
    │     └── Returns unique secret types + max severity
    │
    ├── DB insert: agent_activities row
    │     (threat_level, threat_findings JSON, secrets_detected JSON, content_preview)
    │
    └── Socket.IO broadcast: safeclaw:openclawActivity
```

---

## Skill Scanner (Static Analysis)

The skill scanner (`lib/skill-scanner.ts`) analyzes markdown skill definitions before an agent uses them. It runs 15 analyzers across content submitted via the API.

### 15 SK-\* Categories

| ID     | Name                      | Detects                                                                                   | OWASP |
| ------ | ------------------------- | ----------------------------------------------------------------------------------------- | ----- |
| SK-HID | Hidden Content            | HTML comments with instructions, zero-width Unicode, CSS hiding, bidi overrides           | LLM01 |
| SK-INJ | Prompt Injection          | Override instructions, role reassignment, model tokens, persona manipulation              | LLM01 |
| SK-EXE | Shell Execution           | `curl\|bash`, `eval()`, reverse shells, language one-liners (`python -c`, `perl -e`)      | LLM06 |
| SK-EXF | Data Exfiltration         | Paste sites, webhook URLs, Discord/Slack/Telegram bot URLs, raw IP URLs                   | LLM02 |
| SK-SEC | Embedded Secrets          | Reuses the 17-type secret scanner (see above)                                             | LLM02 |
| SK-SFA | Sensitive File References | Reuses sensitive path rules from threat patterns                                          | LLM02 |
| SK-MEM | Memory/Config Poisoning   | References to SOUL.md, MEMORY.md, CLAUDE.md, .cursorrules, .windsurfrules                 | LLM05 |
| SK-SUP | Supply Chain Risk         | Raw GitHub script URLs, `npm install`, `pip install`, `brew install`                      | LLM03 |
| SK-B64 | Encoded Payloads          | Base64 strings >40 chars, `atob()`, hex escapes, `String.fromCharCode`, piped decode      | LLM01 |
| SK-IMG | Image Exfiltration        | Image URLs with exfil params, data URIs, SVG scripts, tracking pixels, steganography refs | LLM02 |
| SK-SYS | System Prompt Extraction  | "reveal your prompt", "repeat words above", "tell me your instructions"                   | LLM01 |
| SK-ARG | Argument Injection        | `$()`, `${}`, backtick substitution, shell metachar chaining, GTFOBINS flags              | LLM01 |
| SK-XTL | Cross-Tool Chaining       | Read-then-exfiltrate patterns, multi-step tool invocation, tool function call syntax      | LLM05 |
| SK-PRM | Excessive Permissions     | "unrestricted access", "bypass security", "disable safety", "root access"                 | LLM01 |
| SK-STR | Suspicious Structure      | Unusually large definitions (>10K chars), high imperative instruction density (>30%)      | —     |

### API

**Scan:** `POST /api/skill-scanner/scan` with `{ "content": "..." }`

Returns `SkillScanResult`: overall severity, findings sorted by severity, summary counts, scan duration.

**Clean:** `POST /api/skill-scanner/clean` with `{ "content": "..." }`

Returns `{ "cleanedContent": "...", "removedCount": N }` with all matched patterns removed.

---

## Security Posture

The security posture service (`services/security-posture.ts`) evaluates 12 layers and computes an overall health score.

### 12 Security Layers

| Layer                           | Checks | What it evaluates                                                                            |
| ------------------------------- | ------ | -------------------------------------------------------------------------------------------- |
| Sandbox Isolation               | 3      | Sandbox mode, workspace access restriction, Docker network isolation                         |
| Filesystem Access               | 3      | Filesystem toggle, workspace path, workspace access level                                    |
| Network & Egress Control        | 3      | Network toggle, browser disabled, network isolation in sandbox                               |
| Egress Proxy & Domain Filtering | 5      | Egress filtering (SRT or proxy), domain rules, NO_PROXY safety, exfiltration/network threats |
| Command Execution Controls      | 4      | System commands toggle, exec security mode, restricted patterns, critical patterns           |
| MCP Server Security             | 3      | MCP toggle, individual server review, MCP tools in deny list                                 |
| Gateway & Inbound Security      | 4      | Device identity, gateway auth, localhost binding, channel restrictions                       |
| Secret & Credential Protection  | 3      | Secret scanner active, unresolved secret exposures, sensitive file access                    |
| Supply Chain Protection         | 3      | Unresolved supply chain threats, package install patterns, exec security mode                |
| Input/Output Validation         | 4      | Prompt injection threats, MCP poisoning, content scanner, skill scanner                      |
| Threat Monitoring               | 3      | OpenClaw connection, session tracking, threat resolution rate                                |
| Human-in-the-Loop Controls      | 3      | Exec approval system active, approval timeout rate, restricted patterns                      |

### Scoring

Each check has a `passed` boolean and a `severity` (`critical`, `warning`, `info`).

- **Layer status:** `configured` (all checks pass) | `partial` (some pass) | `unconfigured` (none pass)
- **Overall score:** `Math.round((passedChecks / totalChecks) * 100)`

### API

`GET /api/security-posture` returns `SecurityPosture` with all layers, overall score, and counts of configured/partial/unconfigured layers.

---

## Adding New Patterns or Categories

### New threat pattern

1. Add the regex to the appropriate group in `lib/threat-patterns.ts`
2. The threat classifier automatically picks it up

### New TC-\* category

1. Add the category ID to `ThreatCategoryId` in `packages/shared/src/types.ts`
2. Create an analyzer function in `lib/threat-classifier.ts`
3. Call it from `classifyActivity()`
4. Rebuild shared: `pnpm build:shared && pnpm typecheck`

### New SK-\* category

1. Add the category ID to `SkillScanCategoryId` in `packages/shared/src/types.ts`
2. Add patterns in `lib/skill-scanner-patterns.ts`
3. Create a scanner function in `lib/skill-scanner.ts`
4. Call it from `scanSkillDefinition()`
5. Rebuild shared: `pnpm build:shared && pnpm typecheck`

### New security posture check

1. Add the check to the appropriate layer function in `services/security-posture.ts`
2. Or create a new layer function and add it to `computeSecurityPosture()`
