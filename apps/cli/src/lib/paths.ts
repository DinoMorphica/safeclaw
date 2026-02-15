import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const HOME = os.homedir();

export const SAFECLAW_DIR = path.join(HOME, ".safeclaw");
export const DB_PATH = path.join(SAFECLAW_DIR, "safeclaw.db");
export const CONFIG_PATH = path.join(SAFECLAW_DIR, "config.json");
export const LOGS_DIR = path.join(SAFECLAW_DIR, "logs");
export const DEBUG_LOG_PATH = path.join(LOGS_DIR, "debug.log");

export const OPENCLAW_DIR = path.join(HOME, ".openclaw");
export const OPENCLAW_CONFIG_PATH = path.join(OPENCLAW_DIR, "openclaw.json");
export const OPENCLAW_IDENTITY_DIR = path.join(OPENCLAW_DIR, "identity");
export const OPENCLAW_DEVICE_JSON = path.join(OPENCLAW_IDENTITY_DIR, "device.json");
export const OPENCLAW_DEVICE_AUTH_JSON = path.join(OPENCLAW_IDENTITY_DIR, "device-auth.json");
export const OPENCLAW_EXEC_APPROVALS_PATH = path.join(OPENCLAW_DIR, "exec-approvals.json");

export const SRT_SETTINGS_PATH = path.join(HOME, ".srt-settings.json");

export function getPublicDir(): string {
  const currentDir = path.dirname(new URL(import.meta.url).pathname);
  // In bundled output (dist/main.js), public/ is at ../public
  // In dev mode (src/lib/paths.ts), public/ is at ../../public
  const bundledPath = path.resolve(currentDir, "..", "public");
  const devPath = path.resolve(currentDir, "..", "..", "public");
  return fs.existsSync(bundledPath) ? bundledPath : devPath;
}
