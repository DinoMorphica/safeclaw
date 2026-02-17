import type { AgentActivity } from "@safeclaw/shared";
import type { ParsedActivity } from "../../../lib/activityParser.js";

interface Props {
  activity: AgentActivity;
  parsed: ParsedActivity;
}

export function WebBrowseRenderer({ activity, parsed }: Props) {
  const url = parsed.sensitiveFields.url;
  const action = parsed.args.action as string | undefined;
  const result = parsed.result as string | undefined;

  return (
    <div className="space-y-3">
      {/* URL */}
      <div>
        <p className="text-xs text-gray-500 mb-1">URL:</p>
        <code className="text-sm block p-2 bg-gray-800 rounded break-all text-blue-300 font-mono">
          {url || "unknown"}
        </code>
      </div>

      {/* Action */}
      {action && (
        <div>
          <p className="text-xs text-gray-500 mb-1">Action:</p>
          <span className="text-xs px-2 py-1 bg-gray-800 rounded text-gray-300">
            {action}
          </span>
        </div>
      )}

      {/* Arguments */}
      {Object.keys(parsed.args).length > 0 && (
        <div>
          <p className="text-xs text-gray-500 mb-1">Arguments:</p>
          <div className="space-y-1">
            {Object.entries(parsed.args)
              .filter(([key]) => key !== "action" && key !== "url")
              .map(([key, value]) => (
                <div key={key} className="flex gap-2 text-xs">
                  <span className="text-gray-500 font-mono">{key}:</span>
                  <span className="text-gray-300">{String(value)}</span>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Result */}
      {result && parsed.phase === "result" && (
        <div>
          <p className="text-xs text-gray-500 mb-1">Response:</p>
          <pre className="text-xs p-3 bg-gray-800 rounded max-h-96 overflow-y-auto text-gray-300 border border-gray-700 whitespace-pre-wrap break-words">
            {result}
          </pre>
        </div>
      )}

      {/* Success indicator */}
      {parsed.phase === "result" && !parsed.isError && (
        <div className="p-2 bg-green-900/20 border border-green-800/50 rounded">
          <p className="text-xs text-green-400">✓ Request completed successfully</p>
        </div>
      )}

      {/* Error indicator */}
      {parsed.isError && (
        <div className="p-2 bg-red-900/20 border border-red-800/50 rounded">
          <p className="text-xs text-red-400 font-medium">
            ⚠️ Request failed
          </p>
        </div>
      )}
    </div>
  );
}
