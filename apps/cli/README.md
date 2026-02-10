# SafeClaw

A security firewall for AI agents. Intercept dangerous commands, monitor agent activity in real time, and control what your AI can access — all from a local dashboard.

## Quick Start

```bash
npx safeclaw start
```

Opens a dashboard at `http://localhost:54335` where you can:

- **Block dangerous commands** before they execute (rm -rf, sudo, curl|bash, etc.)
- **Monitor every action** your AI agent takes in a visual timeline
- **Control access** to files, network, MCP servers, and system commands
- **Detect secrets** leaked in agent output (AWS keys, API tokens, credentials)
- **Analyze threats** across 10 categories with OWASP-referenced findings

## How It Works

SafeClaw sits between your AI agent and your operating system. When an agent tries to run a shell command, SafeClaw checks it against a configurable blocklist. Dangerous commands are held for your approval. Everything else is logged and analyzed for threats.

```
AI Agent  →  SafeClaw (intercept + analyze)  →  Your System
                  ↓
          Dashboard (approve / deny / monitor)
```

## Features

- **Command Interception** — Blocklist-based approval system for shell commands
- **Threat Analysis** — 200+ patterns across 10 threat categories (data exfiltration, privilege escalation, prompt injection, and more)
- **Secret Detection** — Scans for 15+ credential types (AWS, OpenAI, GitHub, Stripe, PEM keys, JWTs, etc.)
- **Session Timeline** — Grouped activity view showing exactly what the agent did and why
- **Access Toggles** — One-click enable/disable for filesystem, network, MCP servers, and system commands
- **Remediation Guidance** — Actionable advice for every detected threat

## Requirements

- Node.js >= 20
- Currently supports [OpenClaw](https://openclaw.io) agents

## License

AGPL-3.0 — see [LICENSE](https://github.com/nicholasgriffintn/safeclaw-monorepo/blob/main/LICENSE) for details.

Learn more at [safeclaw.io](https://safeclaw.io).
