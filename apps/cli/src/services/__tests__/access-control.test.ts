import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import type { OpenClawConfig } from "@safeclaw/shared";
import { createTestDb } from "./test-helpers.js";

// --- Mutable state for mocks ---

let testDb: ReturnType<typeof createTestDb>;
let mockConfig: OpenClawConfig | null = null;

const realSchema = await import("../../db/schema.js");

// Deep merge matching openclaw-config.ts behavior: objects merge, arrays replace
function deepMerge(
  target: Record<string, unknown>,
  source: Record<string, unknown>,
): Record<string, unknown> {
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

// --- Module mocks (BEFORE importing the module under test) ---

vi.mock("../../db/index.js", () => ({
  get getDb() {
    return () => testDb;
  },
  schema: realSchema,
}));

vi.mock("../../lib/logger.js", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

const writeConfigSpy = vi.fn((updates: Partial<OpenClawConfig>) => {
  if (!mockConfig) return null;
  mockConfig = deepMerge(
    mockConfig as unknown as Record<string, unknown>,
    updates as unknown as Record<string, unknown>,
  ) as unknown as OpenClawConfig;
  return mockConfig;
});

vi.mock("../../lib/openclaw-config.js", () => ({
  readOpenClawConfig: () => mockConfig,
  writeOpenClawConfig: (updates: Partial<OpenClawConfig>) => writeConfigSpy(updates),
}));

// --- Import module under test AFTER mocks ---

const { deriveAccessState, applyAccessToggle, applyMcpServerToggle } =
  await import("../access-control.js");

// --- Helpers ---

function makeConfig(overrides: Partial<OpenClawConfig> = {}): OpenClawConfig {
  return {
    tools: { deny: [], ...(overrides.tools ?? {}) },
    plugins: { entries: {}, ...(overrides.plugins ?? {}) },
    browser: { enabled: true, ...(overrides.browser ?? {}) },
    ...overrides,
  };
}

// --- Tests ---

describe("access-control", () => {
  beforeEach(() => {
    testDb = createTestDb();
    mockConfig = null;
    writeConfigSpy.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // =========================================================================
  // deriveAccessState
  // =========================================================================

  describe("deriveAccessState", () => {
    it("should return defaults when OpenClaw config is null", () => {
      mockConfig = null;
      const state = deriveAccessState();

      expect(state.openclawConfigAvailable).toBe(false);
      expect(state.mcpServers).toEqual([]);
      expect(state.toggles).toEqual([
        { category: "filesystem", enabled: true },
        { category: "mcp_servers", enabled: true },
        { category: "network", enabled: true },
        { category: "system_commands", enabled: true },
      ]);
    });

    it("should derive filesystem enabled when group:fs not in deny", () => {
      mockConfig = makeConfig({ tools: { deny: [] } });
      const state = deriveAccessState();
      const fs = state.toggles.find((t) => t.category === "filesystem");
      expect(fs?.enabled).toBe(true);
    });

    it("should derive filesystem disabled when group:fs in deny", () => {
      mockConfig = makeConfig({ tools: { deny: ["group:fs"] } });
      const state = deriveAccessState();
      const fs = state.toggles.find((t) => t.category === "filesystem");
      expect(fs?.enabled).toBe(false);
    });

    it("should derive system_commands enabled when group:runtime not in deny", () => {
      mockConfig = makeConfig({ tools: { deny: [] } });
      const state = deriveAccessState();
      const sc = state.toggles.find((t) => t.category === "system_commands");
      expect(sc?.enabled).toBe(true);
    });

    it("should derive system_commands disabled when group:runtime in deny", () => {
      mockConfig = makeConfig({ tools: { deny: ["group:runtime"] } });
      const state = deriveAccessState();
      const sc = state.toggles.find((t) => t.category === "system_commands");
      expect(sc?.enabled).toBe(false);
    });

    it("should derive network enabled when group:web not in deny and browser enabled", () => {
      mockConfig = makeConfig({
        tools: { deny: [] },
        browser: { enabled: true },
      });
      const state = deriveAccessState();
      const net = state.toggles.find((t) => t.category === "network");
      expect(net?.enabled).toBe(true);
    });

    it("should derive network disabled when group:web in deny", () => {
      mockConfig = makeConfig({
        tools: { deny: ["group:web"] },
        browser: { enabled: true },
      });
      const state = deriveAccessState();
      const net = state.toggles.find((t) => t.category === "network");
      expect(net?.enabled).toBe(false);
    });

    it("should derive network disabled when browser.enabled is false", () => {
      mockConfig = makeConfig({
        tools: { deny: [] },
        browser: { enabled: false },
      });
      const state = deriveAccessState();
      const net = state.toggles.find((t) => t.category === "network");
      expect(net?.enabled).toBe(false);
    });

    it("should derive MCP master enabled when at least one plugin is enabled", () => {
      mockConfig = makeConfig({
        plugins: {
          entries: {
            github: { enabled: true },
            sentry: { enabled: false },
          },
        },
      });
      const state = deriveAccessState();
      const mcp = state.toggles.find((t) => t.category === "mcp_servers");
      expect(mcp?.enabled).toBe(true);
    });

    it("should derive MCP master disabled when all plugins are disabled", () => {
      mockConfig = makeConfig({
        plugins: {
          entries: {
            github: { enabled: false },
            sentry: { enabled: false },
          },
        },
      });
      const state = deriveAccessState();
      const mcp = state.toggles.find((t) => t.category === "mcp_servers");
      expect(mcp?.enabled).toBe(false);
    });

    it("should derive MCP master enabled when no plugins exist", () => {
      mockConfig = makeConfig({ plugins: { entries: {} } });
      const state = deriveAccessState();
      const mcp = state.toggles.find((t) => t.category === "mcp_servers");
      expect(mcp?.enabled).toBe(true);
    });

    it("should list all plugin entries in mcpServers", () => {
      mockConfig = makeConfig({
        plugins: {
          entries: {
            github: { enabled: true },
            sentry: { enabled: true },
            notion: { enabled: false },
          },
        },
      });
      const state = deriveAccessState();
      expect(state.mcpServers).toHaveLength(3);
      const names = state.mcpServers.map((s) => s.name);
      expect(names).toContain("github");
      expect(names).toContain("sentry");
      expect(names).toContain("notion");
    });

    it("should mark server as effectivelyEnabled when plugin enabled and not in deny", () => {
      mockConfig = makeConfig({
        plugins: { entries: { github: { enabled: true } } },
        tools: { deny: [] },
      });
      const state = deriveAccessState();
      const gh = state.mcpServers.find((s) => s.name === "github");
      expect(gh?.pluginEnabled).toBe(true);
      expect(gh?.toolsDenyBlocked).toBe(false);
      expect(gh?.effectivelyEnabled).toBe(true);
    });

    it("should mark server as not effectivelyEnabled when mcp__name in deny", () => {
      mockConfig = makeConfig({
        plugins: { entries: { github: { enabled: true } } },
        tools: { deny: ["mcp__github"] },
      });
      const state = deriveAccessState();
      const gh = state.mcpServers.find((s) => s.name === "github");
      expect(gh?.pluginEnabled).toBe(true);
      expect(gh?.toolsDenyBlocked).toBe(true);
      expect(gh?.effectivelyEnabled).toBe(false);
    });

    it("should mark server as not effectivelyEnabled when plugin disabled", () => {
      mockConfig = makeConfig({
        plugins: { entries: { github: { enabled: false } } },
        tools: { deny: [] },
      });
      const state = deriveAccessState();
      const gh = state.mcpServers.find((s) => s.name === "github");
      expect(gh?.pluginEnabled).toBe(false);
      expect(gh?.toolsDenyBlocked).toBe(false);
      expect(gh?.effectivelyEnabled).toBe(false);
    });

    it("should handle mix of blocked and unblocked servers", () => {
      mockConfig = makeConfig({
        plugins: {
          entries: {
            github: { enabled: true },
            sentry: { enabled: true },
            notion: { enabled: false },
          },
        },
        tools: { deny: ["mcp__sentry"] },
      });
      const state = deriveAccessState();

      const gh = state.mcpServers.find((s) => s.name === "github");
      expect(gh?.effectivelyEnabled).toBe(true);

      const se = state.mcpServers.find((s) => s.name === "sentry");
      expect(se?.effectivelyEnabled).toBe(false);
      expect(se?.toolsDenyBlocked).toBe(true);

      const no = state.mcpServers.find((s) => s.name === "notion");
      expect(no?.effectivelyEnabled).toBe(false);
      expect(no?.pluginEnabled).toBe(false);
    });

    it("should return empty mcpServers when no plugins configured", () => {
      mockConfig = makeConfig({ plugins: { entries: {} } });
      const state = deriveAccessState();
      expect(state.mcpServers).toEqual([]);
    });
  });

  // =========================================================================
  // applyAccessToggle - tool groups (filesystem, system_commands)
  // =========================================================================

  describe("applyAccessToggle - tool groups", () => {
    it("should add group:fs to deny when disabling filesystem", async () => {
      mockConfig = makeConfig({ tools: { deny: [] } });
      await applyAccessToggle("filesystem", false);
      expect(writeConfigSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          tools: { deny: ["group:fs"] },
        }),
      );
    });

    it("should remove group:fs from deny when enabling filesystem", async () => {
      mockConfig = makeConfig({ tools: { deny: ["group:fs", "group:web"] } });
      await applyAccessToggle("filesystem", true);
      expect(writeConfigSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          tools: { deny: ["group:web"] },
        }),
      );
    });

    it("should add group:runtime to deny when disabling system_commands", async () => {
      mockConfig = makeConfig({ tools: { deny: [] } });
      await applyAccessToggle("system_commands", false);
      expect(writeConfigSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          tools: { deny: ["group:runtime"] },
        }),
      );
    });

    it("should remove group:runtime from deny when enabling system_commands", async () => {
      mockConfig = makeConfig({ tools: { deny: ["group:runtime"] } });
      await applyAccessToggle("system_commands", true);
      expect(writeConfigSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          tools: { deny: [] },
        }),
      );
    });

    it("should preserve existing deny entries when adding a new group", async () => {
      mockConfig = makeConfig({
        tools: { deny: ["group:web", "mcp__github"] },
      });
      await applyAccessToggle("filesystem", false);
      expect(writeConfigSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          tools: { deny: ["group:web", "mcp__github", "group:fs"] },
        }),
      );
    });

    it("should not duplicate group in deny if already present", async () => {
      mockConfig = makeConfig({ tools: { deny: ["group:fs"] } });
      await applyAccessToggle("filesystem", false);
      expect(writeConfigSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          tools: { deny: ["group:fs"] },
        }),
      );
    });

    it("should throw when OpenClaw config not found", async () => {
      mockConfig = null;
      await expect(applyAccessToggle("filesystem", false)).rejects.toThrow(
        "OpenClaw config not found",
      );
    });

    it("should return full AccessControlState", async () => {
      mockConfig = makeConfig({ tools: { deny: [] } });
      const result = await applyAccessToggle("filesystem", false);
      expect(result).toHaveProperty("toggles");
      expect(result).toHaveProperty("mcpServers");
      expect(result).toHaveProperty("openclawConfigAvailable");
    });
  });

  // =========================================================================
  // applyAccessToggle - network
  // =========================================================================

  describe("applyAccessToggle - network", () => {
    it("should add group:web to deny and set browser.enabled=false when disabling", async () => {
      mockConfig = makeConfig({
        tools: { deny: [] },
        browser: { enabled: true },
      });
      await applyAccessToggle("network", false);
      expect(writeConfigSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          tools: { deny: ["group:web"] },
          browser: { enabled: false },
        }),
      );
    });

    it("should remove group:web from deny and set browser.enabled=true when enabling", async () => {
      mockConfig = makeConfig({
        tools: { deny: ["group:web", "group:fs"] },
        browser: { enabled: false },
      });
      await applyAccessToggle("network", true);
      expect(writeConfigSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          tools: { deny: ["group:fs"] },
          browser: { enabled: true },
        }),
      );
    });
  });

  // =========================================================================
  // applyAccessToggle - MCP master toggle
  // =========================================================================

  describe("applyAccessToggle - MCP master", () => {
    it("should disable all plugins and add mcp__ entries to deny", async () => {
      mockConfig = makeConfig({
        plugins: {
          entries: {
            github: { enabled: true },
            sentry: { enabled: true },
          },
        },
        tools: { deny: ["group:fs"] },
      });
      await applyAccessToggle("mcp_servers", false);

      expect(writeConfigSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          plugins: {
            entries: {
              github: { enabled: false },
              sentry: { enabled: false },
            },
          },
          tools: {
            deny: expect.arrayContaining(["group:fs", "mcp__github", "mcp__sentry"]),
          },
        }),
      );
    });

    it("should restore previous plugin states and remove mcp__ from deny when enabling", async () => {
      // First disable to save state
      mockConfig = makeConfig({
        plugins: {
          entries: {
            github: { enabled: true },
            sentry: { enabled: false },
          },
        },
        tools: { deny: [] },
      });
      await applyAccessToggle("mcp_servers", false);

      // Now re-enable - should restore github=true, sentry=false
      writeConfigSpy.mockClear();
      await applyAccessToggle("mcp_servers", true);

      expect(writeConfigSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          plugins: {
            entries: {
              github: { enabled: true },
              sentry: { enabled: false },
            },
          },
        }),
      );

      // Verify mcp__ entries removed from deny
      const denyArg = writeConfigSpy.mock.calls[0]?.[0]?.tools?.deny;
      expect(denyArg).not.toContain("mcp__github");
      expect(denyArg).not.toContain("mcp__sentry");
    });

    it("should save plugin states to DB before disabling", async () => {
      mockConfig = makeConfig({
        plugins: {
          entries: {
            github: { enabled: true },
            sentry: { enabled: false },
          },
        },
        tools: { deny: [] },
      });
      await applyAccessToggle("mcp_servers", false);

      // Verify the state was saved to access_config table
      const rows = await testDb.select().from(realSchema.accessConfig);

      const savedRow = rows.find(
        (r) => r.category === "mcp_servers" && r.key === "previous_plugin_state",
      );
      expect(savedRow).toBeDefined();
      const parsed = JSON.parse(savedRow!.value);
      expect(parsed).toEqual({ github: true, sentry: false });
    });

    it("should default to enabled when no previous state exists", async () => {
      // Set up config with all plugins disabled (as if master was turned off)
      // but don't save any previous state
      mockConfig = makeConfig({
        plugins: {
          entries: {
            github: { enabled: false },
            sentry: { enabled: false },
          },
        },
        tools: { deny: ["mcp__github", "mcp__sentry"] },
      });

      await applyAccessToggle("mcp_servers", true);

      // With no saved state, should default all to enabled
      expect(writeConfigSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          plugins: {
            entries: {
              github: { enabled: true },
              sentry: { enabled: true },
            },
          },
        }),
      );
    });

    it("should do nothing when no plugins exist", async () => {
      mockConfig = makeConfig({ plugins: { entries: {} }, tools: { deny: [] } });
      await applyAccessToggle("mcp_servers", false);
      // writeOpenClawConfig should NOT have been called for plugins/deny
      // It IS called once for the audit DB path, but the MCP toggle itself should bail early
      expect(writeConfigSpy).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // applyMcpServerToggle - per-server
  // =========================================================================

  describe("applyMcpServerToggle", () => {
    it("should add mcp__servername to deny when disabling", async () => {
      mockConfig = makeConfig({
        plugins: { entries: { github: { enabled: true } } },
        tools: { deny: [] },
      });
      await applyMcpServerToggle("github", false);
      expect(writeConfigSpy).toHaveBeenCalledWith({
        tools: { deny: ["mcp__github"] },
      });
    });

    it("should remove mcp__servername from deny when enabling", async () => {
      mockConfig = makeConfig({
        plugins: { entries: { github: { enabled: true } } },
        tools: { deny: ["mcp__github", "group:fs"] },
      });
      await applyMcpServerToggle("github", true);
      expect(writeConfigSpy).toHaveBeenCalledWith({
        tools: { deny: ["group:fs"] },
      });
    });

    it("should preserve other deny entries when toggling a server", async () => {
      mockConfig = makeConfig({
        plugins: {
          entries: {
            github: { enabled: true },
            sentry: { enabled: true },
          },
        },
        tools: { deny: ["group:web", "mcp__sentry"] },
      });
      await applyMcpServerToggle("github", false);
      expect(writeConfigSpy).toHaveBeenCalledWith({
        tools: { deny: ["group:web", "mcp__sentry", "mcp__github"] },
      });
    });

    it("should not duplicate mcp__servername if already in deny", async () => {
      mockConfig = makeConfig({
        plugins: { entries: { github: { enabled: true } } },
        tools: { deny: ["mcp__github"] },
      });
      await applyMcpServerToggle("github", false);
      expect(writeConfigSpy).toHaveBeenCalledWith({
        tools: { deny: ["mcp__github"] },
      });
    });

    it("should throw when OpenClaw config not found", async () => {
      mockConfig = null;
      await expect(applyMcpServerToggle("github", false)).rejects.toThrow(
        "OpenClaw config not found",
      );
    });

    it("should return full AccessControlState after toggle", async () => {
      mockConfig = makeConfig({
        plugins: { entries: { github: { enabled: true } } },
        tools: { deny: [] },
      });
      const result = await applyMcpServerToggle("github", false);
      expect(result).toHaveProperty("toggles");
      expect(result).toHaveProperty("mcpServers");
      expect(result).toHaveProperty("openclawConfigAvailable", true);
    });

    it("should reflect the change in the returned state", async () => {
      mockConfig = makeConfig({
        plugins: { entries: { github: { enabled: true } } },
        tools: { deny: [] },
      });
      const result = await applyMcpServerToggle("github", false);
      const gh = result.mcpServers.find((s) => s.name === "github");
      expect(gh?.toolsDenyBlocked).toBe(true);
      expect(gh?.effectivelyEnabled).toBe(false);
    });

    it("should allow re-enabling a blocked server", async () => {
      mockConfig = makeConfig({
        plugins: { entries: { github: { enabled: true } } },
        tools: { deny: ["mcp__github"] },
      });
      const result = await applyMcpServerToggle("github", true);
      const gh = result.mcpServers.find((s) => s.name === "github");
      expect(gh?.toolsDenyBlocked).toBe(false);
      expect(gh?.effectivelyEnabled).toBe(true);
    });
  });

  // =========================================================================
  // Edge cases
  // =========================================================================

  describe("edge cases", () => {
    it("should handle config with no tools section", () => {
      mockConfig = { plugins: { entries: { github: { enabled: true } } } };
      const state = deriveAccessState();
      // No tools.deny means all tool groups enabled
      expect(state.toggles.find((t) => t.category === "filesystem")?.enabled).toBe(true);
      expect(state.toggles.find((t) => t.category === "system_commands")?.enabled).toBe(true);
      expect(state.mcpServers).toHaveLength(1);
      expect(state.mcpServers[0].toolsDenyBlocked).toBe(false);
    });

    it("should handle config with empty tools.deny", () => {
      mockConfig = makeConfig({ tools: { deny: [] } });
      const state = deriveAccessState();
      for (const toggle of state.toggles) {
        expect(toggle.enabled).toBe(true);
      }
    });

    it("should handle config with no plugins section", () => {
      mockConfig = { tools: { deny: [] } };
      const state = deriveAccessState();
      expect(state.mcpServers).toEqual([]);
      expect(state.toggles.find((t) => t.category === "mcp_servers")?.enabled).toBe(true);
    });

    it("should handle applyMcpServerToggle on config with no tools section", async () => {
      mockConfig = {
        plugins: { entries: { github: { enabled: true } } },
      };
      await applyMcpServerToggle("github", false);
      expect(writeConfigSpy).toHaveBeenCalledWith({
        tools: { deny: ["mcp__github"] },
      });
    });

    it("should handle multiple tool groups in deny simultaneously", () => {
      mockConfig = makeConfig({
        tools: { deny: ["group:fs", "group:runtime", "group:web", "mcp__github"] },
        browser: { enabled: false },
        plugins: { entries: { github: { enabled: true } } },
      });
      const state = deriveAccessState();
      expect(state.toggles.find((t) => t.category === "filesystem")?.enabled).toBe(false);
      expect(state.toggles.find((t) => t.category === "system_commands")?.enabled).toBe(false);
      expect(state.toggles.find((t) => t.category === "network")?.enabled).toBe(false);
      expect(state.mcpServers[0].toolsDenyBlocked).toBe(true);
    });
  });
});
