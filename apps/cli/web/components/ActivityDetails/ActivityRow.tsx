import { useMemo } from "react";
import type { AgentActivity, ThreatLevel, ActivityType } from "@safeclaw/shared";
import { parseRawPayload } from "../../lib/activityParser.js";

const THREAT_TEXT_COLORS: Record<ThreatLevel, string> = {
  CRITICAL: "text-red-400",
  HIGH: "text-orange-400",
  MEDIUM: "text-yellow-400",
  LOW: "text-blue-400",
  NONE: "text-gray-400",
};

const THREAT_COLORS: Record<ThreatLevel, string> = {
  CRITICAL: "bg-red-500",
  HIGH: "bg-orange-500",
  MEDIUM: "bg-yellow-400",
  LOW: "bg-blue-500",
  NONE: "bg-gray-500",
};

const ACTIVITY_ICONS: Record<ActivityType, string> = {
  file_read: "R",
  file_write: "W",
  shell_command: "$",
  web_browse: "@",
  tool_call: "T",
  message: "M",
  unknown: "?",
};

const ACTIVITY_LABELS: Record<ActivityType, string> = {
  file_read: "File Read",
  file_write: "File Write",
  shell_command: "Shell",
  web_browse: "Web",
  tool_call: "Tool",
  message: "Message",
  unknown: "Unknown",
};

interface Props {
  activity: AgentActivity; // Primary (most recent activity in interaction)
  phases: AgentActivity[]; // All activities in this interaction
  expanded: boolean;
  onToggle: () => void;
}

export function ActivityRow({ activity, phases, expanded, onToggle }: Props) {
  const parsed = useMemo(
    () => parseRawPayload(activity.rawPayload),
    [activity.rawPayload],
  );

  // Count unique activity types in this interaction
  const activityCount = phases.length;

  return (
    <button
      type="button"
      onClick={onToggle}
      className="w-full text-left flex items-center gap-2 py-1.5 px-2 rounded hover:bg-gray-800/50 transition-colors cursor-pointer group"
    >
      {/* Expand toggle */}
      <span
        className={`text-gray-400 transition-transform ${expanded ? "rotate-90" : ""}`}
      >
        ▶
      </span>

      {/* Icon */}
      <span
        className={`w-6 h-6 rounded flex items-center justify-center text-xs font-mono font-bold bg-gray-800 ${THREAT_TEXT_COLORS[activity.threatLevel]}`}
      >
        {ACTIVITY_ICONS[activity.activityType]}
      </span>

      {/* Threat dot */}
      <span
        className={`w-1.5 h-1.5 rounded-full ${THREAT_COLORS[activity.threatLevel]}`}
      />

      {/* Interaction label */}
      <span className="text-xs text-gray-500 shrink-0">
        Interaction
      </span>

      {/* Detail with run ID and activity count */}
      <span className="text-xs text-gray-300 flex-1 truncate font-mono flex items-center gap-1">
        {parsed.runId && parsed.runId !== "" && (
          <span className="text-gray-500">[{parsed.runId.slice(0, 8)}]</span>
        )}
        {activityCount > 1 && (
          <span className="text-gray-600">({activityCount} activities)</span>
        )}
        <span>{activity.detail}</span>
      </span>

      {/* Timestamp */}
      <span className="text-xs text-gray-600 shrink-0">
        {new Date(activity.timestamp).toLocaleTimeString()}
      </span>
    </button>
  );
}
