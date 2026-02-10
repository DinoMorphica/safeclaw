import fs from "node:fs";
import net from "node:net";
import Database from "better-sqlite3";
import pc from "picocolors";
import {
  SAFECLAW_DIR,
  DB_PATH,
  CONFIG_PATH,
  LOGS_DIR,
  OPENCLAW_DIR,
  OPENCLAW_CONFIG_PATH,
} from "../lib/paths.js";
import { readConfig, ensureDataDir } from "../lib/config.js";
import { VERSION } from "../lib/version.js";

interface CheckResult {
  name: string;
  status: "pass" | "warn" | "fail";
  message: string;
}

function checkNodeVersion(): CheckResult {
  const major = parseInt(process.versions.node.split(".")[0], 10);
  if (major >= 20) {
    return {
      name: "Node.js version",
      status: "pass",
      message: `v${process.versions.node}`,
    };
  }
  return {
    name: "Node.js version",
    status: "fail",
    message: `v${process.versions.node} (requires >= 20.0.0)`,
  };
}

function checkDataDir(): CheckResult {
  try {
    ensureDataDir();
    fs.accessSync(SAFECLAW_DIR, fs.constants.W_OK);
    return {
      name: "Data directory writable",
      status: "pass",
      message: SAFECLAW_DIR,
    };
  } catch {
    return {
      name: "Data directory writable",
      status: "fail",
      message: `Cannot write to ${SAFECLAW_DIR}`,
    };
  }
}

function checkDatabase(): CheckResult {
  if (!fs.existsSync(DB_PATH)) {
    return {
      name: "Database",
      status: "warn",
      message: "Not created yet (run 'safeclaw start' first)",
    };
  }
  try {
    const sqlite = new Database(DB_PATH, { readonly: true });
    const tables = sqlite
      .prepare("SELECT name FROM sqlite_master WHERE type='table'")
      .all() as { name: string }[];
    sqlite.close();
    const expected = [
      "command_logs",
      "sessions",
      "access_config",
      "openclaw_sessions",
      "agent_activities",
      "restricted_patterns",
      "exec_approvals",
    ];
    const tableNames = new Set(tables.map((t) => t.name));
    const missing = expected.filter((t) => !tableNames.has(t));
    if (missing.length > 0) {
      return {
        name: "Database",
        status: "warn",
        message: `Missing tables: ${missing.join(", ")}`,
      };
    }
    return {
      name: "Database",
      status: "pass",
      message: `${tables.length} tables`,
    };
  } catch (err) {
    return {
      name: "Database",
      status: "fail",
      message: `Cannot open database: ${(err as Error).message}`,
    };
  }
}

function checkConfig(): CheckResult {
  if (!fs.existsSync(CONFIG_PATH)) {
    return {
      name: "Config file",
      status: "warn",
      message: "Not created yet (will use defaults)",
    };
  }
  try {
    readConfig();
    return { name: "Config file", status: "pass", message: CONFIG_PATH };
  } catch (err) {
    return {
      name: "Config file",
      status: "fail",
      message: `Invalid config: ${(err as Error).message}`,
    };
  }
}

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(false));
    server.once("listening", () => {
      server.close(() => resolve(true));
    });
    server.listen(port, "0.0.0.0");
  });
}

async function checkPort(): Promise<CheckResult> {
  const config = readConfig();
  const port = config.port;
  const available = await isPortAvailable(port);
  if (available) {
    return { name: `Port ${port} available`, status: "pass", message: "" };
  }
  return {
    name: `Port ${port} available`,
    status: "warn",
    message: `Port ${port} is in use (server may already be running)`,
  };
}

function checkOpenClawConfig(): CheckResult {
  if (!fs.existsSync(OPENCLAW_DIR)) {
    return {
      name: "OpenClaw directory",
      status: "warn",
      message: `${OPENCLAW_DIR} not found`,
    };
  }
  if (!fs.existsSync(OPENCLAW_CONFIG_PATH)) {
    return {
      name: "OpenClaw config",
      status: "warn",
      message: "Config not found (OpenClaw may not be installed)",
    };
  }
  return {
    name: "OpenClaw config",
    status: "pass",
    message: OPENCLAW_CONFIG_PATH,
  };
}

function isPortInUse(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(2000);
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("timeout", () => {
      socket.destroy();
      resolve(false);
    });
    socket.once("error", () => {
      resolve(false);
    });
    socket.connect(port, "127.0.0.1");
  });
}

async function checkOpenClawGateway(): Promise<CheckResult> {
  if (!fs.existsSync(OPENCLAW_CONFIG_PATH)) {
    return {
      name: "OpenClaw gateway",
      status: "warn",
      message: "Skipped (no OpenClaw config)",
    };
  }
  try {
    const raw = JSON.parse(fs.readFileSync(OPENCLAW_CONFIG_PATH, "utf-8"));
    const port = raw?.gateway?.port ?? 18789;
    const reachable = await isPortInUse(port);
    if (reachable) {
      return {
        name: "OpenClaw gateway",
        status: "pass",
        message: `Reachable on port ${port}`,
      };
    }
    return {
      name: "OpenClaw gateway",
      status: "warn",
      message: `Not reachable on port ${port}`,
    };
  } catch {
    return {
      name: "OpenClaw gateway",
      status: "warn",
      message: "Could not read OpenClaw config",
    };
  }
}

function checkLogDir(): CheckResult {
  try {
    if (!fs.existsSync(LOGS_DIR)) {
      fs.mkdirSync(LOGS_DIR, { recursive: true });
    }
    fs.accessSync(LOGS_DIR, fs.constants.W_OK);
    return {
      name: "Log directory writable",
      status: "pass",
      message: LOGS_DIR,
    };
  } catch {
    return {
      name: "Log directory writable",
      status: "fail",
      message: `Cannot write to ${LOGS_DIR}`,
    };
  }
}

export async function doctorCommand(): Promise<void> {
  console.log(pc.bold("\nSafeClaw Doctor") + pc.dim(` v${VERSION}`));
  console.log(pc.dim("─".repeat(40)));
  console.log();

  const checks: CheckResult[] = [];

  checks.push(checkNodeVersion());
  checks.push(checkDataDir());
  checks.push(checkDatabase());
  checks.push(checkConfig());
  checks.push(await checkPort());
  checks.push(checkOpenClawConfig());
  checks.push(await checkOpenClawGateway());
  checks.push(checkLogDir());

  let hasFailures = false;
  for (const check of checks) {
    const icon =
      check.status === "pass"
        ? pc.green("PASS")
        : check.status === "warn"
          ? pc.yellow("WARN")
          : pc.red("FAIL");
    console.log(`  ${icon}  ${check.name}`);
    if (check.status !== "pass") {
      console.log(pc.dim(`         ${check.message}`));
    }
    if (check.status === "fail") hasFailures = true;
  }

  console.log();
  const passCount = checks.filter((c) => c.status === "pass").length;
  const warnCount = checks.filter((c) => c.status === "warn").length;
  const failCount = checks.filter((c) => c.status === "fail").length;
  console.log(
    `${pc.green(`${passCount} passed`)}` +
      (warnCount ? `, ${pc.yellow(`${warnCount} warnings`)}` : "") +
      (failCount ? `, ${pc.red(`${failCount} failed`)}` : ""),
  );
  console.log();

  if (hasFailures) process.exit(1);
}
