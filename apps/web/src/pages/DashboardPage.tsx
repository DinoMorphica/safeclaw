import { useEffect, useState, useCallback } from "react";
import { socket } from "../lib/socket";
import type { DashboardStats, AgentActivity } from "@safeclaw/shared";

const THREAT_COLORS: Record<string, string> = {
  CRITICAL: "text-danger",
  HIGH: "text-warning",
  MEDIUM: "text-primary",
  LOW: "text-gray-400",
  NONE: "text-success",
};

const BAR_COLORS: Record<string, string> = {
  CRITICAL: "bg-danger",
  HIGH: "bg-warning",
  MEDIUM: "bg-primary",
  LOW: "bg-gray-500",
};

export function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentActivities, setRecentActivities] = useState<AgentActivity[]>([]);

  const handleActivity = useCallback((activity: AgentActivity) => {
    setRecentActivities((prev) => {
      if (prev.some((a) => a.id === activity.id)) return prev;
      return [activity, ...prev].slice(0, 10);
    });
  }, []);

  useEffect(() => {
    socket.emit("safeclaw:getStats");
    socket.emit("safeclaw:getOpenclawActivities", { limit: 10 });

    socket.on("safeclaw:stats", setStats);
    socket.on("safeclaw:openclawActivity", handleActivity);

    return () => {
      socket.off("safeclaw:stats", setStats);
      socket.off("safeclaw:openclawActivity", handleActivity);
    };
  }, [handleActivity]);

  const pendingCount =
    stats && stats.totalCommands > 0
      ? stats.totalCommands - stats.blockedCommands - stats.allowedCommands
      : 0;

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Dashboard Overview</h2>
      {stats ? (
        <>
          {/* Row 1: Command Stats Cards */}
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

          {/* Row 2: OpenClaw Stats */}
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
            {/* Threat Detection Rate */}
            <div className="rounded-xl border border-gray-800 bg-gray-900 p-6">
              <p className="text-sm text-gray-400">Threat Detection Rate</p>
              <p className="text-3xl font-bold mt-1 text-primary">
                {stats.threatDetectionRate?.activitiesWithThreats ?? 0}
                <span className="text-lg text-gray-500">
                  {" "}
                  / {stats.threatDetectionRate?.totalActivities ?? 0}
                </span>
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {stats.threatDetectionRate &&
                stats.threatDetectionRate.totalActivities > 0
                  ? `${Math.round(
                      (stats.threatDetectionRate.activitiesWithThreats /
                        stats.threatDetectionRate.totalActivities) *
                        100,
                    )}%`
                  : "N/A"}{" "}
                of activities triggered findings
              </p>
            </div>
          </div>

          {/* Row 3: Threat Results + Recent Activity */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Threat Results (combined) */}
            <div className="rounded-xl border border-gray-800 bg-gray-900 p-6">
              <h3 className="text-sm font-medium text-gray-400 mb-4">
                Threat Results
              </h3>
              <div className="space-y-3">
                {(["CRITICAL", "HIGH", "MEDIUM", "LOW"] as const).map(
                  (level) => {
                    const total =
                      stats.openclawThreatBreakdown?.[level] ?? 0;
                    const resolved =
                      stats.resolvedThreatBreakdown?.[level] ?? 0;
                    const pct =
                      total > 0 ? Math.round((resolved / total) * 100) : 0;
                    if (total === 0) return null;
                    return (
                      <div key={level}>
                        <div className="flex items-center justify-between mb-1">
                          <span
                            className={`text-xs font-medium ${THREAT_COLORS[level]}`}
                          >
                            {level}
                          </span>
                          <span className="text-xs text-gray-500">
                            {resolved} resolved out of {total} ({pct}%)
                          </span>
                        </div>
                        <div className="w-full h-1.5 bg-gray-800 rounded-full">
                          <div
                            className={`h-1.5 rounded-full ${BAR_COLORS[level]}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  },
                )}
                {(["CRITICAL", "HIGH", "MEDIUM", "LOW"] as const).every(
                  (level) =>
                    (stats.openclawThreatBreakdown?.[level] ?? 0) === 0,
                ) && (
                  <p className="text-xs text-gray-500">
                    No threats detected yet.
                  </p>
                )}
              </div>
            </div>

            {/* Recent Activity */}
            <div className="rounded-xl border border-gray-800 bg-gray-900 p-6">
              <h3 className="text-sm font-medium text-gray-400 mb-4">
                Recent Activity
              </h3>
              {recentActivities.length === 0 ? (
                <p className="text-sm text-gray-500">
                  No activities recorded yet. Activity will appear here as your
                  AI agent runs.
                </p>
              ) : (
                <div className="space-y-2">
                  {recentActivities.map((activity) => (
                    <div
                      key={activity.id}
                      className="flex items-center gap-3 py-2 border-b border-gray-800 last:border-0"
                    >
                      <span
                        className={`text-xs font-medium ${THREAT_COLORS[activity.threatLevel]}`}
                      >
                        {activity.threatLevel}
                      </span>
                      <span className="text-xs text-gray-500">
                        {activity.activityType}
                      </span>
                      <span className="text-xs text-gray-300 flex-1 truncate">
                        {activity.detail}
                      </span>
                      <span className="text-xs text-gray-600">
                        {new Date(activity.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
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
