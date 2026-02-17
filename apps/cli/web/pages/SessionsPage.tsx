import { useEffect, useState, useMemo } from "react";
import { socket } from "../lib/socket";
import { groupActivitiesByToolCall } from "../lib/activityGrouper";
import { ActivityRow, ActivityDetailPanel } from "../components/ActivityDetails";
import type {
  OpenClawSession,
  AgentActivity,
  OpenClawMonitorStatus,
  ThreatLevel,
} from "@safeclaw/shared";

const THREAT_TEXT_COLORS: Record<ThreatLevel, string> = {
  CRITICAL: "text-red-400",
  HIGH: "text-orange-400",
  MEDIUM: "text-yellow-400",
  LOW: "text-blue-400",
  NONE: "text-gray-400",
};

export function SessionsPage() {
  const [openclawSessions, setOpenclawSessions] = useState<OpenClawSession[]>(
    [],
  );
  const [activities, setActivities] = useState<AgentActivity[]>([]);
  const [monitorStatus, setMonitorStatus] =
    useState<OpenClawMonitorStatus | null>(null);
  const [expandedSession, setExpandedSession] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    socket.emit("safeclaw:getOpenclawSessions");
    socket.emit("safeclaw:getOpenclawMonitorStatus");

    const handleOpenClawSession = (session: OpenClawSession) => {
      setOpenclawSessions((prev) => {
        const idx = prev.findIndex((s) => s.id === session.id);
        if (idx >= 0) {
          const updated = [...prev];
          updated[idx] = session;
          return updated;
        }
        return [session, ...prev];
      });
      setLoading(false);
    };

    const handleActivity = (activity: AgentActivity) => {
      setActivities((prev) => {
        if (prev.some((a) => a.id === activity.id)) return prev;
        return [activity, ...prev].slice(0, 200);
      });
    };

    const handleMonitorStatus = (status: OpenClawMonitorStatus) => {
      setMonitorStatus(status);
      setLoading(false);
    };

    socket.on("safeclaw:openclawSessionUpdate", handleOpenClawSession);
    socket.on("safeclaw:openclawActivity", handleActivity);
    socket.on("safeclaw:openclawMonitorStatus", handleMonitorStatus);

    const timer = setTimeout(() => setLoading(false), 2000);

    return () => {
      socket.off("safeclaw:openclawSessionUpdate", handleOpenClawSession);
      socket.off("safeclaw:openclawActivity", handleActivity);
      socket.off("safeclaw:openclawMonitorStatus", handleMonitorStatus);
      clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    if (expandedSession) {
      setActivities([]);
      socket.emit("safeclaw:getOpenclawActivities", {
        sessionId: expandedSession,
        limit: 100,
      });
    }
  }, [expandedSession]);

  const handleReconnect = () => {
    socket.emit("safeclaw:reconnectOpenclaw");
  };

  const connectionColor =
    monitorStatus?.connectionStatus === "connected"
      ? "bg-success"
      : monitorStatus?.connectionStatus === "connecting"
        ? "bg-warning animate-pulse"
        : "bg-danger";

  const connectionLabel =
    monitorStatus?.connectionStatus === "connected"
      ? "Connected"
      : monitorStatus?.connectionStatus === "connecting"
        ? "Connecting..."
        : monitorStatus?.connectionStatus === "not_configured"
          ? "Not Configured"
          : "Disconnected";

  return (
    <div>
      <h2 className="text-2xl font-bold mb-4">Session Monitor</h2>

      {/* Connection status */}
      <div className="rounded-xl border border-gray-800 bg-gray-900 p-4 mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className={`h-2.5 w-2.5 rounded-full ${connectionColor}`} />
          <span className="text-sm text-gray-300">
            OpenClaw Gateway: {connectionLabel}
          </span>
          {monitorStatus?.gatewayPort && (
            <span className="text-xs text-gray-500">
              (port {monitorStatus.gatewayPort})
            </span>
          )}
        </div>
        {monitorStatus?.connectionStatus !== "connected" &&
          monitorStatus?.connectionStatus !== "not_configured" && (
            <button
              type="button"
              onClick={handleReconnect}
              className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-primary/90 transition-colors cursor-pointer"
            >
              Reconnect
            </button>
          )}
      </div>

      <OpenClawSessionsTab
        sessions={openclawSessions}
        activities={activities}
        expandedSession={expandedSession}
        onToggleSession={(id) =>
          setExpandedSession((prev) => (prev === id ? null : id))
        }
        loading={loading}
      />
    </div>
  );
}

function OpenClawSessionsTab({
  sessions,
  activities,
  expandedSession,
  onToggleSession,
  loading,
}: {
  sessions: OpenClawSession[];
  activities: AgentActivity[];
  expandedSession: string | null;
  onToggleSession: (id: string) => void;
  loading: boolean;
}) {
  if (loading) {
    return <p className="text-gray-500">Loading OpenClaw sessions...</p>;
  }

  if (sessions.length === 0) {
    return (
      <div className="rounded-xl border border-gray-800 bg-gray-900 p-6 text-center">
        <p className="text-gray-400">No OpenClaw sessions recorded yet.</p>
        <p className="text-gray-500 text-sm mt-1">
          Sessions will appear here once OpenClaw agent activity is detected.
        </p>
      </div>
    );
  }

  const activeSessions = sessions
    .filter((s) => s.status === "ACTIVE")
    .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
  const pastSessions = sessions
    .filter((s) => s.status === "ENDED")
    .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());

  return (
    <div className="space-y-4">
      {activeSessions.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-gray-400 mb-2">
            Active Sessions
          </h3>
          <div className="space-y-2">
            {activeSessions.map((session) => (
              <SessionCard
                key={session.id}
                session={session}
                activities={
                  expandedSession === session.id ? activities : []
                }
                expanded={expandedSession === session.id}
                onToggle={() => onToggleSession(session.id)}
              />
            ))}
          </div>
        </div>
      )}
      {pastSessions.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-gray-400 mb-2">
            Past Sessions
          </h3>
          <div className="space-y-2">
            {pastSessions.map((session) => (
              <SessionCard
                key={session.id}
                session={session}
                activities={
                  expandedSession === session.id ? activities : []
                }
                expanded={expandedSession === session.id}
                onToggle={() => onToggleSession(session.id)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SessionCard({
  session,
  activities,
  expanded,
  onToggle,
}: {
  session: OpenClawSession;
  activities: AgentActivity[];
  expanded: boolean;
  onToggle: () => void;
}) {
  const isActive = session.status === "ACTIVE";
  const highRisk =
    (session.threatSummary.HIGH ?? 0) + (session.threatSummary.CRITICAL ?? 0);

  // State for tracking which interaction is expanded
  const [expandedInteraction, setExpandedInteraction] = useState<string | null>(null);

  // Group activities by interaction (runId) - newest first
  const groupedInteractions = useMemo(
    () => groupActivitiesByToolCall(activities),
    [activities],
  );

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full p-4 flex items-center justify-between cursor-pointer hover:bg-gray-800/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span
            className={`h-2.5 w-2.5 rounded-full ${isActive ? "bg-success animate-pulse" : "bg-gray-600"}`}
          />
          <div className="text-left">
            <span className="text-sm font-mono text-gray-200">
              {session.id.slice(0, 12)}
            </span>
            {session.model && (
              <span className="ml-2 text-xs text-gray-500">
                {session.model}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          {highRisk > 0 && (
            <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-red-900/40 text-red-400 border border-red-800/50">
              {highRisk} high risk
            </span>
          )}
          <span className="text-xs text-gray-500">
            {session.activityCount} activities
          </span>
          <span className="text-xs text-gray-500">
            {new Date(session.startedAt).toLocaleString()}
          </span>
          <span
            className={`text-gray-400 transition-transform ${expanded ? "rotate-180" : ""}`}
          >
            v
          </span>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-gray-800 p-4">
          <div className="flex gap-2 mb-3">
            {(
              ["CRITICAL", "HIGH", "MEDIUM", "LOW", "NONE"] as ThreatLevel[]
            ).map((level) => {
              const count = session.threatSummary[level] ?? 0;
              if (count === 0) return null;
              return (
                <span
                  key={level}
                  className={`px-2 py-0.5 text-xs rounded-full ${THREAT_TEXT_COLORS[level]} bg-gray-800`}
                >
                  {level}: {count}
                </span>
              );
            })}
          </div>

          {activities.length === 0 ? (
            <p className="text-xs text-gray-500">Loading activities...</p>
          ) : (
            <div className="space-y-0 max-h-80 overflow-y-auto">
              {groupedInteractions.map((interaction) => {
                const key = interaction.runId || `fallback-${interaction.primary.id}`;

                return (
                  <div key={key}>
                    <ActivityRow
                      activity={interaction.primary}
                      phases={interaction.activities}
                      expanded={expandedInteraction === key}
                      onToggle={() =>
                        setExpandedInteraction(
                          expandedInteraction === key ? null : key,
                        )
                      }
                    />
                    {expandedInteraction === key && (
                      <ActivityDetailPanel phases={interaction.activities} />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
