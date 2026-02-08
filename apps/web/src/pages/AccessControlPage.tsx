import { useEffect, useState } from "react";
import { socket } from "../lib/socket";
import type {
  AccessControlState,
  AccessToggleState,
  OpenClawConfig,
} from "@safeclaw/shared";

const CATEGORY_META: Record<
  string,
  { title: string; description: string }
> = {
  filesystem: {
    title: "File System Access",
    description:
      "Controls read, write, edit, and apply_patch tools. Modifies the group:fs entry in OpenClaw's tool deny list.",
  },
  mcp_servers: {
    title: "MCP Servers (Plugins)",
    description:
      "Master toggle for all OpenClaw plugins. Per-plugin control is available on the OpenClaw Config page.",
  },
  network: {
    title: "Network Access",
    description:
      "Controls web_search, web_fetch tools and the browser. Modifies group:web deny list and browser.enabled.",
  },
  system_commands: {
    title: "System Commands",
    description:
      "Controls exec, bash, and process tools. Modifies the group:runtime entry in OpenClaw's tool deny list.",
  },
};

const CATEGORY_ORDER = [
  "filesystem",
  "mcp_servers",
  "network",
  "system_commands",
];

export function AccessControlPage() {
  const [state, setState] = useState<AccessControlState | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);
  const [openclawConfig, setOpenclawConfig] = useState<OpenClawConfig | null>(
    null,
  );

  // Workspace & sandbox settings (local state for the form)
  const [workspacePath, setWorkspacePath] = useState("");
  const [workspaceAccess, setWorkspaceAccess] = useState("rw");
  const [sandboxModeLocal, setSandboxModeLocal] = useState("off");
  const [bindMounts, setBindMounts] = useState<string[]>([]);
  const [dockerNetwork, setDockerNetwork] = useState("");
  const [savingWorkspace, setSavingWorkspace] = useState(false);

  // Add bind mount form
  const [newBindHost, setNewBindHost] = useState("");
  const [newBindContainer, setNewBindContainer] = useState("");
  const [newBindMode, setNewBindMode] = useState("ro");

  useEffect(() => {
    socket.emit("safeclaw:getAccessControlState");
    socket.emit("safeclaw:getOpenclawConfig");

    const accessHandler = (data: AccessControlState) => {
      setState(data);
      setToggling(null);
    };

    const configHandler = (data: OpenClawConfig | null) => {
      if (!data) return;
      setOpenclawConfig(data);
      setWorkspacePath(data.agents?.defaults?.workspace ?? "");
      setWorkspaceAccess(
        data.agents?.defaults?.sandbox?.workspaceAccess ?? "rw",
      );
      setSandboxModeLocal(data.agents?.defaults?.sandbox?.mode ?? "off");
      setBindMounts(data.agents?.defaults?.sandbox?.docker?.binds ?? []);
      setDockerNetwork(data.agents?.defaults?.sandbox?.docker?.network ?? "");
    };

    socket.on("safeclaw:accessControlState", accessHandler);
    socket.on("safeclaw:openclawConfig", configHandler);
    return () => {
      socket.off("safeclaw:accessControlState", accessHandler);
      socket.off("safeclaw:openclawConfig", configHandler);
    };
  }, []);

  const handleToggle = (category: string, currentEnabled: boolean) => {
    setToggling(category);
    socket.emit("safeclaw:toggleAccess", {
      category,
      enabled: !currentEnabled,
    });
  };

  const saveWorkspaceSettings = () => {
    setSavingWorkspace(true);
    const sandboxMode = sandboxModeLocal as "off" | "non-main" | "all";
    const updates: Partial<OpenClawConfig> = {
      agents: {
        defaults: {
          workspace: workspacePath || undefined,
          sandbox: {
            mode: sandboxMode,
            workspaceAccess: workspaceAccess as "none" | "ro" | "rw",
            docker:
              sandboxMode !== "off"
                ? {
                    binds: bindMounts.length > 0 ? bindMounts : undefined,
                    network: dockerNetwork || undefined,
                  }
                : undefined,
          },
        },
      },
    };
    socket.emit("safeclaw:updateOpenclawConfig", updates);
    setTimeout(() => setSavingWorkspace(false), 600);
  };

  const addBindMount = () => {
    if (!newBindHost.trim()) return;
    const container = newBindContainer.trim() || newBindHost.trim();
    const entry = `${newBindHost.trim()}:${container}:${newBindMode}`;
    setBindMounts((prev) => [...prev, entry]);
    setNewBindHost("");
    setNewBindContainer("");
    setNewBindMode("ro");
  };

  const removeBindMount = (index: number) => {
    setBindMounts((prev) => prev.filter((_, i) => i !== index));
  };

  if (!state) {
    return (
      <div>
        <h2 className="text-2xl font-bold mb-6">Access Control</h2>
        <p className="text-gray-500">Loading access control state...</p>
      </div>
    );
  }

  if (!state.openclawConfigAvailable) {
    return (
      <div>
        <h2 className="text-2xl font-bold mb-6">Access Control</h2>
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-6">
          <p className="text-gray-400">
            OpenClaw config not found at{" "}
            <code className="text-gray-300">~/.openclaw/openclaw.json</code>.
          </p>
          <p className="text-gray-500 mt-2 text-sm">
            Install and configure OpenClaw first, then return here to manage
            access controls.
          </p>
        </div>
      </div>
    );
  }

  const toggleMap = new Map<string, AccessToggleState>();
  for (const t of state.toggles) {
    toggleMap.set(t.category, t);
  }

  const isSandboxed = sandboxModeLocal === "all" || sandboxModeLocal === "non-main";

  return (
    <div>
      <h2 className="text-2xl font-bold mb-2">Access Control</h2>
      <p className="text-sm text-gray-500 mb-6">
        Control what OpenClaw can access. Changes are written directly to{" "}
        <code className="text-gray-400">~/.openclaw/openclaw.json</code>.
      </p>

      <div className="space-y-4">
        {CATEGORY_ORDER.map((category) => {
          const toggle = toggleMap.get(category);
          if (!toggle) return null;
          const meta = CATEGORY_META[category];
          if (!meta) return null;
          const isEnabled = toggle.enabled;
          const isToggling = toggling === category;

          return (
            <div key={category}>
              <div className="rounded-xl border border-gray-800 bg-gray-900 p-6">
                <div className="flex items-center justify-between">
                  <div className="flex-1 mr-4">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-medium text-gray-200">
                        {meta.title}
                      </h3>
                      {!isEnabled && (
                        <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-red-900/50 text-red-400 border border-red-700/50">
                          RESTRICTED
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500 mt-1">
                      {meta.description}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleToggle(category, isEnabled)}
                    disabled={isToggling}
                    className={`w-11 h-6 rounded-full flex items-center px-0.5 transition-colors cursor-pointer disabled:opacity-50 ${
                      isEnabled ? "bg-primary" : "bg-gray-700"
                    }`}
                  >
                    <div
                      className={`w-5 h-5 rounded-full bg-white transition-transform ${
                        isEnabled ? "translate-x-5" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>

                {/* Filesystem-specific: workspace path + access level */}
                {category === "filesystem" && openclawConfig && (
                  <div className="mt-5 pt-5 border-t border-gray-800">
                    <h4 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">
                      Workspace Settings
                    </h4>

                    <div className="space-y-3">
                      <div>
                        <label className="text-sm text-gray-400 block mb-1">
                          Workspace Path
                        </label>
                        <p className="text-xs text-gray-600 mb-2">
                          The directory OpenClaw agents work in. This sets the
                          agent's working directory, but does not restrict access
                          to other paths unless sandbox mode is enabled.
                        </p>
                        <input
                          type="text"
                          value={workspacePath}
                          onChange={(e) => setWorkspacePath(e.target.value)}
                          placeholder="e.g. ~/Desktop or ~/.openclaw/workspace"
                          className="w-full rounded-lg bg-gray-800 border border-gray-700 text-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-primary"
                        />
                      </div>

                      <div>
                        <label className="text-sm text-gray-400 block mb-1">
                          Workspace Access Level
                        </label>
                        <p className="text-xs text-gray-600 mb-2">
                          Controls how sandboxed agents access the workspace.
                          {!isSandboxed && (
                            <span className="text-yellow-500">
                              {" "}
                              Only takes effect when sandbox mode is enabled
                              below.
                            </span>
                          )}
                        </p>
                        <select
                          value={workspaceAccess}
                          onChange={(e) => setWorkspaceAccess(e.target.value)}
                          className="w-full rounded-lg bg-gray-800 border border-gray-700 text-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-primary"
                        >
                          <option value="rw">
                            Read-Write — full access to workspace
                          </option>
                          <option value="ro">
                            Read-Only — can read but not modify files
                          </option>
                          <option value="none">
                            None — no access to host workspace
                          </option>
                        </select>
                      </div>

                      {/* Sandbox Mode */}
                      <div className="mt-4 pt-4 border-t border-gray-800">
                        <h4 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">
                          Docker Sandbox
                        </h4>

                        <div>
                          <label className="text-sm text-gray-400 block mb-1">
                            Sandbox Mode
                          </label>
                          <p className="text-xs text-gray-600 mb-2">
                            Runs OpenClaw agents inside a Docker container.
                            Requires Docker to be installed and running.
                          </p>
                          <select
                            value={sandboxModeLocal}
                            onChange={(e) => setSandboxModeLocal(e.target.value)}
                            className="w-full rounded-lg bg-gray-800 border border-gray-700 text-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-primary"
                          >
                            <option value="off">
                              Off — no sandboxing, agent runs as your user
                            </option>
                            <option value="non-main">
                              Non-Main — sandbox sub-agents only
                            </option>
                            <option value="all">
                              All — sandbox all agents including main
                            </option>
                          </select>
                        </div>
                      </div>

                      {!isSandboxed && (
                        <div className="rounded-lg bg-yellow-900/30 border border-yellow-700/50 px-4 py-2">
                          <p className="text-xs text-yellow-400">
                            Sandbox mode is{" "}
                            <strong>{sandboxModeLocal}</strong>. Without Docker
                            sandboxing, the agent runs as your user and can
                            access any file on your system. The workspace path
                            sets a default directory but does not enforce
                            boundaries.
                          </p>
                        </div>
                      )}

                      {isSandboxed && (
                        <>
                          <div className="rounded-lg bg-green-900/30 border border-green-700/50 px-4 py-2">
                            <p className="text-xs text-green-400">
                              Sandbox mode is{" "}
                              <strong>{sandboxModeLocal}</strong>. The agent runs
                              in a Docker container and can only access the
                              workspace directory (at the level set above) plus
                              any explicitly bound mount paths below.
                            </p>
                          </div>

                          {/* Docker Bind Mounts */}
                          <div className="mt-4 pt-4 border-t border-gray-800">
                            <h4 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">
                              Bind Mounts
                            </h4>
                            <p className="text-xs text-gray-600 mb-3">
                              Host directories to mount into the Docker
                              container. These are the only paths (besides the
                              workspace) the agent can access.
                            </p>

                            {bindMounts.length > 0 && (
                              <div className="space-y-2 mb-3">
                                {bindMounts.map((mount, idx) => {
                                  const parts = mount.split(":");
                                  const host = parts[0] ?? mount;
                                  const container = parts[1] ?? host;
                                  const mode = parts[2] ?? "rw";
                                  return (
                                    <div
                                      key={idx}
                                      className="flex items-center gap-2 rounded-lg bg-gray-800/50 border border-gray-700/50 px-3 py-2"
                                    >
                                      <div className="flex-1 min-w-0">
                                        <span className="text-xs text-gray-300 font-mono truncate block">
                                          {host}
                                        </span>
                                        <span className="text-xs text-gray-600">
                                          → {container}
                                        </span>
                                      </div>
                                      <span
                                        className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                                          mode === "ro"
                                            ? "bg-blue-900/50 text-blue-400 border border-blue-700/50"
                                            : "bg-orange-900/50 text-orange-400 border border-orange-700/50"
                                        }`}
                                      >
                                        {mode}
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() => removeBindMount(idx)}
                                        className="text-gray-500 hover:text-red-400 transition-colors cursor-pointer text-sm"
                                        title="Remove mount"
                                      >
                                        ✕
                                      </button>
                                    </div>
                                  );
                                })}
                              </div>
                            )}

                            {/* Add new bind mount form */}
                            <div className="rounded-lg bg-gray-800/30 border border-gray-700/50 p-3">
                              <div className="grid grid-cols-[1fr_1fr_auto] gap-2 items-end">
                                <div>
                                  <label className="text-xs text-gray-500 block mb-1">
                                    Host Path
                                  </label>
                                  <input
                                    type="text"
                                    value={newBindHost}
                                    onChange={(e) =>
                                      setNewBindHost(e.target.value)
                                    }
                                    placeholder="/home/user/projects"
                                    className="w-full rounded-lg bg-gray-800 border border-gray-700 text-gray-200 px-3 py-1.5 text-sm focus:outline-none focus:border-primary"
                                  />
                                </div>
                                <div>
                                  <label className="text-xs text-gray-500 block mb-1">
                                    Container Path (optional)
                                  </label>
                                  <input
                                    type="text"
                                    value={newBindContainer}
                                    onChange={(e) =>
                                      setNewBindContainer(e.target.value)
                                    }
                                    placeholder="Same as host path"
                                    className="w-full rounded-lg bg-gray-800 border border-gray-700 text-gray-200 px-3 py-1.5 text-sm focus:outline-none focus:border-primary"
                                  />
                                </div>
                                <div>
                                  <label className="text-xs text-gray-500 block mb-1">
                                    Mode
                                  </label>
                                  <select
                                    value={newBindMode}
                                    onChange={(e) =>
                                      setNewBindMode(e.target.value)
                                    }
                                    className="rounded-lg bg-gray-800 border border-gray-700 text-gray-200 px-3 py-1.5 text-sm focus:outline-none focus:border-primary"
                                  >
                                    <option value="ro">ro</option>
                                    <option value="rw">rw</option>
                                  </select>
                                </div>
                              </div>
                              <div className="flex justify-end mt-2">
                                <button
                                  type="button"
                                  onClick={addBindMount}
                                  disabled={!newBindHost.trim()}
                                  className="rounded-lg bg-gray-700 px-3 py-1 text-xs font-medium text-gray-200 hover:bg-gray-600 transition-colors disabled:opacity-50 cursor-pointer"
                                >
                                  + Add Mount
                                </button>
                              </div>
                            </div>
                          </div>

                          {/* Docker Network */}
                          <div>
                            <label className="text-sm text-gray-400 block mb-1">
                              Docker Network
                            </label>
                            <p className="text-xs text-gray-600 mb-2">
                              Controls network access inside the sandbox. Set to
                              "none" to completely block outbound network access
                              from the container.
                            </p>
                            <select
                              value={dockerNetwork}
                              onChange={(e) => setDockerNetwork(e.target.value)}
                              className="w-full rounded-lg bg-gray-800 border border-gray-700 text-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-primary"
                            >
                              <option value="">
                                Default — standard Docker networking
                              </option>
                              <option value="none">
                                None — no network access (fully isolated)
                              </option>
                              <option value="host">
                                Host — share host network stack
                              </option>
                            </select>
                          </div>
                        </>
                      )}

                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={saveWorkspaceSettings}
                          disabled={savingWorkspace}
                          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 transition-colors disabled:opacity-50 cursor-pointer"
                        >
                          {savingWorkspace ? "Saving..." : "Save"}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
