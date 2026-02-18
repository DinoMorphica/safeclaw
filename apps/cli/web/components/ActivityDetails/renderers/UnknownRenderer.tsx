import type { AgentActivity } from "@safeclaw/shared";
import type { ParsedActivity } from "../../../lib/activityParser.js";

interface Props {
  activity: AgentActivity;
  parsed: ParsedActivity;
}

export function UnknownRenderer({ activity, parsed }: Props) {
  return (
    <div className="space-y-3">
      {/* Warning Message */}
      <div className="p-2 bg-yellow-900/20 border border-yellow-800/50 rounded">
        <p className="text-xs text-yellow-400 font-medium">
          ⚠️ Unknown activity type - displaying raw data
        </p>
      </div>

      {/* Activity Type */}
      <div>
        <p className="text-xs text-gray-500 mb-1">Activity Type:</p>
        <span className="text-sm px-3 py-1.5 bg-gray-800 rounded text-gray-200">
          {activity.activityType}
        </span>
      </div>

      {/* Tool Name (if available) */}
      {parsed.toolName && parsed.toolName !== "unknown" && (
        <div>
          <p className="text-xs text-gray-500 mb-1">Tool Name:</p>
          <span className="text-sm px-3 py-1.5 bg-gray-800 rounded text-gray-200 font-mono">
            {parsed.toolName}
          </span>
        </div>
      )}

      {/* Detail */}
      <div>
        <p className="text-xs text-gray-500 mb-1">Detail:</p>
        <p className="text-xs text-gray-300 p-2 bg-gray-800 rounded">{activity.detail}</p>
      </div>

      {/* Parsed Activity Data */}
      <div>
        <p className="text-xs text-gray-500 mb-1">Parsed Data:</p>
        <pre className="text-xs p-3 bg-gray-800 rounded max-h-96 overflow-y-auto text-gray-300 border border-gray-700">
          {JSON.stringify(parsed, null, 2)}
        </pre>
      </div>
    </div>
  );
}
