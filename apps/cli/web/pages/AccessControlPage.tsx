import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { socket } from "../lib/socket";
import type {
  AccessControlState,
  AccessToggleState,
  OpenClawConfig,
  SrtStatus,
} from "@safeclaw/shared";

const CATEGORY_META: Record<string, { title: string; description: string }> = {
  filesystem: {
    title: "File System Access",
    description:
      "Controls read, write, edit, and apply_patch tools. Modifies the group:fs entry in OpenClaw's tool deny list.",
  },
  mcp_servers: {
    title: "MCP Servers (Plugins)",
    description:
      "Master toggle for all OpenClaw plugins. Expand below to manage individual servers.",
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

const CATEGORY_ORDER = ["mcp_servers", "network", "system_commands"];

export function AccessControlPage() {
  const [state, setState] = useState<AccessControlState | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);
  const [togglingServer, setTogglingServer] = useState<string | null>(null);
  const [mcpExpanded, setMcpExpanded] = useState(true);
  const [openclawConfig, setOpenclawConfig] = useState<OpenClawConfig | null>(null);

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

  // SRT state
  const [srtStatus, setSrtStatus] = useState<SrtStatus | null>(null);
  const [newAllowDomain, setNewAllowDomain] = useState("");
  const [newDenyDomain, setNewDenyDomain] = useState("");
  const [srtFsExpanded, setSrtFsExpanded] = useState(false);

  // Anchor scroll support
  const location = useLocation();
  const sandboxRef = useRef<HTMLDivElement>(null);
  const egressRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    socket.emit("safeclaw:getAccessControlState");
    socket.emit("safeclaw:getOpenclawConfig");
    socket.emit("safeclaw:getSrtStatus");

    const accessHandler = (data: AccessControlState) => {
      setState(data);
      setToggling(null);
      setTogglingServer(null);
    };

    const configHandler = (data: OpenClawConfig | null) => {
      if (!data) return;
      setOpenclawConfig(data);
      setWorkspacePath(data.agents?.defaults?.workspace ?? "");
      setWorkspaceAccess(data.agents?.defaults?.sandbox?.workspaceAccess ?? "rw");
      setSandboxModeLocal(data.agents?.defaults?.sandbox?.mode ?? "off");
      setBindMounts(data.agents?.defaults?.sandbox?.docker?.binds ?? []);
      setDockerNetwork(data.agents?.defaults?.sandbox?.docker?.network ?? "");
    };

    const srtHandler = (data: SrtStatus) => {
      setSrtStatus(data);
    };

    socket.on("safeclaw:accessControlState", accessHandler);
    socket.on("safeclaw:openclawConfig", configHandler);
    socket.on("safeclaw:srtStatus", srtHandler);
    return () => {
      socket.off("safeclaw:accessControlState", accessHandler);
      socket.off("safeclaw:openclawConfig", configHandler);
      socket.off("safeclaw:srtStatus", srtHandler);
    };
  }, []);

  // Scroll to #sandbox or #egress anchor when navigated
  useEffect(() => {
    if (location.hash === "#sandbox" && sandboxRef.current) {
      sandboxRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    if (location.hash === "#egress" && egressRef.current) {
      egressRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [location.hash, state, openclawConfig, srtStatus]);

  const handleToggle = (category: string, currentEnabled: boolean) => {
    setToggling(category);
    socket.emit("safeclaw:toggleAccess", {
      category,
      enabled: !currentEnabled,
    });
  };

  const handleServerToggle = (serverName: string, currentEnabled: boolean) => {
    setTogglingServer(serverName);
    socket.emit("safeclaw:toggleMcpServer", {
      serverName,
      enabled: !currentEnabled,
    });
  };

  const saveWorkspaceSettings = () => {
    setSavingWorkspace(true);
    const sandboxMode = sandboxModeLocal as "off" | "non-main" | "all";
    // Use null (not undefined) for empty values so they survive Socket.IO
    // JSON serialization and the server deep merge correctly clears old values.
    // undefined gets dropped by JSON.stringify, so the merge preserves stale values.
    const updates = {
      agents: {
        defaults: {
          workspace: workspacePath || null,
          sandbox: {
            mode: sandboxMode,
            workspaceAccess: workspaceAccess as "none" | "ro" | "rw",
            docker:
              sandboxMode !== "off"
                ? {
                    binds: bindMounts.length > 0 ? bindMounts : null,
                    network: dockerNetwork || null,
                  }
                : null,
          },
        },
      },
    } as Partial<OpenClawConfig>;
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
            Install and configure OpenClaw first, then return here to manage access controls.
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
        {/* Standalone Sandbox & Workspace Isolation card */}
        {openclawConfig && (
          <div id="sandbox" ref={sandboxRef}>
            <div className="rounded-xl border border-gray-800 bg-gray-900 p-6">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-medium text-gray-200">
                    Sandbox &amp; Workspace Isolation
                  </h3>
                  {isSandboxed ? (
                    <span className="flex items-center gap-1.5 px-2 py-0.5 text-xs font-medium rounded-full bg-green-900/50 text-green-400 border border-green-700/50">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
                      ACTIVE
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5 px-2 py-0.5 text-xs font-medium rounded-full bg-yellow-900/50 text-yellow-400 border border-yellow-700/50">
                      <span className="w-1.5 h-1.5 rounded-full bg-yellow-400" />
                      RECOMMENDED
                    </span>
                  )}
                </div>
              </div>
              <p className="text-sm text-gray-500 mb-2">
                Anthropic's #1 security recommendation. Runs agents in a Docker container with
                restricted filesystem and network access.
              </p>
              <p className="text-xs text-gray-600 mb-4">
                Sandbox controls what the agent can access inside its container. Command approval is
                configured separately in{" "}
                <a href="/interception" className="text-primary hover:underline">
                  Command Interception
                </a>
                .
              </p>

              <div className="space-y-3">
                {/* File System Access toggle */}
                {(() => {
                  const fsToggle = toggleMap.get("filesystem");
                  const fsMeta = CATEGORY_META.filesystem;
                  if (!fsToggle || !fsMeta) return null;
                  const fsEnabled = fsToggle.enabled;
                  const fsToggling = toggling === "filesystem";
                  return (
                    <div className="flex items-center justify-between rounded-lg border border-gray-800 bg-gray-800/30 px-4 py-3">
                      <div className="flex-1 mr-4">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-gray-200">{fsMeta.title}</span>
                          {!fsEnabled && (
                            <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-red-900/50 text-red-400 border border-red-700/50">
                              RESTRICTED
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5">{fsMeta.description}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleToggle("filesystem", fsEnabled)}
                        disabled={fsToggling}
                        className={`w-11 h-6 rounded-full flex items-center px-0.5 transition-colors cursor-pointer disabled:opacity-50 ${
                          fsEnabled ? "bg-success" : "bg-gray-700"
                        }`}
                      >
                        <div
                          className={`w-5 h-5 rounded-full bg-white transition-transform ${
                            fsEnabled ? "translate-x-5" : "translate-x-0"
                          }`}
                        />
                      </button>
                    </div>
                  );
                })()}

                <div>
                  <label className="text-sm text-gray-400 block mb-1">Workspace Path</label>
                  <p className="text-xs text-gray-600 mb-2">
                    The directory OpenClaw agents work in. This sets the agent's working directory,
                    but does not restrict access to other paths unless sandbox mode is enabled.
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
                  <label className="text-sm text-gray-400 block mb-1">Workspace Access Level</label>
                  <p className="text-xs text-gray-600 mb-2">
                    Controls how sandboxed agents access the workspace.
                    {!isSandboxed && (
                      <span className="text-yellow-500">
                        {" "}
                        Only takes effect when sandbox mode is enabled below.
                      </span>
                    )}
                  </p>
                  <select
                    value={workspaceAccess}
                    onChange={(e) => setWorkspaceAccess(e.target.value)}
                    className="w-full rounded-lg bg-gray-800 border border-gray-700 text-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-primary"
                  >
                    <option value="rw">Read-Write — full access to workspace</option>
                    <option value="ro">Read-Only — can read but not modify files</option>
                    <option value="none">None — no access to host workspace</option>
                  </select>
                </div>

                {/* Sandbox Mode */}
                <div className="mt-4 pt-4 border-t border-gray-800">
                  <h4 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">
                    Docker Sandbox
                  </h4>

                  <div>
                    <label className="text-sm text-gray-400 block mb-1">Sandbox Mode</label>
                    <p className="text-xs text-gray-600 mb-2">
                      Runs OpenClaw agents inside a Docker container. Requires Docker to be
                      installed and running.
                    </p>
                    <select
                      value={sandboxModeLocal}
                      onChange={(e) => setSandboxModeLocal(e.target.value)}
                      className="w-full rounded-lg bg-gray-800 border border-gray-700 text-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-primary"
                    >
                      <option value="off">Off — no sandboxing, agent runs as your user</option>
                      <option value="non-main">Non-Main — sandbox sub-agents only</option>
                      <option value="all">All — sandbox all agents including main</option>
                    </select>
                  </div>
                </div>

                {!isSandboxed && (
                  <div className="rounded-lg bg-yellow-900/30 border border-yellow-700/50 px-4 py-2">
                    <p className="text-xs text-yellow-400">
                      Sandbox mode is <strong>{sandboxModeLocal}</strong>. Without Docker
                      sandboxing, the agent runs as your user and can access any file on your
                      system. The workspace path sets a default directory but does not enforce
                      boundaries.
                    </p>
                  </div>
                )}

                {isSandboxed && (
                  <>
                    <div className="rounded-lg bg-green-900/30 border border-green-700/50 px-4 py-2">
                      <p className="text-xs text-green-400">
                        Sandbox mode is <strong>{sandboxModeLocal}</strong>. The agent runs in a
                        Docker container and can only access the workspace directory (at the level
                        set above) plus any explicitly bound mount paths below.
                      </p>
                    </div>

                    {/* Docker Bind Mounts */}
                    <div className="mt-4 pt-4 border-t border-gray-800">
                      <h4 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">
                        Bind Mounts
                      </h4>
                      <p className="text-xs text-gray-600 mb-3">
                        Host directories to mount into the Docker container. These are the only
                        paths (besides the workspace) the agent can access.
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
                                  <span className="text-xs text-gray-600">→ {container}</span>
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
                            <label className="text-xs text-gray-500 block mb-1">Host Path</label>
                            <input
                              type="text"
                              value={newBindHost}
                              onChange={(e) => setNewBindHost(e.target.value)}
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
                              onChange={(e) => setNewBindContainer(e.target.value)}
                              placeholder="Same as host path"
                              className="w-full rounded-lg bg-gray-800 border border-gray-700 text-gray-200 px-3 py-1.5 text-sm focus:outline-none focus:border-primary"
                            />
                          </div>
                          <div>
                            <label className="text-xs text-gray-500 block mb-1">Mode</label>
                            <select
                              value={newBindMode}
                              onChange={(e) => setNewBindMode(e.target.value)}
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
                      <label className="text-sm text-gray-400 block mb-1">Docker Network</label>
                      <p className="text-xs text-gray-600 mb-2">
                        Controls network access inside the sandbox. Set to "none" to completely
                        block outbound network access from the container.
                      </p>
                      <select
                        value={dockerNetwork}
                        onChange={(e) => setDockerNetwork(e.target.value)}
                        className="w-full rounded-lg bg-gray-800 border border-gray-700 text-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-primary"
                      >
                        <option value="">Default — standard Docker networking</option>
                        <option value="none">None — no network access (fully isolated)</option>
                        <option value="host">Host — share host network stack</option>
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
          </div>
        )}

        {/* Egress Proxy & Domain Filtering (srt) card */}
        {srtStatus && (
          <div id="egress" ref={egressRef}>
            <div className="rounded-xl border border-gray-800 bg-gray-900 p-6">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-medium text-gray-200">
                    Egress Proxy &amp; Domain Filtering
                  </h3>
                  {srtStatus.installed ? (
                    <span className="flex items-center gap-1.5 px-2 py-0.5 text-xs font-medium rounded-full bg-blue-900/50 text-blue-400 border border-blue-700/50">
                      srt {srtStatus.version ?? ""}
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5 px-2 py-0.5 text-xs font-medium rounded-full bg-gray-800 text-gray-500 border border-gray-700/50">
                      not installed
                    </span>
                  )}
                  {srtStatus.enabled && srtStatus.installed && (
                    <span className="flex items-center gap-1.5 px-2 py-0.5 text-xs font-medium rounded-full bg-green-900/50 text-green-400 border border-green-700/50">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
                      ACTIVE
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => socket.emit("safeclaw:toggleSrt", { enabled: !srtStatus.enabled })}
                  disabled={!srtStatus.installed}
                  className={`w-11 h-6 rounded-full flex items-center px-0.5 transition-colors cursor-pointer disabled:opacity-50 ${
                    srtStatus.enabled ? "bg-success" : "bg-gray-700"
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded-full bg-white transition-transform ${
                      srtStatus.enabled ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>
              <p className="text-sm text-gray-500 mb-2">
                Uses Anthropic's Sandbox Runtime (srt) to enforce network domain allowlists without
                Docker. All network access is denied by default; only allowed domains are reachable.
              </p>

              {!srtStatus.installed && (
                <div className="rounded-lg bg-yellow-900/30 border border-yellow-700/50 px-4 py-3 mt-3">
                  <p className="text-xs text-yellow-400 mb-2">
                    Install the Sandbox Runtime CLI to enable egress filtering:
                  </p>
                  <code className="block text-xs text-yellow-300 bg-gray-800 rounded px-3 py-2 font-mono">
                    npm install -g @anthropic-ai/sandbox-runtime
                  </code>
                </div>
              )}

              {srtStatus.installed && srtStatus.enabled && srtStatus.settings && (
                <div className="mt-4 space-y-4">
                  {/* Launch command */}
                  <div className="rounded-lg bg-gray-800/50 border border-gray-700/50 px-4 py-3">
                    <p className="text-xs text-gray-400 mb-1">
                      Launch your agent with srt to enforce domain filtering:
                    </p>
                    <code className="block text-xs text-green-400 bg-gray-800 rounded px-3 py-2 font-mono">
                      srt openclaw start
                    </code>
                  </div>

                  {/* Allowed Domains */}
                  <div>
                    <h4 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">
                      Allowed Domains ({srtStatus.settings.network.allowedDomains.length})
                    </h4>
                    <p className="text-xs text-gray-600 mb-2">
                      Only these domains are reachable when srt is active. Supports wildcards (e.g.
                      *.github.com).
                    </p>
                    {srtStatus.settings.network.allowedDomains.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-2">
                        {srtStatus.settings.network.allowedDomains.map((domain) => (
                          <span
                            key={domain}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-lg bg-green-900/30 text-green-400 border border-green-700/50"
                          >
                            <span className="font-mono">{domain}</span>
                            <button
                              type="button"
                              onClick={() =>
                                socket.emit("safeclaw:updateSrtDomains", {
                                  list: "allow",
                                  action: "remove",
                                  domain,
                                })
                              }
                              className="text-green-600 hover:text-red-400 transition-colors cursor-pointer"
                            >
                              ✕
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newAllowDomain}
                        onChange={(e) => setNewAllowDomain(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && newAllowDomain.trim()) {
                            socket.emit("safeclaw:updateSrtDomains", {
                              list: "allow",
                              action: "add",
                              domain: newAllowDomain.trim(),
                            });
                            setNewAllowDomain("");
                          }
                        }}
                        placeholder="e.g. api.github.com or *.npmjs.org"
                        className="flex-1 rounded-lg bg-gray-800 border border-gray-700 text-gray-200 px-3 py-1.5 text-sm focus:outline-none focus:border-primary"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (newAllowDomain.trim()) {
                            socket.emit("safeclaw:updateSrtDomains", {
                              list: "allow",
                              action: "add",
                              domain: newAllowDomain.trim(),
                            });
                            setNewAllowDomain("");
                          }
                        }}
                        disabled={!newAllowDomain.trim()}
                        className="rounded-lg bg-gray-700 px-3 py-1.5 text-xs font-medium text-gray-200 hover:bg-gray-600 transition-colors disabled:opacity-50 cursor-pointer"
                      >
                        + Add
                      </button>
                    </div>
                  </div>

                  {/* Denied Domains */}
                  <div>
                    <h4 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">
                      Denied Domains ({srtStatus.settings.network.deniedDomains.length})
                    </h4>
                    <p className="text-xs text-gray-600 mb-2">
                      Explicitly blocked domains. Useful for blocking known-bad destinations.
                    </p>
                    {srtStatus.settings.network.deniedDomains.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-2">
                        {srtStatus.settings.network.deniedDomains.map((domain) => (
                          <span
                            key={domain}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-lg bg-red-900/30 text-red-400 border border-red-700/50"
                          >
                            <span className="font-mono">{domain}</span>
                            <button
                              type="button"
                              onClick={() =>
                                socket.emit("safeclaw:updateSrtDomains", {
                                  list: "deny",
                                  action: "remove",
                                  domain,
                                })
                              }
                              className="text-red-600 hover:text-red-300 transition-colors cursor-pointer"
                            >
                              ✕
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newDenyDomain}
                        onChange={(e) => setNewDenyDomain(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && newDenyDomain.trim()) {
                            socket.emit("safeclaw:updateSrtDomains", {
                              list: "deny",
                              action: "add",
                              domain: newDenyDomain.trim(),
                            });
                            setNewDenyDomain("");
                          }
                        }}
                        placeholder="e.g. pastebin.com or *.evil.com"
                        className="flex-1 rounded-lg bg-gray-800 border border-gray-700 text-gray-200 px-3 py-1.5 text-sm focus:outline-none focus:border-primary"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (newDenyDomain.trim()) {
                            socket.emit("safeclaw:updateSrtDomains", {
                              list: "deny",
                              action: "add",
                              domain: newDenyDomain.trim(),
                            });
                            setNewDenyDomain("");
                          }
                        }}
                        disabled={!newDenyDomain.trim()}
                        className="rounded-lg bg-gray-700 px-3 py-1.5 text-xs font-medium text-gray-200 hover:bg-gray-600 transition-colors disabled:opacity-50 cursor-pointer"
                      >
                        + Add
                      </button>
                    </div>
                  </div>

                  {/* Collapsible Filesystem Restrictions */}
                  <div className="pt-3 border-t border-gray-800">
                    <button
                      type="button"
                      onClick={() => setSrtFsExpanded(!srtFsExpanded)}
                      className="flex items-center gap-2 text-xs font-medium text-gray-400 uppercase tracking-wider cursor-pointer hover:text-gray-300"
                    >
                      <span
                        className={`inline-block transition-transform ${srtFsExpanded ? "rotate-90" : ""}`}
                      >
                        &#9654;
                      </span>
                      Filesystem Restrictions
                    </button>

                    {srtFsExpanded && (
                      <div className="mt-3 space-y-3">
                        <div>
                          <label className="text-xs text-gray-500 block mb-1">
                            Deny Read Paths
                          </label>
                          <p className="text-xs text-gray-600 mb-1">
                            Paths the agent cannot read (e.g. ~/.ssh, ~/.aws).
                          </p>
                          <div className="flex flex-wrap gap-1.5 mb-1">
                            {srtStatus.settings.filesystem.denyRead.map((p) => (
                              <span
                                key={p}
                                className="text-xs font-mono px-2 py-0.5 rounded bg-gray-800 text-gray-400 border border-gray-700"
                              >
                                {p}
                              </span>
                            ))}
                            {srtStatus.settings.filesystem.denyRead.length === 0 && (
                              <span className="text-xs text-gray-600">
                                No deny-read paths configured
                              </span>
                            )}
                          </div>
                        </div>
                        <div>
                          <label className="text-xs text-gray-500 block mb-1">
                            Allow Write Paths
                          </label>
                          <p className="text-xs text-gray-600 mb-1">
                            Paths the agent is allowed to write to.
                          </p>
                          <div className="flex flex-wrap gap-1.5 mb-1">
                            {srtStatus.settings.filesystem.allowWrite.map((p) => (
                              <span
                                key={p}
                                className="text-xs font-mono px-2 py-0.5 rounded bg-gray-800 text-gray-400 border border-gray-700"
                              >
                                {p}
                              </span>
                            ))}
                            {srtStatus.settings.filesystem.allowWrite.length === 0 && (
                              <span className="text-xs text-gray-600">
                                No allow-write paths configured
                              </span>
                            )}
                          </div>
                        </div>
                        <div>
                          <label className="text-xs text-gray-500 block mb-1">
                            Deny Write Paths
                          </label>
                          <p className="text-xs text-gray-600 mb-1">
                            Paths the agent cannot write to.
                          </p>
                          <div className="flex flex-wrap gap-1.5 mb-1">
                            {srtStatus.settings.filesystem.denyWrite.map((p) => (
                              <span
                                key={p}
                                className="text-xs font-mono px-2 py-0.5 rounded bg-gray-800 text-gray-400 border border-gray-700"
                              >
                                {p}
                              </span>
                            ))}
                            {srtStatus.settings.filesystem.denyWrite.length === 0 && (
                              <span className="text-xs text-gray-600">
                                No deny-write paths configured
                              </span>
                            )}
                          </div>
                        </div>
                        <p className="text-xs text-gray-600">
                          Edit <code className="text-gray-500">{srtStatus.settingsPath}</code>{" "}
                          directly for advanced filesystem configuration.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {srtStatus.installed && !srtStatus.enabled && (
                <p className="text-xs text-gray-600 mt-3">
                  Enable srt above to configure domain filtering rules. Settings are stored in{" "}
                  <code className="text-gray-500">{srtStatus.settingsPath}</code>.
                </p>
              )}
            </div>
          </div>
        )}

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
                      <h3 className="text-sm font-medium text-gray-200">{meta.title}</h3>
                      {!isEnabled && (
                        <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-red-900/50 text-red-400 border border-red-700/50">
                          RESTRICTED
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500 mt-1">{meta.description}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleToggle(category, isEnabled)}
                    disabled={isToggling}
                    className={`w-11 h-6 rounded-full flex items-center px-0.5 transition-colors cursor-pointer disabled:opacity-50 ${
                      isEnabled ? "bg-success" : "bg-gray-700"
                    }`}
                  >
                    <div
                      className={`w-5 h-5 rounded-full bg-white transition-transform ${
                        isEnabled ? "translate-x-5" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>

                {/* Per-server MCP controls */}
                {category === "mcp_servers" && state.mcpServers.length > 0 && (
                  <div className="mt-5 pt-5 border-t border-gray-800">
                    <button
                      type="button"
                      onClick={() => setMcpExpanded(!mcpExpanded)}
                      className="flex items-center gap-2 text-xs font-medium text-gray-400 uppercase tracking-wider mb-3 cursor-pointer hover:text-gray-300"
                    >
                      <span
                        className={`inline-block transition-transform ${mcpExpanded ? "rotate-90" : ""}`}
                      >
                        &#9654;
                      </span>
                      Individual Servers ({state.mcpServers.length})
                    </button>

                    {mcpExpanded && (
                      <div className="space-y-2">
                        {state.mcpServers.map((server) => {
                          const isServerToggling = togglingServer === server.name;
                          const masterDisabled = !isEnabled;

                          return (
                            <div
                              key={server.name}
                              className={`flex items-center justify-between py-2 px-3 rounded-lg border border-gray-800 ${
                                masterDisabled ? "opacity-50" : "bg-gray-800/30"
                              }`}
                            >
                              <div className="flex-1 min-w-0 mr-3">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm text-gray-200 truncate">
                                    {server.name}
                                  </span>
                                  {!server.pluginEnabled && (
                                    <span className="px-1.5 py-0.5 text-xs rounded bg-gray-700 text-gray-400">
                                      plugin disabled
                                    </span>
                                  )}
                                  {server.toolsDenyBlocked && (
                                    <span className="px-1.5 py-0.5 text-xs rounded bg-red-900/50 text-red-400">
                                      tools blocked
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-gray-600 mt-0.5">
                                  {server.effectivelyEnabled
                                    ? "Server active, tools accessible"
                                    : server.toolsDenyBlocked
                                      ? `Blocked via tools.deny (mcp__${server.name})`
                                      : "Plugin connection disabled"}
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={() =>
                                  handleServerToggle(server.name, server.effectivelyEnabled)
                                }
                                disabled={isServerToggling || masterDisabled}
                                className={`w-11 h-6 rounded-full flex items-center px-0.5 transition-colors cursor-pointer disabled:opacity-50 ${
                                  server.effectivelyEnabled ? "bg-success" : "bg-gray-700"
                                }`}
                              >
                                <div
                                  className={`w-5 h-5 rounded-full bg-white transition-transform ${
                                    server.effectivelyEnabled ? "translate-x-5" : "translate-x-0"
                                  }`}
                                />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {category === "mcp_servers" && state.mcpServers.length === 0 && (
                  <div className="mt-5 pt-5 border-t border-gray-800">
                    <p className="text-sm text-gray-500">No MCP servers configured in OpenClaw.</p>
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
