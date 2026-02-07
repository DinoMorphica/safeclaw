import { useEffect, useState, useCallback } from "react";
import { socket } from "../lib/socket";
import type { DashboardStats, CommandLog } from "@safeclaw/shared";

const THREAT_COLORS: Record<string, string> = {
  CRITICAL: "text-danger",
  HIGH: "text-warning",
  MEDIUM: "text-primary",
  LOW: "text-gray-400",
  NONE: "text-success",
};

const STATUS_COLORS: Record<string, string> = {
  BLOCKED: "text-danger",
  ALLOWED: "text-success",
  PENDING: "text-warning",
};

export function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentCommands, setRecentCommands] = useState<CommandLog[]>([]);

  const handleCommand = useCallback((cmd: CommandLog) => {
    setRecentCommands((prev) => {
      const exists = prev.findIndex((c) => c.id === cmd.id);
      if (exists >= 0) {
        const updated = [...prev];
        updated[exists] = cmd;
        return updated;
      }
      return [cmd, ...prev].slice(0, 10);
    });
  }, []);

  useEffect(() => {
    socket.emit("safeclaw:getStats");
    socket.emit("safeclaw:getRecentCommands", { limit: 10 });

    socket.on("safeclaw:stats", setStats);
    socket.on("safeclaw:commandLogged", handleCommand);

    return () => {
      socket.off("safeclaw:stats", setStats);
      socket.off("safeclaw:commandLogged", handleCommand);
    };
  }, [handleCommand]);

  const pendingCount =
    stats && stats.totalCommands > 0
      ? stats.totalCommands - stats.blockedCommands - stats.allowedCommands
      : 0;

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Dashboard Overview</h2>
      {stats ? (
        <>
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <StatCard label="Total Commands" value={stats.totalCommands} />
            <StatCard
              label="Blocked"
              value={stats.blockedCommands}
              color="text-danger"
            />
            <StatCard
              label="Allowed"
              value={stats.allowedCommands}
              color="text-success"
            />
            <StatCard
              label="Pending"
              value={pendingCount}
              color="text-warning"
            />
          </div>

          {/* OpenClaw Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <StatCard
              label="Agent Activities"
              value={stats.openclawActivities ?? 0}
              color="text-primary"
            />
            <StatCard
              label="Active Agent Sessions"
              value={stats.openclawActiveSessions ?? 0}
              color="text-primary"
            />
            <div className="rounded-xl border border-gray-800 bg-gray-900 p-6">
              <p className="text-sm text-gray-400">Agent Threat Breakdown</p>
              <div className="flex gap-3 mt-2">
                {(
                  ["CRITICAL", "HIGH", "MEDIUM", "LOW", "NONE"] as const
                ).map((level) => {
                  const count =
                    stats.openclawThreatBreakdown?.[level] ?? 0;
                  if (count === 0) return null;
                  return (
                    <span
                      key={level}
                      className={`text-xs font-medium ${THREAT_COLORS[level]}`}
                    >
                      {level}: {count}
                    </span>
                  );
                })}
                {Object.values(stats.openclawThreatBreakdown ?? {}).every(
                  (v) => v === 0,
                ) && (
                  <span className="text-xs text-gray-500">No activity</span>
                )}
              </div>
            </div>
          </div>

          {/* Threat Breakdown & Active Sessions */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
            <div className="rounded-xl border border-gray-800 bg-gray-900 p-6">
              <h3 className="text-sm font-medium text-gray-400 mb-4">
                Threat Breakdown
              </h3>
              <div className="space-y-3">
                {(
                  ["CRITICAL", "HIGH", "MEDIUM", "LOW", "NONE"] as const
                ).map((level) => {
                  const count = stats.threatBreakdown[level] ?? 0;
                  const total = stats.totalCommands || 1;
                  const pct = Math.round((count / total) * 100);
                  return (
                    <div key={level}>
                      <div className="flex items-center justify-between mb-1">
                        <span
                          className={`text-xs font-medium ${THREAT_COLORS[level]}`}
                        >
                          {level}
                        </span>
                        <span className="text-xs text-gray-500">
                          {count} ({pct}%)
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-gray-800 rounded-full">
                        <div
                          className={`h-1.5 rounded-full ${
                            level === "CRITICAL"
                              ? "bg-danger"
                              : level === "HIGH"
                                ? "bg-warning"
                                : level === "MEDIUM"
                                  ? "bg-primary"
                                  : level === "LOW"
                                    ? "bg-gray-500"
                                    : "bg-success"
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="rounded-xl border border-gray-800 bg-gray-900 p-6">
              <h3 className="text-sm font-medium text-gray-400 mb-4">
                System Status
              </h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-400">
                    Active Sessions
                  </span>
                  <span className="text-sm font-medium text-gray-200">
                    {stats.activeSessions}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-400">
                    Commands Processed
                  </span>
                  <span className="text-sm font-medium text-gray-200">
                    {stats.totalCommands}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-400">Block Rate</span>
                  <span className="text-sm font-medium text-gray-200">
                    {stats.totalCommands > 0
                      ? `${Math.round((stats.blockedCommands / stats.totalCommands) * 100)}%`
                      : "N/A"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Recent Activity */}
          <div className="rounded-xl border border-gray-800 bg-gray-900 p-6">
            <h3 className="text-sm font-medium text-gray-400 mb-4">
              Recent Activity
            </h3>
            {recentCommands.length === 0 ? (
              <p className="text-sm text-gray-500">
                No commands recorded yet. Activity will appear here as your AI
                agent runs.
              </p>
            ) : (
              <div className="space-y-2">
                {recentCommands.map((cmd) => (
                  <div
                    key={cmd.id}
                    className="flex items-center gap-3 py-2 border-b border-gray-800 last:border-0"
                  >
                    <span
                      className={`text-xs font-medium ${THREAT_COLORS[cmd.threatLevel]}`}
                    >
                      {cmd.threatLevel}
                    </span>
                    <code className="text-xs text-gray-300 flex-1 truncate">
                      {cmd.command}
                    </code>
                    <span
                      className={`text-xs font-medium ${STATUS_COLORS[cmd.status]}`}
                    >
                      {cmd.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      ) : (
        <p className="text-gray-500">Loading stats...</p>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  color = "text-white",
}: {
  label: string;
  value: number;
  color?: string;
}) {
  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 p-6">
      <p className="text-sm text-gray-400">{label}</p>
      <p className={`text-3xl font-bold mt-1 ${color}`}>{value}</p>
    </div>
  );
}
