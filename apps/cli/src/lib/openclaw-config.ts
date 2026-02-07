import fs from "node:fs";
import { OPENCLAW_CONFIG_PATH } from "./paths.js";
import { openClawConfigSchema } from "@safeclaw/shared";
import type { OpenClawConfig } from "@safeclaw/shared";

/**
 * Read the OpenClaw configuration file.
 * Returns null if the file does not exist.
 */
export function readOpenClawConfig(): OpenClawConfig | null {
  if (!fs.existsSync(OPENCLAW_CONFIG_PATH)) {
    return null;
  }

  const raw = JSON.parse(fs.readFileSync(OPENCLAW_CONFIG_PATH, "utf-8"));
  return openClawConfigSchema.parse(raw);
}

/**
 * Deep-merge partial updates into the existing OpenClaw config and write it back.
 * Only writes if the OpenClaw config file already exists (we never create it).
 */
export function writeOpenClawConfig(updates: Partial<OpenClawConfig>): OpenClawConfig | null {
  const current = readOpenClawConfig();
  if (!current) return null;

  const merged = deepMerge(current as Record<string, unknown>, updates as Record<string, unknown>) as OpenClawConfig;
  fs.writeFileSync(OPENCLAW_CONFIG_PATH, JSON.stringify(merged, null, 2));
  return merged;
}

function deepMerge(target: Record<string, unknown>, source: Record<string, unknown>): Record<string, unknown> {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    const srcVal = source[key];
    const tgtVal = target[key];
    if (
      srcVal !== null &&
      typeof srcVal === "object" &&
      !Array.isArray(srcVal) &&
      tgtVal !== null &&
      typeof tgtVal === "object" &&
      !Array.isArray(tgtVal)
    ) {
      result[key] = deepMerge(tgtVal as Record<string, unknown>, srcVal as Record<string, unknown>);
    } else {
      result[key] = srcVal;
    }
  }
  return result;
}
