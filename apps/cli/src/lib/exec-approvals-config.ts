import fs from "node:fs";
import { OPENCLAW_EXEC_APPROVALS_PATH } from "./paths.js";
import { logger } from "./logger.js";
import { writeOpenClawConfig, readOpenClawConfig } from "./openclaw-config.js";

// --- Config shape for ~/.openclaw/exec-approvals.json ---

interface ExecApprovalsConfig {
  version: number;
  socket?: {
    path: string;
    token: string;
  };
  defaults?: {
    security?: "deny" | "allowlist" | "full";
    ask?: "off" | "on-miss" | "always";
    askFallback?: "deny" | "allow";
    autoAllowSkills?: boolean;
  };
  agents?: Record<
    string,
    {
      allowlist?: Array<{ pattern: string }>;
      security?: string;
      ask?: string;
      askFallback?: string;
    }
  >;
}

export function readExecApprovalsConfig(): ExecApprovalsConfig | null {
  try {
    if (!fs.existsSync(OPENCLAW_EXEC_APPROVALS_PATH)) return null;
    const raw = fs.readFileSync(OPENCLAW_EXEC_APPROVALS_PATH, "utf-8");
    return JSON.parse(raw) as ExecApprovalsConfig;
  } catch (err) {
    logger.warn({ err }, "Failed to read exec-approvals.json");
    return null;
  }
}

export function writeExecApprovalsConfig(config: ExecApprovalsConfig): void {
  fs.writeFileSync(OPENCLAW_EXEC_APPROVALS_PATH, JSON.stringify(config, null, 2));
}

/**
 * Ensure OpenClaw is configured for command interception:
 *
 * 1. exec-approvals.json: ask="always" so ALL commands go through SafeClaw,
 *    askFallback="deny" so unhandled commands are blocked.
 * 2. openclaw.json: tools.exec.host="gateway" so exec uses the gateway
 *    code path that actually checks exec-approvals (sandbox mode skips it).
 */
export function ensureDefaults(): void {
  // --- exec-approvals.json ---
  const config = readExecApprovalsConfig();
  if (!config) {
    logger.warn("exec-approvals.json not found, cannot configure defaults");
    return;
  }

  let changed = false;
  if (!config.defaults) {
    config.defaults = {};
  }

  if (config.defaults.security !== "allowlist") {
    config.defaults.security = "allowlist";
    changed = true;
  }

  // ask="always" ensures every command goes through SafeClaw for the
  // restricted-commands (blocklist) model to work.
  if (config.defaults.ask !== "always") {
    config.defaults.ask = "always";
    changed = true;
  }

  if (config.defaults.askFallback !== "deny") {
    config.defaults.askFallback = "deny";
    changed = true;
  }

  if (changed) {
    writeExecApprovalsConfig(config);
    logger.info(
      { defaults: config.defaults },
      "Configured exec-approvals.json defaults for command interception",
    );
  }

  // --- openclaw.json: ensure tools.exec.host = "gateway" ---
  const openclawConfig = readOpenClawConfig();
  if (openclawConfig) {
    const execHost = openclawConfig.tools?.exec?.host;
    if (execHost !== "gateway") {
      writeOpenClawConfig({ tools: { exec: { host: "gateway" } } });
      logger.info("Set tools.exec.host='gateway' in openclaw.json for exec approval support");
    }
  }
}
