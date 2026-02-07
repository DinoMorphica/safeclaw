import type { AgentActivity } from "@safeclaw/shared";
import type { ParsedActivity } from "../../../lib/activityParser.js";

interface Props {
  activity: AgentActivity;
  parsed: ParsedActivity;
}

export function FileOperationRenderer({ activity, parsed }: Props) {
  const path = parsed.sensitiveFields.path;
  const isSensitive =
    path &&
    (/\.(env|pem|key|pass|secret|token)$/i.test(path) ||
      /\.(ssh|gnupg|aws)\//i.test(path) ||
      /^(\/etc|\/usr\/bin|\/root)/i.test(path));

  const result = parsed.result as string | undefined;

  return (
    <div className="space-y-3">
      {/* File Path */}
      <div>
        <p className="text-xs text-gray-500 mb-1">Path:</p>
        <code
          className={`text-sm block p-2 bg-gray-800 rounded break-all font-mono ${
            isSensitive
              ? "text-red-300 border border-red-800/50"
              : "text-green-300"
          }`}
        >
          {path || "unknown"}
        </code>
      </div>

      {/* Content Preview (for reads) */}
      {activity.activityType === "file_read" &&
        result &&
        parsed.phase === "result" && (
          <div>
            <p className="text-xs text-gray-500 mb-1">Content Preview:</p>
            <pre className="text-xs p-3 bg-gray-800 rounded max-h-96 overflow-y-auto text-gray-300 border border-gray-700 whitespace-pre-wrap break-words">
              {result}
            </pre>
          </div>
        )}

      {/* Write confirmation (for writes) */}
      {activity.activityType === "file_write" && parsed.phase === "result" && (
        <div
          className={`p-2 rounded text-xs border ${
            parsed.isError
              ? "bg-red-900/20 border-red-800/50 text-red-400"
              : "bg-green-900/20 border-green-800/50 text-green-400"
          }`}
        >
          {parsed.isError
            ? "❌ File write failed"
            : "✓ File written successfully"}
        </div>
      )}

      {/* Metadata */}
      {parsed.meta && typeof parsed.meta === "object" && (
        <div>
          <p className="text-xs text-gray-500 mb-1">Metadata:</p>
          <pre className="text-xs p-2 bg-gray-800 rounded overflow-auto text-gray-400">
            {JSON.stringify(parsed.meta, null, 2)}
          </pre>
        </div>
      )}

      {/* Error indicator */}
      {parsed.isError && (
        <div className="p-2 bg-red-900/20 border border-red-800/50 rounded">
          <p className="text-xs text-red-400 font-medium">
            ⚠️ Error occurred during operation
          </p>
        </div>
      )}
    </div>
  );
}
