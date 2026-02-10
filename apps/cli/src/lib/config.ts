import fs from "node:fs";
import { CONFIG_PATH, SAFECLAW_DIR, LOGS_DIR } from "./paths.js";
import { safeClawConfigSchema } from "@safeclaw/shared";
import type { SafeClawConfig } from "@safeclaw/shared";
import { VERSION } from "./version.js";

const DEFAULT_CONFIG: SafeClawConfig = {
  version: VERSION,
  port: 54335,
  autoOpenBrowser: true,
  premium: false,
  userId: null,
};

export function ensureDataDir(): void {
  if (!fs.existsSync(SAFECLAW_DIR)) {
    fs.mkdirSync(SAFECLAW_DIR, { recursive: true });
  }
  if (!fs.existsSync(LOGS_DIR)) {
    fs.mkdirSync(LOGS_DIR, { recursive: true });
  }
}

export function readConfig(): SafeClawConfig {
  ensureDataDir();

  if (!fs.existsSync(CONFIG_PATH)) {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(DEFAULT_CONFIG, null, 2));
    return DEFAULT_CONFIG;
  }

  const raw = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8"));
  return safeClawConfigSchema.parse(raw);
}

export function writeConfig(config: SafeClawConfig): void {
  ensureDataDir();
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
}

export function resetConfig(): void {
  writeConfig(DEFAULT_CONFIG);
}
