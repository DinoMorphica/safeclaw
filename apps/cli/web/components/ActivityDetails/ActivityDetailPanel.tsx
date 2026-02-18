import { useState, useMemo } from "react";
import type { AgentActivity } from "@safeclaw/shared";
import { parseRawPayload } from "../../lib/activityParser.js";
import { analyzeActivitySecurity } from "../../lib/securityAnalyzer.js";
import { ActivityToolRenderer } from "./ActivityToolRenderer.js";

interface Props {
  phases: AgentActivity[]; // All activities in this interaction
}

export function ActivityDetailPanel({ phases }: Props) {
  const [showRaw, setShowRaw] = useState(false);

  // Use the latest activity for primary display
  const latestActivity = phases[phases.length - 1];
  const parsed = useMemo(
    () => parseRawPayload(latestActivity.rawPayload),
    [latestActivity.rawPayload],
  );

  const indicators = useMemo(
    () => analyzeActivitySecurity(latestActivity, parsed),
    [latestActivity, parsed],
  );

  return (
    <div className="ml-8 mt-2 mb-3 p-3 bg-gray-900/50 border border-gray-800 rounded space-y-3">
      {/* Security Indicators */}
      {indicators.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-gray-500 font-medium">Threat Findings ({indicators.length})</p>
          {indicators.map((indicator, i) => (
            <div
              key={i}
              className={`flex items-start gap-2 p-2 rounded text-xs border ${indicator.color}`}
            >
              <span className="text-base shrink-0">{indicator.icon}</span>
              <div className="flex flex-col gap-0.5 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  {indicator.categoryId && (
                    <span className="px-1.5 py-0.5 bg-gray-800 text-gray-300 rounded font-mono text-[10px] shrink-0">
                      {indicator.categoryId}
                    </span>
                  )}
                  <span className="font-medium">{indicator.message}</span>
                  {indicator.owaspRef && (
                    <span className="px-1 py-0.5 bg-gray-700/50 text-gray-400 rounded text-[10px] shrink-0">
                      OWASP {indicator.owaspRef}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Run ID */}
      {parsed.runId && (
        <div className="p-2 bg-gray-800 rounded">
          <p className="text-xs text-gray-500 mb-1">Interaction Run ID:</p>
          <code className="text-xs text-gray-400 break-all font-mono">{parsed.runId}</code>
        </div>
      )}

      {/* Activity Timeline (if multiple activities) */}
      {phases.length > 1 && (
        <div className="border border-gray-700 rounded p-2 bg-gray-800/50">
          <p className="text-xs text-gray-400 mb-2 font-medium">
            Activity Timeline ({phases.length} activities)
          </p>
          <div className="space-y-1">
            {phases.map((activity, idx) => {
              const activityParsed = parseRawPayload(activity.rawPayload);
              return (
                <div key={activity.id} className="flex items-center gap-2 text-xs text-gray-400">
                  <span className="text-gray-600">{idx + 1}.</span>
                  <span
                    className={`px-1.5 py-0.5 rounded font-mono ${
                      activity.activityType === "file_read"
                        ? "bg-blue-900/30 text-blue-400"
                        : activity.activityType === "file_write"
                          ? "bg-orange-900/30 text-orange-400"
                          : activity.activityType === "shell_command"
                            ? "bg-red-900/30 text-red-400"
                            : activity.activityType === "message"
                              ? "bg-purple-900/30 text-purple-400"
                              : activity.activityType === "web_browse"
                                ? "bg-cyan-900/30 text-cyan-400"
                                : "bg-gray-700 text-gray-400"
                    }`}
                  >
                    {activity.toolName || activity.activityType}
                  </span>
                  <span className="text-gray-500 truncate" title={activity.detail}>
                    {activity.detail}
                  </span>
                  <span className="text-gray-600 shrink-0">
                    {new Date(activity.timestamp).toLocaleTimeString()}
                  </span>
                  {activityParsed.isError && <span className="text-red-400 text-xs">⚠ error</span>}
                  {activity.threatLevel !== "NONE" && (
                    <span
                      className={`px-1 py-0.5 rounded text-[10px] font-medium shrink-0 ${
                        activity.threatLevel === "CRITICAL"
                          ? "bg-red-900/40 text-red-400"
                          : activity.threatLevel === "HIGH"
                            ? "bg-orange-900/40 text-orange-400"
                            : activity.threatLevel === "MEDIUM"
                              ? "bg-yellow-900/40 text-yellow-400"
                              : "bg-blue-900/40 text-blue-400"
                      }`}
                    >
                      {activity.threatLevel}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tool-specific details (show details for latest activity) */}
      <ActivityToolRenderer activity={latestActivity} parsed={parsed} />

      {/* Tool Call ID (if available) */}
      {parsed.toolCallId && (
        <div className="p-2 bg-gray-800 rounded">
          <p className="text-xs text-gray-500 mb-1">Tool Call ID:</p>
          <code className="text-xs text-gray-400 break-all font-mono">{parsed.toolCallId}</code>
        </div>
      )}

      {/* Raw JSON toggle */}
      <button
        type="button"
        onClick={() => setShowRaw(!showRaw)}
        className="text-xs text-gray-500 hover:text-gray-400 transition-colors underline"
      >
        {showRaw ? "Hide" : "Show"} raw data
      </button>

      {showRaw && (
        <pre className="text-xs bg-gray-800 p-3 rounded overflow-auto max-h-60 text-gray-300 border border-gray-700">
          {JSON.stringify(JSON.parse(latestActivity.rawPayload), null, 2)}
        </pre>
      )}
    </div>
  );
}
