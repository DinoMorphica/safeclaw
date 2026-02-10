import pc from "picocolors";
import { readConfig, writeConfig, ensureDataDir } from "../lib/config.js";
import type { SafeClawConfig } from "@safeclaw/shared";

const SETTABLE_KEYS: Record<
  string,
  {
    type: "number" | "boolean" | "string";
    description: string;
    validate?: (value: string) => string | null;
  }
> = {
  port: {
    type: "number",
    description: "Server port (1024-65535)",
    validate: (v) => {
      const n = parseInt(v, 10);
      if (isNaN(n) || n < 1024 || n > 65535)
        return "Port must be an integer between 1024 and 65535";
      return null;
    },
  },
  autoOpenBrowser: {
    type: "boolean",
    description: "Auto-open browser on start (true/false)",
    validate: (v) => {
      if (v !== "true" && v !== "false")
        return 'Value must be "true" or "false"';
      return null;
    },
  },
  premium: {
    type: "boolean",
    description: "Premium features enabled (true/false)",
    validate: (v) => {
      if (v !== "true" && v !== "false")
        return 'Value must be "true" or "false"';
      return null;
    },
  },
};

export async function configListCommand(): Promise<void> {
  ensureDataDir();
  const config = readConfig();

  console.log(pc.bold("\nSafeClaw Configuration"));
  console.log(pc.dim("─".repeat(40)));

  for (const [key, value] of Object.entries(config)) {
    const meta = SETTABLE_KEYS[key];
    const displayValue =
      typeof value === "string" ? `"${value}"` : String(value);
    const settable = meta ? "" : pc.dim(" (read-only)");
    console.log(`  ${pc.cyan(key)}: ${displayValue}${settable}`);
  }
  console.log();
}

export async function configGetCommand(key: string): Promise<void> {
  ensureDataDir();
  const config = readConfig();

  if (!(key in config)) {
    process.stderr.write(
      pc.red(`Unknown config key: ${key}\n`) +
        pc.dim(`Available keys: ${Object.keys(config).join(", ")}\n`),
    );
    process.exit(1);
  }

  const value = config[key as keyof SafeClawConfig];
  console.log(value);
}

export async function configSetCommand(
  key: string,
  value: string,
): Promise<void> {
  ensureDataDir();
  const config = readConfig();

  const meta = SETTABLE_KEYS[key];
  if (!meta) {
    if (key in config) {
      process.stderr.write(pc.red(`Config key "${key}" is read-only.\n`));
    } else {
      process.stderr.write(
        pc.red(`Unknown config key: ${key}\n`) +
          pc.dim(
            `Settable keys: ${Object.keys(SETTABLE_KEYS).join(", ")}\n`,
          ),
      );
    }
    process.exit(1);
  }

  if (meta.validate) {
    const error = meta.validate(value);
    if (error) {
      process.stderr.write(pc.red(`Invalid value: ${error}\n`));
      process.exit(1);
    }
  }

  let coerced: string | number | boolean = value;
  if (meta.type === "number") coerced = parseInt(value, 10);
  if (meta.type === "boolean") coerced = value === "true";

  const updated = { ...config, [key]: coerced };
  writeConfig(updated);

  console.log(pc.green(`Set ${key} = ${coerced}`));
}
