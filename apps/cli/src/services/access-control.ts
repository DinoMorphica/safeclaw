import type {
  AccessCategory,
  AccessControlState,
  AccessToggleState,
  McpServerState,
  OpenClawConfig,
} from "@safeclaw/shared";
import { readOpenClawConfig, writeOpenClawConfig } from "../lib/openclaw-config.js";
import { getDb, schema } from "../db/index.js";
import { eq, and, sql } from "drizzle-orm";
import { logger } from "../lib/logger.js";

const TOOL_GROUP_MAP: Record<string, string> = {
  filesystem: "group:fs",
  system_commands: "group:runtime",
  network: "group:web",
};

/**
 * Derive per-server MCP states from plugin entries and tools.deny list.
 */
function deriveMcpServerStates(config: OpenClawConfig, denyList: string[]): McpServerState[] {
  const pluginEntries = config.plugins?.entries ?? {};
  return Object.keys(pluginEntries).map((name) => {
    const pluginEnabled = pluginEntries[name].enabled !== false;
    const toolsDenyBlocked = denyList.includes(`mcp__${name}`);
    return {
      name,
      pluginEnabled,
      toolsDenyBlocked,
      effectivelyEnabled: pluginEnabled && !toolsDenyBlocked,
    };
  });
}

/**
 * Read the OpenClaw config and derive the current access control toggle states.
 */
export function deriveAccessState(): AccessControlState {
  const config = readOpenClawConfig();

  if (!config) {
    return {
      toggles: [
        { category: "filesystem", enabled: true },
        { category: "mcp_servers", enabled: true },
        { category: "network", enabled: true },
        { category: "system_commands", enabled: true },
      ],
      mcpServers: [],
      openclawConfigAvailable: false,
    };
  }

  const denyList = config.tools?.deny ?? [];

  const filesystemEnabled = !denyList.includes("group:fs");
  const systemCommandsEnabled = !denyList.includes("group:runtime");
  const networkEnabled = !denyList.includes("group:web") && config.browser?.enabled !== false;

  // MCP: enabled if there are no plugins, or at least one plugin is enabled
  const pluginEntries = config.plugins?.entries ?? {};
  const pluginNames = Object.keys(pluginEntries);
  const mcpEnabled =
    pluginNames.length === 0 || pluginNames.some((name) => pluginEntries[name].enabled !== false);

  const toggles: AccessToggleState[] = [
    { category: "filesystem", enabled: filesystemEnabled },
    { category: "mcp_servers", enabled: mcpEnabled },
    { category: "network", enabled: networkEnabled },
    { category: "system_commands", enabled: systemCommandsEnabled },
  ];

  const mcpServers = deriveMcpServerStates(config, denyList);

  return { toggles, mcpServers, openclawConfigAvailable: true };
}

/**
 * Apply an access toggle change: write to OpenClaw config and update audit DB.
 * Returns the full access control state.
 */
export async function applyAccessToggle(
  category: AccessCategory,
  enabled: boolean,
): Promise<AccessControlState> {
  const config = readOpenClawConfig();
  if (!config) {
    throw new Error("OpenClaw config not found");
  }

  if (category === "mcp_servers") {
    await applyMcpToggle(config, enabled);
  } else if (category === "network") {
    applyNetworkToggle(config, enabled);
  } else {
    applyToolGroupToggle(config, category, enabled);
  }

  await updateAuditDb(category, enabled);

  return deriveAccessState();
}

/**
 * Toggle an individual MCP server by adding/removing mcp__<name> from tools.deny.
 */
export async function applyMcpServerToggle(
  serverName: string,
  enabled: boolean,
): Promise<AccessControlState> {
  const config = readOpenClawConfig();
  if (!config) {
    throw new Error("OpenClaw config not found");
  }

  const denyPattern = `mcp__${serverName}`;
  const currentDeny = [...(config.tools?.deny ?? [])];

  if (enabled) {
    const filtered = currentDeny.filter((entry) => entry !== denyPattern);
    writeOpenClawConfig({ tools: { deny: filtered } });
  } else {
    if (!currentDeny.includes(denyPattern)) {
      currentDeny.push(denyPattern);
    }
    writeOpenClawConfig({ tools: { deny: currentDeny } });
  }

  await updateAuditDb(`mcp_server:${serverName}`, enabled);

  return deriveAccessState();
}

/**
 * Add or remove a tool group from tools.deny.
 */
function applyToolGroupToggle(config: OpenClawConfig, category: string, enabled: boolean): void {
  const groupName = TOOL_GROUP_MAP[category];
  if (!groupName) return;

  const currentDeny = [...(config.tools?.deny ?? [])];

  if (enabled) {
    const filtered = currentDeny.filter((entry) => entry !== groupName);
    writeOpenClawConfig({ tools: { deny: filtered } });
  } else {
    if (!currentDeny.includes(groupName)) {
      currentDeny.push(groupName);
    }
    writeOpenClawConfig({ tools: { deny: currentDeny } });
  }
}

/**
 * Toggle network access: manages group:web deny entry and browser.enabled.
 */
function applyNetworkToggle(config: OpenClawConfig, enabled: boolean): void {
  const currentDeny = [...(config.tools?.deny ?? [])];
  const groupName = "group:web";

  if (enabled) {
    const filtered = currentDeny.filter((entry) => entry !== groupName);
    writeOpenClawConfig({
      tools: { deny: filtered },
      browser: { enabled: true },
    });
  } else {
    if (!currentDeny.includes(groupName)) {
      currentDeny.push(groupName);
    }
    writeOpenClawConfig({
      tools: { deny: currentDeny },
      browser: { enabled: false },
    });
  }
}

/**
 * Toggle MCP servers: disable/enable all plugins and sync tools.deny.
 * Saves previous states before disabling so they can be restored.
 */
async function applyMcpToggle(config: OpenClawConfig, enabled: boolean): Promise<void> {
  const pluginEntries = config.plugins?.entries ?? {};
  const pluginNames = Object.keys(pluginEntries);

  if (pluginNames.length === 0) return;

  const currentDeny = [...(config.tools?.deny ?? [])];

  if (!enabled) {
    // Save current plugin states before disabling
    const stateMap: Record<string, boolean> = {};
    for (const name of pluginNames) {
      stateMap[name] = pluginEntries[name].enabled !== false;
    }
    await savePreviousPluginState(stateMap);

    // Disable all plugins
    const disabledEntries: Record<string, { enabled: boolean }> = {};
    for (const name of pluginNames) {
      disabledEntries[name] = { enabled: false };
    }

    // Also add mcp__<name> to tools.deny for each plugin
    for (const name of pluginNames) {
      const denyPattern = `mcp__${name}`;
      if (!currentDeny.includes(denyPattern)) {
        currentDeny.push(denyPattern);
      }
    }

    writeOpenClawConfig({
      plugins: { entries: disabledEntries },
      tools: { deny: currentDeny },
    });
  } else {
    // Restore previous plugin states
    const previousState = await loadPreviousPluginState();

    const restoredEntries: Record<string, { enabled: boolean }> = {};
    for (const name of pluginNames) {
      restoredEntries[name] = {
        enabled: previousState?.[name] ?? true,
      };
    }

    // Remove mcp__<name> entries from tools.deny for all plugins
    const mcpDenyPatterns = new Set(pluginNames.map((n) => `mcp__${n}`));
    const filteredDeny = currentDeny.filter((entry) => !mcpDenyPatterns.has(entry));

    writeOpenClawConfig({
      plugins: { entries: restoredEntries },
      tools: { deny: filteredDeny },
    });
  }
}

async function savePreviousPluginState(stateMap: Record<string, boolean>): Promise<void> {
  const db = getDb();
  const existing = await db
    .select()
    .from(schema.accessConfig)
    .where(
      and(
        eq(schema.accessConfig.category, "mcp_servers"),
        eq(schema.accessConfig.key, "previous_plugin_state"),
      ),
    );

  if (existing.length > 0) {
    await db
      .update(schema.accessConfig)
      .set({
        value: JSON.stringify(stateMap),
        updatedAt: sql`datetime('now')`,
      })
      .where(
        and(
          eq(schema.accessConfig.category, "mcp_servers"),
          eq(schema.accessConfig.key, "previous_plugin_state"),
        ),
      );
  } else {
    await db.insert(schema.accessConfig).values({
      category: "mcp_servers",
      key: "previous_plugin_state",
      value: JSON.stringify(stateMap),
    });
  }
}

async function loadPreviousPluginState(): Promise<Record<string, boolean> | null> {
  const db = getDb();
  const rows = await db
    .select()
    .from(schema.accessConfig)
    .where(
      and(
        eq(schema.accessConfig.category, "mcp_servers"),
        eq(schema.accessConfig.key, "previous_plugin_state"),
      ),
    );

  if (rows.length === 0) return null;

  try {
    return JSON.parse(rows[0].value) as Record<string, boolean>;
  } catch {
    return null;
  }
}

/**
 * Update SafeClaw's access_config table as an audit trail.
 */
async function updateAuditDb(category: string, enabled: boolean): Promise<void> {
  const db = getDb();
  try {
    await db
      .update(schema.accessConfig)
      .set({
        value: enabled ? "true" : "false",
        updatedAt: sql`datetime('now')`,
      })
      .where(
        and(eq(schema.accessConfig.category, category), eq(schema.accessConfig.key, "enabled")),
      );
  } catch (err) {
    logger.warn({ err, category, enabled }, "Failed to update audit DB");
  }
}
