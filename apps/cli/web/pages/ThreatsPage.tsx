import { useEffect, useState, useMemo, useCallback } from "react";
import { socket } from "../lib/socket";
import { getRemediation } from "../lib/threat-remediation";
import type { AgentActivity } from "@safeclaw/shared";

const THREAT_COLORS: Record<string, string> = {
  CRITICAL: "text-red-400",
  HIGH: "text-orange-400",
  MEDIUM: "text-yellow-400",
  LOW: "text-blue-400",
  NONE: "text-green-400",
};

const THREAT_BG_COLORS: Record<string, string> = {
  CRITICAL: "bg-red-900/20 border-red-800",
  HIGH: "bg-orange-900/20 border-orange-800",
  MEDIUM: "bg-yellow-900/20 border-yellow-800",
  LOW: "bg-blue-900/20 border-blue-800",
};

const ACTIVITY_ICONS: Record<string, string> = {
  file_read: "R",
  file_write: "W",
  shell_command: "$",
  web_browse: "@",
  tool_call: "T",
  message: "M",
  unknown: "?",
};

const SEVERITY_OPTIONS = ["ALL", "CRITICAL", "HIGH", "MEDIUM", "LOW"] as const;
const RESOLVED_OPTIONS = ["all", "unresolved", "resolved"] as const;

const SEVERITY_PILL_COLORS: Record<string, { active: string; inactive: string }> = {
  ALL: {
    active: "bg-gray-200 text-gray-900",
    inactive: "bg-gray-800 text-gray-400 hover:bg-gray-700",
  },
  CRITICAL: {
    active: "bg-red-500/20 text-red-400 ring-1 ring-red-500/40",
    inactive: "bg-gray-800 text-red-400/60 hover:bg-red-500/10",
  },
  HIGH: {
    active: "bg-orange-500/20 text-orange-400 ring-1 ring-orange-500/40",
    inactive: "bg-gray-800 text-orange-400/60 hover:bg-orange-500/10",
  },
  MEDIUM: {
    active: "bg-yellow-500/20 text-yellow-400 ring-1 ring-yellow-500/40",
    inactive: "bg-gray-800 text-yellow-400/60 hover:bg-yellow-500/10",
  },
  LOW: {
    active: "bg-blue-500/20 text-blue-400 ring-1 ring-blue-500/40",
    inactive: "bg-gray-800 text-blue-400/60 hover:bg-blue-500/10",
  },
};

const RESOLVED_PILL_COLORS: Record<string, { active: string; inactive: string }> = {
  all: {
    active: "bg-gray-200 text-gray-900",
    inactive: "bg-gray-800 text-gray-400 hover:bg-gray-700",
  },
  unresolved: {
    active: "bg-amber-500/20 text-amber-400 ring-1 ring-amber-500/40",
    inactive: "bg-gray-800 text-amber-400/60 hover:bg-amber-500/10",
  },
  resolved: {
    active: "bg-green-500/20 text-green-400 ring-1 ring-green-500/40",
    inactive: "bg-gray-800 text-green-400/60 hover:bg-green-500/10",
  },
};

export function ThreatsPage() {
  const [threats, setThreats] = useState<AgentActivity[]>([]);
  const [severityFilter, setSeverityFilter] = useState<string>("ALL");
  const [resolvedFilter, setResolvedFilter] = useState<string>("all");
  const [expandedThreat, setExpandedThreat] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchThreats = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (severityFilter !== "ALL") params.set("severity", severityFilter);
      if (resolvedFilter !== "all")
        params.set("resolved", resolvedFilter === "resolved" ? "true" : "false");
      params.set("limit", "200");

      const res = await fetch(`/api/openclaw/threats?${params.toString()}`);
      if (res.ok) {
        const data = (await res.json()) as AgentActivity[];
        setThreats(data);
      }
    } catch {
      // fetch failed
    } finally {
      setLoading(false);
    }
  }, [severityFilter, resolvedFilter]);

  useEffect(() => {
    fetchThreats();
  }, [fetchThreats]);

  useEffect(() => {
    const handleThreatResolved = (updated: AgentActivity) => {
      setThreats((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
    };
    const handleNewActivity = (activity: AgentActivity) => {
      if (activity.threatLevel !== "NONE") {
        setThreats((prev) => {
          if (prev.some((t) => t.id === activity.id)) return prev;
          return [activity, ...prev];
        });
      }
    };
    socket.on("safeclaw:threatResolved", handleThreatResolved);
    socket.on("safeclaw:openclawActivity", handleNewActivity);
    return () => {
      socket.off("safeclaw:threatResolved", handleThreatResolved);
      socket.off("safeclaw:openclawActivity", handleNewActivity);
    };
  }, []);

  const filteredThreats = useMemo(() => {
    return threats
      .filter((t) => severityFilter === "ALL" || t.threatLevel === severityFilter)
      .filter((t) => {
        if (resolvedFilter === "resolved") return t.resolved;
        if (resolvedFilter === "unresolved") return !t.resolved;
        return true;
      })
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [threats, severityFilter, resolvedFilter]);

  const handleToggleResolve = useCallback((activityId: number, currentResolved: boolean) => {
    socket.emit("safeclaw:resolveActivity", {
      activityId,
      resolved: !currentResolved,
    });
  }, []);

  const unresolvedCount = threats.filter((t) => !t.resolved).length;
  const resolvedCount = threats.filter((t) => t.resolved).length;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold">Threat Center</h2>
          <p className="text-sm text-gray-500 mt-1">
            {unresolvedCount} unresolved / {threats.length} total threats
          </p>
        </div>
        <div className="flex items-center gap-5">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">Severity:</span>
            <div className="flex gap-1">
              {SEVERITY_OPTIONS.map((opt) => {
                const isActive = severityFilter === opt;
                const colors = SEVERITY_PILL_COLORS[opt];
                return (
                  <button
                    key={opt}
                    onClick={() => setSeverityFilter(opt)}
                    className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
                      isActive ? colors.active : colors.inactive
                    }`}
                  >
                    {opt}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">Status:</span>
            <div className="flex gap-1">
              {RESOLVED_OPTIONS.map((opt) => {
                const isActive = resolvedFilter === opt;
                const colors = RESOLVED_PILL_COLORS[opt];
                return (
                  <button
                    key={opt}
                    onClick={() => setResolvedFilter(opt)}
                    className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
                      isActive ? colors.active : colors.inactive
                    }`}
                  >
                    {opt.charAt(0).toUpperCase() + opt.slice(1)}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Summary bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div className="rounded-lg border border-gray-800 bg-gray-900 p-3 text-center">
          <p className="text-2xl font-bold text-red-400">
            {threats.filter((t) => t.threatLevel === "CRITICAL").length}
          </p>
          <p className="text-xs text-gray-500">Critical</p>
        </div>
        <div className="rounded-lg border border-gray-800 bg-gray-900 p-3 text-center">
          <p className="text-2xl font-bold text-orange-400">
            {threats.filter((t) => t.threatLevel === "HIGH").length}
          </p>
          <p className="text-xs text-gray-500">High</p>
        </div>
        <div className="rounded-lg border border-gray-800 bg-gray-900 p-3 text-center">
          <p className="text-2xl font-bold text-yellow-400">
            {threats.filter((t) => t.threatLevel === "MEDIUM").length}
          </p>
          <p className="text-xs text-gray-500">Medium</p>
        </div>
        <div className="rounded-lg border border-gray-800 bg-gray-900 p-3 text-center">
          <p className="text-2xl font-bold text-green-400">{resolvedCount}</p>
          <p className="text-xs text-gray-500">Resolved</p>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-gray-500">Loading threats...</p>
      ) : filteredThreats.length === 0 ? (
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-8 text-center">
          <p className="text-gray-500">No threats found matching current filters.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredThreats.map((threat) => (
            <ThreatCard
              key={threat.id}
              threat={threat}
              expanded={expandedThreat === threat.id}
              onToggle={() => setExpandedThreat((prev) => (prev === threat.id ? null : threat.id))}
              onToggleResolve={handleToggleResolve}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ThreatCard({
  threat,
  expanded,
  onToggle,
  onToggleResolve,
}: {
  threat: AgentActivity;
  expanded: boolean;
  onToggle: () => void;
  onToggleResolve: (id: number, currentResolved: boolean) => void;
}) {
  return (
    <div
      className={`rounded-xl border bg-gray-900 overflow-hidden ${
        threat.resolved ? "border-gray-800 opacity-60" : "border-gray-700"
      }`}
    >
      {/* Header */}
      <div
        className="p-4 flex items-center gap-3 cursor-pointer hover:bg-gray-800/50 transition-colors"
        onClick={onToggle}
      >
        {/* Expand arrow */}
        <span
          className={`text-gray-500 text-xs transition-transform ${expanded ? "rotate-90" : ""}`}
        >
          &#9654;
        </span>

        {/* Activity type icon */}
        <span className="flex-shrink-0 w-7 h-7 rounded bg-gray-800 flex items-center justify-center text-xs font-mono text-gray-400">
          {ACTIVITY_ICONS[threat.activityType] ?? "?"}
        </span>

        {/* Severity badge */}
        <span
          className={`text-xs font-medium px-1.5 py-0.5 rounded ${THREAT_COLORS[threat.threatLevel]}`}
        >
          {threat.threatLevel}
        </span>

        {/* Category badges */}
        <div className="flex gap-1">
          {threat.threatFindings?.map((f, i) => (
            <span
              key={i}
              className="px-1.5 py-0.5 bg-gray-800 text-gray-400 rounded font-mono text-[10px]"
            >
              {f.categoryId}
            </span>
          ))}
        </div>

        {/* Detail text */}
        <span className="text-xs text-gray-300 flex-1 truncate">{threat.detail}</span>

        {/* Timestamp */}
        <span className="text-xs text-gray-600 flex-shrink-0">
          {new Date(threat.timestamp).toLocaleString()}
        </span>

        {/* Status tag (click to toggle) */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleResolve(threat.id, threat.resolved);
          }}
          className={`px-3 py-1 text-xs rounded-lg font-medium transition-colors cursor-pointer flex-shrink-0 ${
            threat.resolved
              ? "bg-green-500/20 text-green-400 ring-1 ring-green-500/40 hover:bg-green-500/30"
              : "bg-amber-500/20 text-amber-400 ring-1 ring-amber-500/40 hover:bg-amber-500/30"
          }`}
        >
          {threat.resolved ? "Resolved" : "Unresolved"}
        </button>
      </div>

      {/* Expanded section */}
      {expanded && (
        <div className="border-t border-gray-800 p-4 space-y-3">
          {/* Identified content / secrets */}
          {threat.secretsDetected && threat.secretsDetected.length > 0 && (
            <div className="rounded border border-red-900/50 bg-red-950/20 p-3">
              <p className="text-[10px] uppercase tracking-wider text-red-400 font-medium mb-2">
                Identified Secrets
              </p>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {threat.secretsDetected.map((secret, i) => (
                  <span
                    key={i}
                    className="px-2 py-0.5 bg-red-900/30 text-red-300 rounded text-xs font-mono"
                  >
                    {secret}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Detected content preview */}
          {threat.contentPreview && (
            <div className="rounded border border-gray-700 bg-gray-800/50 p-3">
              <p className="text-[10px] uppercase tracking-wider text-gray-500 font-medium mb-2">
                Detected Content
              </p>
              <pre className="text-xs text-gray-300 font-mono whitespace-pre-wrap break-all max-h-40 overflow-y-auto">
                {threat.contentPreview}
              </pre>
            </div>
          )}

          {/* Interaction ID */}
          {threat.runId && (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-gray-500">Interaction ID:</span>
              <code className="bg-gray-800 text-gray-400 px-1.5 py-0.5 rounded font-mono">
                {threat.runId}
              </code>
            </div>
          )}

          {/* Threat findings with remediation */}
          {threat.threatFindings && threat.threatFindings.length > 0 ? (
            threat.threatFindings.map((finding, i) => {
              const remed = getRemediation(finding);
              return (
                <div
                  key={i}
                  className={`p-3 rounded border ${
                    THREAT_BG_COLORS[finding.severity] ?? "bg-gray-800 border-gray-700"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-mono text-xs bg-gray-800 px-1.5 py-0.5 rounded text-gray-300">
                      {finding.categoryId}
                    </span>
                    <span className="text-xs font-medium text-gray-300">
                      {finding.categoryName}
                    </span>
                    <span className={`text-xs font-medium ${THREAT_COLORS[finding.severity]}`}>
                      {finding.severity}
                    </span>
                    {finding.owaspRef && (
                      <span className="text-[10px] text-gray-500 bg-gray-800 px-1 rounded">
                        {finding.owaspRef}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-300 mb-1">{finding.reason}</p>
                  {finding.evidence && (
                    <p className="text-xs text-gray-500 mb-2">
                      <span className="text-gray-600">Evidence:</span>{" "}
                      <code className="bg-gray-800 px-1 rounded">{finding.evidence}</code>
                    </p>
                  )}
                  {/* Remediation suggestion */}
                  <div className="bg-gray-800/50 rounded p-2.5 mt-2 border border-gray-700/50">
                    <p className="text-[10px] uppercase tracking-wider text-gray-500 font-medium mb-1">
                      Recommended Action
                    </p>
                    <p className="text-xs text-gray-300">{remed.defaultAdvice}</p>
                    {remed.contextAdvice && (
                      <p className="text-xs text-gray-500 mt-1">{remed.contextAdvice}</p>
                    )}
                  </div>
                </div>
              );
            })
          ) : (
            <p className="text-xs text-gray-500">No detailed findings available.</p>
          )}

          {/* Activity details */}
          <div className="flex items-center gap-4 text-xs text-gray-500 pt-2 border-t border-gray-800">
            <span>
              Type: <span className="text-gray-400">{threat.activityType}</span>
            </span>
            {threat.toolName && (
              <span>
                Tool: <span className="text-gray-400 font-mono">{threat.toolName}</span>
              </span>
            )}
            {threat.targetPath && (
              <span>
                Path: <span className="text-gray-400 font-mono">{threat.targetPath}</span>
              </span>
            )}
          </div>

          {threat.resolved && threat.resolvedAt && (
            <p className="text-xs text-gray-600">
              Resolved at: {new Date(threat.resolvedAt).toLocaleString()}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
