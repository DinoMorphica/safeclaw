# **SafeClaw Technical Guide**

## **Product Overview**

### **What is SafeClaw?**

SafeClaw is a **security management dashboard for AI agents**, specifically designed to protect users running the OpenClaw open-source framework and similar AI agent platforms.

As AI agents become more powerful and autonomous, they gain the ability to execute shell commands, modify files, install packages, and interact with external services. While this makes them incredibly useful, it also introduces significant security risks:

- **Unintended destructive commands** (e.g., `rm -rf /`)
- **Unauthorized package installations** that could contain malware
- **Access to sensitive files** (SSH keys, AWS credentials, private databases)
- **Network requests** to malicious or unknown domains
- **Lack of visibility** into what the agent is actually doing

**SafeClaw solves this problem** by acting as a security layer between the AI agent and your system. It provides:

1. ✅ **Real-time command interception** with user approval prompts
2. 📊 **Complete visibility** into agent activities through visual workflows
3. 🔒 **Granular access control** (sandbox specific directories, disable dangerous features)
4. 📝 **Audit trails** of every action the agent takes

---

### **User Experience**

SafeClaw is designed for **zero-friction onboarding**:

**Step 1: Install and Launch**

```bash
npx safeclaw start
```

**Step 2: Dashboard Opens Automatically**

- Browser opens to `http://localhost:3000`
- User sees a clean, intuitive dashboard
- OpenClaw agent monitoring starts automatically

**Step 3: Control Your Agent**

- Toggle permissions (file access, MCP servers, network)
- Review and approve/deny dangerous commands in real-time
- View visual workflows of everything the agent does
- Export audit logs for compliance or debugging

**No complex configuration. No learning curve. Just security.**

---

### **Business Model**

**MVP (Free Version):**

- All 3 core functionalities included
- Command interception and approval
- Session monitoring and visual workflows
- Basic access control (file system, MCP servers, network)
- Local dashboard (localhost:3000)
- SQLite-based audit logs

**Premium Features (Future Monetization):**

- ☁️ **Cloud sync** - Access dashboards from any device
- 👥 **Team collaboration** - Share audit logs across organizations
- 🤖 **AI-powered threat detection** - Learn from past decisions to auto-block similar threats
- 📈 **Advanced analytics** - Detailed insights into agent behavior patterns
- 🔗 **Multi-agent management** - Monitor multiple AI agents from one dashboard
- 🔐 **Enterprise SSO** - SAML, OAuth integration
- 📞 **Priority support** - Dedicated Slack channel, SLA guarantees

**Pricing Strategy (Future):**

- Free tier: Local-only, single user, basic features
- Pro tier ($9/month): Cloud sync, advanced analytics, priority support
- Enterprise tier ($99/month): Team collaboration, SSO, multi-agent, custom integrations

---

### **Why SafeClaw?**

**For Individual Developers:**

- "I want to use OpenClaw to automate my workflow, but I'm scared it might accidentally delete my production database."
- "I need to see exactly what files my AI agent is reading before I trust it with my codebase."

**For Teams/Organizations:**

- "We can't deploy AI agents in production without audit trails and access control."
- "Our security team requires logs of every system command executed by autonomous agents."

**For Security Researchers:**

- "I want to experiment with AI agents safely in a sandboxed environment."
- "I need to test how agents behave when given malicious prompts."

SafeClaw makes AI agents **safe, transparent, and controllable**.

---

## **Distribution Strategy**

### **How Users Get SafeClaw**

**Primary Method: `npx safeclaw`**

- No global installation required
- Always runs the latest version
- Works on Mac, Linux, Windows

**Alternative: Global Install**

```bash
npm install -g safeclaw
safeclaw start
```

**Package Registry: npm (Public)**

- Package name: `safeclaw`
- Repository: `github.com/safeclaw/safeclaw-cli` (or your org name)
- License: MIT (for community trust and adoption)

---

## **Core Value Proposition**

**Before SafeClaw:**

```
User → "Hey OpenClaw, automate my deployment"
OpenClaw → Executes: rm -rf /production/database
User → 😱 "Wait, what did you just do?!"
```

**After SafeClaw:**

```
User → "Hey OpenClaw, automate my deployment"
SafeClaw → 🛑 BLOCKED: Command `rm -rf /production/database`
          → Risk: CRITICAL | Impact: Data Loss
          → [Allow] [Deny] [See Workflow]
User → 😌 "Glad I caught that. Let me investigate."
```

SafeClaw ensures you **always stay in control** of your AI agents.

---

Here is the updated Technical Guide with your **SafeClaw** branding and the specific file structure.

First, to answer your question about **Private vs. Public Repos**:

### **Does the repo have to be public?**

- **To use `npx safeclaw` easily: YES.**
- If you want any random user to type `npx safeclaw` and have it just work (like magic), the package **must be public** on the npm registry.
- _Note:_ The **source code** (GitHub repo) can theoretically be private if you only publish the _compiled_ code to npm, but npm requires a paid account to host "Private Packages." Even then, users would need a special access token to download it, which destroys the "easy onboarding" experience.
- **Recommendation:** Make the **CLI wrapper** public (open source). Keep your **Backend/Cloud API** code private (closed source). This is how companies like Vercel and Stripe do it. The CLI is just a "dumb" tool that talks to your smart, private cloud.

---

### **Technical Specification: SafeClaw CLI (MVP)**

**Product Name:** SafeClaw
**Distribution:** Public npm package (`safeclaw`)
**Command:** `npx safeclaw`

---

#### **1. The SafeClaw File System**

When the user runs the tool, it will create a hidden directory in their home folder to store their local database and configuration.

- **Root Directory:** `~/.safeclaw/` (Mac/Linux) or `%USERPROFILE%/.safeclaw/` (Windows)
- **The Config File:** `~/.safeclaw/config.json`
- _Stores:_ User ID, Premium Token, Settings (e.g., "Block these commands").

- **The Local Database:** `~/.safeclaw/safeclaw.db`
- _Stores:_ SQLite database containing the command history and logs.

- **The Logs:** `~/.safeclaw/logs/debug.log`
- _Stores:_ Application errors (for debugging if the tool crashes).

#### **2. SafeClaw CLI Commands**

You will expose these commands in your `package.json` `bin` section.

- **`npx safeclaw start`**
- _Action:_ Launches the local server and opens the dashboard at `localhost:3000`.
- _Use Case:_ Daily use.

- **`npx safeclaw reset`**
- _Action:_ Deletes `safeclaw.db` and resets `config.json`.
- _Use Case:_ If the database gets corrupted or user wants a fresh start.

- **`npx safeclaw status`**
- _Action:_ Prints: "SafeClaw is Active. Premium: Yes/No. Logs saved: 1,402."
- _Use Case:_ Debugging.

---

### **3. SafeClaw Monorepo Structure**

Here is exactly how your folder structure should look for your engineers.

```text
/safeclaw-monorepo
├── package.json          (Root workspace config)
├── pnpm-workspace.yaml   (Defines 'apps' and 'packages')
├── .gitignore
├── README.md
│
├── /packages
│   └── /shared           (Code shared between CLI and Web)
│       ├── types.ts      (e.g., interface LogEntry { ... })
│       └── schemas.ts    (Zod schemas for command validation)
│
├── /apps
│   ├── /web              (The Frontend - React/Vite)
│   │   ├── src/
│   │   ├── index.html
│   │   └── package.json
│   │
│   └── /cli              (The Backend - Node/Fastify)
│       ├── src/
│       │   ├── main.ts         (Entry point)
│       │   ├── interceptor.ts  (The "Safety" Logic)
│       │   └── db.ts           (Drizzle/SQLite connection)
│       ├── bin/
│       │   └── safeclaw.js     (Executable file)
│       ├── public/             (Empty in git; filled by build script)
│       └── package.json

```

---

### **4. Technical Implementation Steps (Rewritten for SafeClaw)**

#### **Step A: The Build Pipeline (Crucial for `npx`)**

Your `apps/cli/package.json` needs a specific build script. It must compile the React app and "stuff it" inside the CLI folder so the user downloads only **one** thing.

**`apps/cli/package.json`**:

```json
{
  "name": "safeclaw",
  "version": "1.0.0",
  "bin": {
    "safeclaw": "./dist/bin/safeclaw.js"
  },
  "scripts": {
    "build": "pnpm --filter @safeclaw/web build && cp -r ../web/dist ./public && tsc"
  }
}
```

#### **Step B: The Safety Interceptor (The "Claw")**

**File:** `apps/cli/src/interceptor.ts`

```typescript
import { socket } from "./server";
import { db } from "./db";

// The "Claw" Logic
export function validateCommand(cmd: string): boolean {
  // 1. Check against Blocklist
  const DANGEROUS = ["rm -rf", "mkfs", "dd if=/dev", ":(){:|:&};:"];

  if (DANGEROUS.some((bad) => cmd.includes(bad))) {
    // BLOCK ACTION
    console.log(`[SafeClaw] BLOCKED: ${cmd}`);
    socket.emit("safeclaw:alert", { message: `Blocked dangerous command: ${cmd}` });

    // Log to SQLite
    db.insertLog({ command: cmd, status: "BLOCKED", timestamp: Date.now() });
    return false; // Do NOT execute
  }

  return true; // Safe to execute
}
```

#### **Step C: The Database Setup (Drizzle + SQLite)**

**File:** `apps/cli/src/db.ts`

```typescript
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import path from "path";
import os from "os";
import fs from "fs";

// 1. Ensure ~/.safeclaw directory exists
const homeDir = os.homedir();
const safeClawDir = path.join(homeDir, ".safeclaw");

if (!fs.existsSync(safeClawDir)) {
  fs.mkdirSync(safeClawDir);
}

// 2. Connect to the file
const sqlite = new Database(path.join(safeClawDir, "safeclaw.db"));
export const db = drizzle(sqlite);
```

---

### **5. Branding the User Experience**

When the user runs `npx safeclaw`, do not just show a blank terminal. Show your brand.

**In `apps/cli/src/main.ts` (Startup message):**

```typescript
console.log(`
   _____       __      _________             
  / ___/____ _/ ____ _/ ____/ /___ __      __
  \\__ \\/ __ \`/ /_/ _ \\/ /   / / __ \`| | /| / /
 ___/ / /_/ / __/  __/ /___/ / /_/ /| |/ |/ / 
/____/\\__,_/_/  \\___/\\____/_/\\__,_/ |__/|__/  
                                              
SafeClaw v1.0.0 - Local AI Security
-----------------------------------
Dashboard: http://localhost:3000
Logs stored in: ~/.safeclaw/
`);
```

---

## **6. MVP Core Functionalities**

SafeClaw provides three critical security layers for OpenClaw and other AI agent frameworks:

### **6.1 Command Interception & Authorization (Real-time Threat Prevention)**

**Purpose:** Intercept dangerous shell commands BEFORE execution and require user approval.

**How it works:**

1. **Intercept Layer** - SafeClaw hooks into the OpenClaw agent's command execution pipeline
2. **Threat Detection** - Analyze commands against a threat database:
   - File deletions (`rm -rf`, `unlink`)
   - Package installations (`npm install`, `pip install`, `apt-get`)
   - System modifications (`chmod`, `chown`, `sudo commands`)
   - Database operations (`DROP TABLE`, `DELETE FROM`)
   - Network requests to unknown domains
3. **User Authorization UI** - When a dangerous command is detected:
   - Pause command execution
   - Display popup notification in localhost:3000 dashboard
   - Show command details, risk level, and potential impact
   - User options: **Allow** | **Deny** | **Allow Always for this session**
4. **Audit Trail** - Log all decisions to SQLite database

**Technical Implementation:**

```typescript
// Intercept OpenClaw commands before execution
export class CommandInterceptor {
  async interceptCommand(cmd: string, context: AgentContext) {
    const threatLevel = this.analyzeThreat(cmd);

    if (threatLevel === "HIGH" || threatLevel === "CRITICAL") {
      // Pause execution and request user approval
      const decision = await this.requestUserApproval({
        command: cmd,
        threatLevel,
        agentContext: context,
        suggestedAction: "DENY",
      });

      // Log decision
      await db.insertLog({
        command: cmd,
        decision: decision.action,
        timestamp: Date.now(),
        agentSession: context.sessionId,
      });

      return decision.action === "ALLOW";
    }

    return true; // Safe to execute
  }
}
```

**User Experience:**

- Real-time popup appears in dashboard
- Clear explanation of what the command does
- Risk indicators (color-coded: Green/Yellow/Red)
- Option to add command to allowlist

---

### **6.2 Session Monitoring & Visual Workflow (Complete Transparency)**

**Purpose:** Monitor everything the OpenClaw agent sees, reads, and executes - then display it as an interactive visual workflow.

**What we track:**

1. **File Access Monitoring**
   - Files read by agent
   - Files written/modified
   - Directories accessed
   - Timestamp of each operation

2. **Command Execution Timeline**
   - All shell commands executed
   - Exit codes and outputs
   - Duration of execution
   - Success/failure status

3. **Network Activity**
   - API calls made by agent
   - External URLs accessed
   - Data sent/received
   - MCP server connections

4. **Agent Decision Context**
   - User prompts that triggered actions
   - Agent's reasoning (if available from LLM logs)
   - Tool invocations
   - Multi-step task breakdowns

**Visual Workflow UI:**

- **Timeline View:**
  - Horizontal timeline showing all agent activities
  - Color-coded by action type (read/write/execute/network)
  - Click any event to see details

- **Graph View:**
  - Node-based workflow diagram
  - Shows dependencies between operations
  - Example: "Read config.json → Modified database.ts → Executed npm install"

- **Session Browser:**
  - List all agent sessions (past and active)
  - Filter by date, agent type, or risk level
  - Export session logs as JSON/CSV

**Technical Implementation:**

```typescript
// Hook into OpenClaw's file system wrapper
import * as fs from "fs/promises";

export class ActivityMonitor {
  private workflowBuilder: WorkflowBuilder;

  async wrapFileSystem(agentFS: any) {
    return new Proxy(agentFS, {
      get: (target, prop) => {
        return async (...args: any[]) => {
          const operation = {
            type: "FILE_OPERATION",
            method: String(prop),
            args: args,
            timestamp: Date.now(),
          };

          // Execute original operation
          const result = await target[prop](...args);

          // Log to workflow
          this.workflowBuilder.addNode(operation);

          // Send to dashboard via WebSocket
          io.emit("agent:activity", operation);

          return result;
        };
      },
    });
  }
}
```

**Dashboard Features:**

- Live updating workflow as agent works
- Search/filter activities
- Export workflow as diagram (PNG/SVG)
- Replay mode to understand agent's decision path

---

### **6.3 Granular Access Control (Sandboxed Environment)**

**Purpose:** Allow users to toggle exactly what resources OpenClaw agents can access - creating a sandboxed environment.

**Access Control Categories:**

1. **File System Access**
   - Whitelist specific directories (e.g., `/projects/my-app` only)
   - Block access to sensitive folders (`~/.ssh`, `~/.aws`, `/etc`)
   - Read-only vs. read-write permissions

2. **Database Access**
   - Toggle database connections on/off
   - Specify allowed databases
   - Read-only mode option

3. **MCP Server Access**
   - Enable/disable specific MCP servers
   - Example servers: GitHub, Slack, Google Drive, Browser Control
   - Per-server permission configuration

4. **Network Access**
   - Toggle browser/network access
   - Domain allowlist (only allow specific APIs)
   - Block external requests entirely

5. **System Commands**
   - Whitelist allowed shell commands
   - Block package managers (npm, pip, apt)
   - Disable sudo/admin commands

**Configuration UI (Dashboard at localhost:3000):**

```
┌─────────────────────────────────────────┐
│  SafeClaw Access Control                │
├─────────────────────────────────────────┤
│                                         │
│  📁 File System Access                  │
│     ☑ Enable file access                │
│     ├─ Allowed: /Users/you/projects     │
│     ├─ Blocked: ~/.ssh, ~/.aws          │
│     └─ Mode: [Read-Write ▼]             │
│                                         │
│  🗄️  Database Access                    │
│     ☐ Enable database connections       │
│                                         │
│  🔌 MCP Servers                         │
│     ☑ filesystem (read-only)            │
│     ☑ brave-search                      │
│     ☐ github                            │
│     ☐ slack                             │
│                                         │
│  🌐 Network Access                      │
│     ☑ Enable browser/HTTP               │
│     ├─ Allowed domains:                 │
│     │   • api.openai.com                │
│     │   • *.anthropic.com               │
│     └─ [Add Domain]                     │
│                                         │
│  ⚡ System Commands                     │
│     ☐ Allow package installations       │
│     ☐ Allow sudo commands               │
│                                         │
│  [Save Configuration]                   │
└─────────────────────────────────────────┘
```

**Technical Implementation:**

```typescript
// Sandboxed file system wrapper
export class SandboxedFS {
  constructor(private config: AccessConfig) {}

  validatePath(filePath: string): boolean {
    const resolvedPath = path.resolve(filePath);

    // Check against blocked paths
    for (const blockedPath of this.config.blockedPaths) {
      if (resolvedPath.startsWith(blockedPath)) {
        console.log(`[SafeClaw] Blocked access to: ${filePath}`);
        return false;
      }
    }

    // Check against allowed paths
    const isAllowed = this.config.allowedPaths.some((allowedPath) =>
      resolvedPath.startsWith(allowedPath),
    );

    if (!isAllowed) {
      console.log(`[SafeClaw] Path not in allowlist: ${filePath}`);
      return false;
    }

    return true;
  }

  async readFile(filePath: string, options?: any) {
    if (!this.validatePath(filePath)) {
      throw new Error(`[SafeClaw] Access denied: ${filePath}`);
    }

    // Track access for monitoring
    await this.logAccess("READ", filePath);

    return fs.readFile(filePath, options);
  }
}

// MCP server access control
export class MCPAccessControl {
  async connectToMCPServer(serverName: string) {
    const isEnabled = await this.config.isMCPServerEnabled(serverName);

    if (!isEnabled) {
      throw new Error(`[SafeClaw] MCP server disabled: ${serverName}`);
    }

    // Proceed with connection
    return this.mcpClient.connect(serverName);
  }
}
```

**User Benefits:**

- Fine-grained control over agent permissions
- Peace of mind that agents can't access sensitive data
- Easy toggle switches - no complex configuration needed
- Presets for common use cases ("Read-only mode", "Full access", "Safe mode")

---

## **7. OpenClaw Integration & Settings Modification**

### **7.1 How SafeClaw Integrates with OpenClaw**

OpenClaw stores its configuration in `~/.openclaw/openclaw.json`. SafeClaw can:

1. **Read OpenClaw Configuration**

   ```typescript
   const openClawConfig = await fs.readFile(
     path.join(os.homedir(), ".openclaw/openclaw.json"),
     "utf8",
   );
   ```

2. **Modify OpenClaw Settings Programmatically**
   - Inject SafeClaw as a middleware layer
   - Override command execution functions
   - Add pre-execution hooks for all agent operations

3. **Wrap OpenClaw's Agent Runtime**

   ```typescript
   // Intercept OpenClaw's Pi agent runtime
   import { PiAgent } from "openclaw";

   export class SafeClawWrapper {
     private agent: PiAgent;
     private interceptor: CommandInterceptor;

     async executeAgentCommand(cmd: string) {
       // SafeClaw pre-execution check
       const isAllowed = await this.interceptor.interceptCommand(cmd);

       if (!isAllowed) {
         return { blocked: true, reason: "User denied authorization" };
       }

       // Execute via OpenClaw
       return this.agent.execute(cmd);
     }
   }
   ```

### **7.2 Modifying OpenClaw Configuration from SafeClaw Dashboard**

**Feature:** Users can modify OpenClaw's settings directly from the SafeClaw dashboard.

**Configurable Settings:**

1. **Default AI Model** (e.g., Claude, GPT-4, Llama)
2. **MCP Server Registry** (enable/disable servers)
3. **Channel Allowlists** (which platforms can trigger the agent)
4. **Tool Restrictions** (disable browser, file access, etc.)

**Implementation:**

```typescript
export class OpenClawConfigManager {
  private configPath = path.join(os.homedir(), ".openclaw/openclaw.json");

  async readConfig() {
    const data = await fs.readFile(this.configPath, "utf8");
    return JSON.parse(data);
  }

  async updateConfig(updates: Partial<OpenClawConfig>) {
    const currentConfig = await this.readConfig();
    const newConfig = { ...currentConfig, ...updates };

    await fs.writeFile(this.configPath, JSON.stringify(newConfig, null, 2), "utf8");

    // Notify OpenClaw to reload configuration
    await this.notifyOpenClaw("config:reload");
  }

  async disableMCPServer(serverName: string) {
    const config = await this.readConfig();
    config.mcpServers = config.mcpServers.filter((server: any) => server.name !== serverName);
    await this.updateConfig(config);
  }
}
```

**Dashboard UI Example:**

```
┌─────────────────────────────────────────┐
│  OpenClaw Configuration                 │
├─────────────────────────────────────────┤
│                                         │
│  🤖 AI Model                            │
│     [Claude 3.5 Sonnet ▼]               │
│                                         │
│  🔌 MCP Servers                         │
│     ☑ filesystem                        │
│     ☐ github (controlled by SafeClaw)   │
│     ☑ brave-search                      │
│                                         │
│  📱 Allowed Channels                    │
│     ☑ WhatsApp                          │
│     ☑ Slack                             │
│     ☐ Telegram                          │
│                                         │
│  [Apply Changes]  [Restart OpenClaw]    │
└─────────────────────────────────────────┘
```

### **7.3 SafeClaw as a Proxy/Middleware Layer**

SafeClaw doesn't modify OpenClaw's core code. Instead, it:

1. **Runs as a background process** monitoring OpenClaw
2. **Intercepts system calls** via LD_PRELOAD (Linux/Mac) or function hooking
3. **Provides a unified dashboard** for all agent activities
4. **Exports configuration sync** between SafeClaw and OpenClaw

**Architecture Diagram:**

```
User → OpenClaw Agent → SafeClaw Interceptor → System Resources
                            ↓
                      Dashboard (localhost:3000)
                            ↓
                      SQLite Logs (~/.safeclaw/)
```

---

## **8. Technical Research Summary**

### **8.1 Command Interception Methods**

Based on research, SafeClaw can intercept commands using:

1. **Node.js `child_process` Wrapper**
   - Wrap `exec`, `spawn`, `execSync` functions
   - Analyze command strings before execution
   - Async approval workflow via WebSocket to dashboard

2. **File System Proxy Pattern**
   - Use ES6 Proxy to wrap all `fs` module methods
   - Validate paths against allowlist/blocklist
   - Log all file operations to database

3. **MCP Server Control**
   - MCP uses a client-server architecture
   - SafeClaw can intercept MCP client connections
   - Enable/disable specific servers at runtime

### **8.2 Sandboxing Strategies**

1. **Path Validation**
   - Resolve all paths to absolute paths
   - Check if path starts with allowed directory
   - Reject operations outside sandbox

2. **Process Isolation**
   - Run OpenClaw agent in child process
   - Limit process capabilities (no sudo)
   - Resource limits (CPU, memory, file descriptors)

3. **Network Sandboxing**
   - Intercept HTTP/HTTPS requests
   - Use domain allowlist
   - Block requests to private IPs (prevent SSRF)

---

### **Summary for Engineering Team**

1. **Repo:** Create a Public GitHub repo `safeclaw-cli` (or private if you only publish compiled code, but public is easier for community trust).
2. **Package:** The npm package name will be `safeclaw`.
3. **Config:** All local data lives in `~/.safeclaw/`.
4. **Database:** `better-sqlite3` with `drizzle-orm`.
5. **Build:** The CLI must bundle the React frontend static assets into its own `public/` folder before publishing to npm.
6. **MVP Focus:** Implement the 3 core functionalities: Command Interception, Session Monitoring, and Access Control.
7. **OpenClaw Integration:** SafeClaw wraps OpenClaw's agent runtime and can modify `~/.openclaw/openclaw.json` programmatically.
