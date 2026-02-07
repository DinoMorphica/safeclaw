import type { AgentActivity } from "@safeclaw/shared";
import type { ParsedActivity } from "../../../lib/activityParser.js";

interface Props {
  activity: AgentActivity;
  parsed: ParsedActivity;
}

export function FileOperationRenderer({ activity, parsed }: Props) {
  const path = parsed.sensitiveFields.path || activity.targetPath;
  const isSensitive =
    path &&
    (/\.(env|pem|key|pass|secret|token)$/i.test(path) ||
      /\.(ssh|gnupg|aws)\//i.test(path) ||
      /^(\/etc|\/usr\/bin|\/root)/i.test(path));

  const result = parsed.result as string | undefined;
  // Prefer contentPreview from the activity (captured via session file watcher)
  const contentPreview = activity.contentPreview || result;

  return (
    <div className="space-y-3">
      {/* Secrets Warning Banner */}
      {activity.secretsDetected && activity.secretsDetected.length > 0 && (
        <div className="p-3 bg-red-900/30 border border-red-700 rounded">
          <p className="text-sm font-semibold text-red-300 mb-1">
            Secrets Detected in Content
          </p>
          <div className="flex flex-wrap gap-1">
            {activity.secretsDetected.map((secret, i) => (
              <span
                key={i}
                className="px-2 py-0.5 text-xs bg-red-800/50 text-red-200 rounded"
              >
                {secret}
              </span>
            ))}
          </div>
        </div>
      )}

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

      {/* Content Preview (from session watcher or raw payload) */}
      {contentPreview && (
        <div>
          <p className="text-xs text-gray-500 mb-1">Content Preview:</p>
          <pre className="text-xs p-3 bg-gray-800 rounded max-h-96 overflow-y-auto text-gray-300 border border-gray-700 whitespace-pre-wrap break-words">
            {contentPreview}
          </pre>
        </div>
      )}

      {/* Original content from preceding read (for write operations) */}
      {activity.activityType === "file_write" && activity.readContentPreview && (
        <div>
          <p className="text-xs text-gray-500 mb-1">Original Content (before edit):</p>
          <pre className="text-xs p-3 bg-gray-800 rounded max-h-96 overflow-y-auto text-gray-400 border border-gray-600 whitespace-pre-wrap break-words">
            {activity.readContentPreview}
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
