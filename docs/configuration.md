# Configuration

All SafeClaw and OpenClaw configuration files, CLI commands, and environment settings.

## Data Directories

| Path                                    | Purpose                                              |
| --------------------------------------- | ---------------------------------------------------- |
| `~/.safeclaw/`                          | SafeClaw data root                                   |
| `~/.safeclaw/config.json`               | SafeClaw settings                                    |
| `~/.safeclaw/safeclaw.db`               | SQLite database (WAL mode)                           |
| `~/.safeclaw/logs/debug.log`            | Pino debug logs                                      |
| `~/.openclaw/`                          | OpenClaw data root                                   |
| `~/.openclaw/openclaw.json`             | OpenClaw configuration (read + modified by SafeClaw) |
| `~/.openclaw/identity/device.json`      | Ed25519 device identity for gateway auth             |
| `~/.openclaw/exec-approvals.json`       | Exec approval configuration                          |
| `~/.openclaw/agents/*/sessions/*.jsonl` | Session journals (monitored by SessionWatcher)       |
| `~/.srt-settings.json`                  | SRT network and filesystem filtering rules           |

## SafeClaw Config (`~/.safeclaw/config.json`)

```jsonc
{
  "version": "0.1.6", // SafeClaw version
  "port": 54335, // Dashboard server port
  "autoOpenBrowser": true, // Open browser on `safeclaw start`
  "premium": false, // Premium features flag (unused in MVP)
  "userId": null, // User identifier (unused in MVP)
  "srt": {
    "enabled": false, // Whether SRT enforcement is active
    "settingsPath": null, // Override path for srt-settings.json (optional)
  },
}
```

Created automatically on first run. Validated with Zod (`safeClawConfigSchema`).

## OpenClaw Config (`~/.openclaw/openclaw.json`)

SafeClaw reads and modifies this file to apply access control toggles. Key sections:

```jsonc
{
  "agents": {
    "defaults": {
      "workspace": "/path/to/workspace",
      "sandbox": {
        "mode": "all" | "non-main" | "off",
        "workspaceAccess": "rw" | "ro" | "none",
        "docker": { "network": "bridge" | "host" | "none" }
      }
    }
  },
  "gateway": {
    "port": 18789,
    "bind": "127.0.0.1",
    "auth": { "mode": "device" }
  },
  "tools": {
    "deny": [],               // e.g. ["group:fs", "group:runtime", "mcp__github"]
    "exec": {
      "security": "deny" | "allowlist" | "allow"
    }
  },
  "browser": {
    "enabled": true
  },
  "plugins": {
    "<plugin-name>": { "enabled": true }
  },
  "channels": {
    "whatsapp": {
      "allowFrom": ["+1234567890"]
    }
  }
}
```

## SRT Settings (`~/.srt-settings.json`)

Sandbox Runtime network and filesystem filtering:

```jsonc
{
  "network": {
    "allowedDomains": [], // Domains allowed through the proxy
    "deniedDomains": [], // Domains explicitly blocked
    "allowLocalBinding": false,
  },
  "filesystem": {
    "denyRead": [], // Paths denied for reading
    "allowWrite": [], // Paths allowed for writing
    "denyWrite": [], // Paths denied for writing
  },
}
```

Created automatically when SRT is enabled. Domains are normalized to lowercase. Adding a domain to one list automatically removes it from the other.

## CLI Commands

```
safeclaw <command> [options]
```

| Command                    | Options               | Description                                                  |
| -------------------------- | --------------------- | ------------------------------------------------------------ |
| `start`                    | `-p, --port <port>`   | Override server port                                         |
|                            | `--no-open`           | Skip auto-opening browser                                    |
|                            | `--verbose`           | Enable debug logging to console                              |
| `reset`                    | `--force`             | Skip confirmation prompt                                     |
| `status`                   | `--json`              | Output as JSON for scripting                                 |
| `doctor`                   |                       | Run 8 health checks (Node version, DB, ports, OpenClaw, SRT) |
| `config list`              |                       | Show all configuration values                                |
| `config get <key>`         |                       | Get a configuration value                                    |
| `config set <key> <value>` |                       | Set a configuration value                                    |
| `logs`                     | `-n, --lines <count>` | Number of lines to show (default: 50)                        |
|                            | `-f, --follow`        | Follow log output in real-time                               |
|                            | `--clear`             | Clear the log file                                           |

## Environment

| Variable       | Default | Description                                                        |
| -------------- | ------- | ------------------------------------------------------------------ |
| Dashboard port | `54335` | Configurable via `config set port <N>` or `start -p <N>`           |
| Dev proxy port | `5173`  | Vite dev server, proxies `/api` and `/socket.io` to dashboard port |
| Gateway port   | `18789` | OpenClaw WebSocket gateway (not configurable via SafeClaw)         |

## Database Management

```bash
cd apps/cli
pnpm db:push       # Push Drizzle schema to SQLite
pnpm db:studio     # Open Drizzle Studio GUI
safeclaw reset      # Delete database + reset config
```

Migrations run automatically on startup. The database uses WAL mode for concurrent reads.
