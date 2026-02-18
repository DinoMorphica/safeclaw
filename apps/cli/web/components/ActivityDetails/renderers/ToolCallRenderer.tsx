import type { AgentActivity } from "@safeclaw/shared";
import type { ParsedActivity } from "../../../lib/activityParser.js";

interface Props {
  activity: AgentActivity;
  parsed: ParsedActivity;
}

export function ToolCallRenderer({ parsed }: Props) {
  const result = parsed.result as string | undefined;

  return (
    <div className="space-y-3">
      {/* Tool Name */}
      <div>
        <p className="text-xs text-gray-500 mb-1">Tool:</p>
        <span className="text-sm px-3 py-1.5 bg-gray-800 rounded text-gray-200 font-mono">
          {parsed.toolName}
        </span>
      </div>

      {/* Arguments */}
      {Object.keys(parsed.args).length > 0 && (
        <div>
          <p className="text-xs text-gray-500 mb-1">Arguments:</p>
          <div className="space-y-1 p-2 bg-gray-800 rounded">
            {Object.entries(parsed.args).map(([key, value]) => (
              <div key={key} className="flex gap-2 text-xs">
                <span className="text-gray-500 font-mono min-w-[100px]">{key}:</span>
                <span className="text-gray-300 break-all">
                  {typeof value === "object" ? JSON.stringify(value) : String(value)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Description/Meta */}
      {parsed.meta && (
        <div>
          <p className="text-xs text-gray-500 mb-1">Description:</p>
          {typeof parsed.meta === "string" ? (
            <p className="text-xs text-gray-400 p-2 bg-gray-800 rounded">{parsed.meta}</p>
          ) : (
            <pre className="text-xs p-2 bg-gray-800 rounded overflow-auto text-gray-400">
              {JSON.stringify(parsed.meta, null, 2)}
            </pre>
          )}
        </div>
      )}

      {/* Result */}
      {result && parsed.phase === "result" && (
        <div>
          <p className="text-xs text-gray-500 mb-1">Result:</p>
          <pre className="text-xs p-3 bg-gray-800 rounded max-h-96 overflow-y-auto text-gray-300 border border-gray-700 whitespace-pre-wrap break-words">
            {typeof result === "object" ? JSON.stringify(result, null, 2) : result}
          </pre>
        </div>
      )}

      {/* Status */}
      {parsed.phase === "result" && (
        <div
          className={`p-2 rounded text-xs border ${
            parsed.isError
              ? "bg-red-900/20 border-red-800/50 text-red-400"
              : "bg-green-900/20 border-green-800/50 text-green-400"
          }`}
        >
          {parsed.isError ? "❌ Tool execution failed" : "✓ Tool executed successfully"}
        </div>
      )}
    </div>
  );
}
