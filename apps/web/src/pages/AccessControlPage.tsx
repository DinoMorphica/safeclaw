import { useEffect, useState } from "react";
import { socket } from "../lib/socket";
import type { AccessConfigEntry } from "@safeclaw/shared";

const CATEGORY_LABELS: Record<string, { title: string; description: string }> =
  {
    filesystem: {
      title: "File System Access",
      description:
        "Control which directories and files the AI agent can read or modify.",
    },
    database: {
      title: "Database Access",
      description: "Toggle database connections on or off for the agent.",
    },
    mcp_servers: {
      title: "MCP Servers",
      description: "Enable or disable specific MCP server connections.",
    },
    network: {
      title: "Network Access",
      description: "Control browser and HTTP request permissions.",
    },
    system_commands: {
      title: "System Commands",
      description:
        "Manage which shell commands the agent is allowed to execute.",
    },
  };

export function AccessControlPage() {
  const [config, setConfig] = useState<AccessConfigEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    socket.emit("safeclaw:getAccessConfig");

    const handler = (data: AccessConfigEntry[]) => {
      setConfig(data);
      setLoading(false);
    };

    socket.on("safeclaw:accessConfig", handler);
    return () => {
      socket.off("safeclaw:accessConfig", handler);
    };
  }, []);

  const handleToggle = (category: string, currentValue: string) => {
    const enabled = currentValue !== "true";
    socket.emit("safeclaw:toggleAccess", { category, enabled });
  };

  const enabledEntries = config.filter((c) => c.key === "enabled");

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Access Control</h2>
      {loading ? (
        <p className="text-gray-500">Loading access configuration...</p>
      ) : (
        <div className="space-y-4">
          {enabledEntries.map((entry) => {
            const meta = CATEGORY_LABELS[entry.category] ?? {
              title: entry.category,
              description: "",
            };
            const isEnabled = entry.value === "true";

            return (
              <div
                key={entry.id}
                className="rounded-xl border border-gray-800 bg-gray-900 p-6 flex items-center justify-between"
              >
                <div>
                  <h3 className="text-sm font-medium text-gray-200">
                    {meta.title}
                  </h3>
                  <p className="text-sm text-gray-500 mt-1">
                    {meta.description}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleToggle(entry.category, entry.value)}
                  className={`w-11 h-6 rounded-full flex items-center px-0.5 transition-colors cursor-pointer ${
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
            );
          })}
        </div>
      )}
    </div>
  );
}
