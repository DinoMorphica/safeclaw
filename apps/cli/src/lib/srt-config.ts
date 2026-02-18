import fs from "node:fs";
import { execSync } from "node:child_process";
import { SRT_SETTINGS_PATH } from "./paths.js";
import { readConfig, writeConfig } from "./config.js";
import { srtSettingsSchema } from "@safeclaw/shared";
import type { SrtSettings, SrtStatus } from "@safeclaw/shared";

const DEFAULT_SRT_SETTINGS: SrtSettings = {
  network: {
    allowedDomains: [],
    deniedDomains: [],
    allowLocalBinding: false,
  },
  filesystem: {
    denyRead: [],
    allowWrite: [],
    denyWrite: [],
  },
};

let srtInstalledCache: { installed: boolean; version: string | null } | null = null;

/**
 * Returns the path to the srt settings file.
 * Uses override from SafeClaw config if set, otherwise default ~/.srt-settings.json.
 */
export function getSrtSettingsPath(): string {
  const config = readConfig();
  return config.srt?.settingsPath ?? SRT_SETTINGS_PATH;
}

/**
 * Checks if the `srt` CLI is available on the system.
 * Only caches positive results — rechecks each time if not found,
 * so installing srt while the server is running works without restart.
 */
export function isSrtInstalled(): { installed: boolean; version: string | null } {
  if (srtInstalledCache?.installed) return srtInstalledCache;

  try {
    const output = execSync("srt --version", { timeout: 3000, encoding: "utf-8" }).trim();
    const version = output.replace(/^srt\s*/i, "").trim() || output;
    srtInstalledCache = { installed: true, version };
    return srtInstalledCache;
  } catch {
    return { installed: false, version: null };
  }
}

/**
 * Read the srt settings file. Returns null if file does not exist.
 */
export function readSrtSettings(): SrtSettings | null {
  const settingsPath = getSrtSettingsPath();
  if (!fs.existsSync(settingsPath)) return null;

  try {
    const raw = JSON.parse(fs.readFileSync(settingsPath, "utf-8"));
    return srtSettingsSchema.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Write srt settings to the config file.
 */
export function writeSrtSettings(settings: SrtSettings): void {
  const settingsPath = getSrtSettingsPath();
  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
}

/**
 * Create default srt settings file if it doesn't exist.
 * Returns the current settings.
 */
export function ensureSrtSettings(): SrtSettings {
  const existing = readSrtSettings();
  if (existing) return existing;
  writeSrtSettings(DEFAULT_SRT_SETTINGS);
  return DEFAULT_SRT_SETTINGS;
}

/**
 * Get full SRT status including installation, enabled state, and settings.
 */
export function getSrtStatus(): SrtStatus {
  const { installed, version } = isSrtInstalled();
  const config = readConfig();
  const enabled = config.srt?.enabled ?? false;
  const settingsPath = getSrtSettingsPath();
  const settings = readSrtSettings();

  return { installed, version, enabled, settingsPath, settings };
}

/**
 * Toggle srt enabled state in SafeClaw config.
 * When enabling, ensures the settings file exists with defaults.
 */
export function toggleSrt(enabled: boolean): SrtStatus {
  const config = readConfig();
  writeConfig({
    ...config,
    srt: { ...config.srt, enabled },
  });

  if (enabled) {
    ensureSrtSettings();
  }

  return getSrtStatus();
}

/**
 * Add a domain to the allowed list. Auto-removes from denied list.
 */
export function addAllowedDomain(domain: string): SrtSettings {
  const settings = ensureSrtSettings();
  const normalized = domain.trim().toLowerCase();
  if (!normalized) return settings;

  // Remove from denied if present
  settings.network.deniedDomains = settings.network.deniedDomains.filter((d) => d !== normalized);

  // Add to allowed if not already present
  if (!settings.network.allowedDomains.includes(normalized)) {
    settings.network.allowedDomains.push(normalized);
  }

  writeSrtSettings(settings);
  return settings;
}

/**
 * Remove a domain from the allowed list.
 */
export function removeAllowedDomain(domain: string): SrtSettings {
  const settings = ensureSrtSettings();
  const normalized = domain.trim().toLowerCase();
  settings.network.allowedDomains = settings.network.allowedDomains.filter((d) => d !== normalized);
  writeSrtSettings(settings);
  return settings;
}

/**
 * Add a domain to the denied list. Auto-removes from allowed list.
 */
export function addDeniedDomain(domain: string): SrtSettings {
  const settings = ensureSrtSettings();
  const normalized = domain.trim().toLowerCase();
  if (!normalized) return settings;

  // Remove from allowed if present
  settings.network.allowedDomains = settings.network.allowedDomains.filter((d) => d !== normalized);

  // Add to denied if not already present
  if (!settings.network.deniedDomains.includes(normalized)) {
    settings.network.deniedDomains.push(normalized);
  }

  writeSrtSettings(settings);
  return settings;
}

/**
 * Remove a domain from the denied list.
 */
export function removeDeniedDomain(domain: string): SrtSettings {
  const settings = ensureSrtSettings();
  const normalized = domain.trim().toLowerCase();
  settings.network.deniedDomains = settings.network.deniedDomains.filter((d) => d !== normalized);
  writeSrtSettings(settings);
  return settings;
}

/**
 * Update srt settings with partial values (deep merge for network/filesystem).
 */
export function updateSrtSettings(updates: Partial<SrtSettings>): SrtSettings {
  const settings = ensureSrtSettings();

  if (updates.network) {
    settings.network = { ...settings.network, ...updates.network };
  }
  if (updates.filesystem) {
    settings.filesystem = { ...settings.filesystem, ...updates.filesystem };
  }

  writeSrtSettings(settings);
  return settings;
}
