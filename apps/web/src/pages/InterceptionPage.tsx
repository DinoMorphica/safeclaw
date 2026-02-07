import { useEffect, useState, useCallback } from "react";
import { socket } from "../lib/socket";
import type { CommandLog } from "@safeclaw/shared";

const THREAT_COLORS: Record<string, string> = {
  CRITICAL: "bg-danger/10 text-danger",
  HIGH: "bg-warning/10 text-warning",
  MEDIUM: "bg-primary/10 text-primary",
  LOW: "bg-gray-700/50 text-gray-300",
  NONE: "bg-success/10 text-success",
};

const STATUS_COLORS: Record<string, string> = {
  BLOCKED: "text-danger",
  ALLOWED: "text-success",
  PENDING: "text-warning",
};

export function InterceptionPage() {
  const [commands, setCommands] = useState<CommandLog[]>([]);
  const [loading, setLoading] = useState(true);

  const handleCommand = useCallback((cmd: CommandLog) => {
    setCommands((prev) => {
      const exists = prev.findIndex((c) => c.id === cmd.id);
      if (exists >= 0) {
        const updated = [...prev];
        updated[exists] = cmd;
        return updated;
      }
      return [cmd, ...prev];
    });
    setLoading(false);
  }, []);

  useEffect(() => {
    socket.emit("safeclaw:getRecentCommands", { limit: 50 });

    socket.on("safeclaw:commandLogged", handleCommand);

    const timeout = setTimeout(() => setLoading(false), 1000);

    return () => {
      socket.off("safeclaw:commandLogged", handleCommand);
      clearTimeout(timeout);
    };
  }, [handleCommand]);

  const handleDecision = (commandId: number, action: "ALLOW" | "DENY") => {
    socket.emit("safeclaw:decision", { commandId, action });
  };

  const pending = commands.filter((c) => c.status === "PENDING");
  const resolved = commands.filter((c) => c.status !== "PENDING");

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Command Interception</h2>

      <div className="flex gap-3 mb-6">
        <span className="rounded-full bg-danger/10 px-3 py-1 text-xs font-medium text-danger">
          CRITICAL
        </span>
        <span className="rounded-full bg-warning/10 px-3 py-1 text-xs font-medium text-warning">
          HIGH
        </span>
        <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
          MEDIUM
        </span>
        <span className="rounded-full bg-success/10 px-3 py-1 text-xs font-medium text-success">
          SAFE
        </span>
      </div>

      {/* Pending Commands */}
      {pending.length > 0 && (
        <div className="mb-8">
          <h3 className="text-lg font-semibold text-warning mb-4">
            Pending Approval ({pending.length})
          </h3>
          <div className="space-y-3">
            {pending.map((cmd) => (
              <div
                key={cmd.id}
                className="rounded-xl border border-warning/30 bg-gray-900 p-4"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <code className="text-sm text-gray-200 break-all">
                      {cmd.command}
                    </code>
                    <div className="flex items-center gap-3 mt-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${THREAT_COLORS[cmd.threatLevel] ?? ""}`}
                      >
                        {cmd.threatLevel}
                      </span>
                      <span className="text-xs text-gray-500">
                        {cmd.timestamp}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleDecision(cmd.id, "ALLOW")}
                      className="px-3 py-1.5 text-xs font-medium rounded-lg bg-success/10 text-success hover:bg-success/20 transition-colors"
                    >
                      Allow
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDecision(cmd.id, "DENY")}
                      className="px-3 py-1.5 text-xs font-medium rounded-lg bg-danger/10 text-danger hover:bg-danger/20 transition-colors"
                    >
                      Deny
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Command History */}
      <div>
        <h3 className="text-lg font-semibold text-gray-300 mb-4">
          Command History
        </h3>
        {loading ? (
          <p className="text-gray-500">Loading commands...</p>
        ) : resolved.length === 0 && pending.length === 0 ? (
          <div className="rounded-xl border border-gray-800 bg-gray-900 p-8">
            <p className="text-gray-400">
              No commands intercepted yet. Commands flagged as dangerous will
              appear here for your approval.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {resolved.map((cmd) => (
              <div
                key={cmd.id}
                className="rounded-lg border border-gray-800 bg-gray-900 p-3 flex items-center gap-4"
              >
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${THREAT_COLORS[cmd.threatLevel] ?? ""}`}
                >
                  {cmd.threatLevel}
                </span>
                <code className="text-sm text-gray-300 flex-1 truncate">
                  {cmd.command}
                </code>
                <span
                  className={`text-xs font-medium ${STATUS_COLORS[cmd.status] ?? ""}`}
                >
                  {cmd.status}
                </span>
                <span className="text-xs text-gray-500">{cmd.timestamp}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
