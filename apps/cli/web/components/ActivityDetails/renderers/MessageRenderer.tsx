import type { AgentActivity } from "@safeclaw/shared";
import type { ParsedActivity } from "../../../lib/activityParser.js";

interface Props {
  activity: AgentActivity;
  parsed: ParsedActivity;
}

export function MessageRenderer({ parsed }: Props) {
  const recipient = parsed.sensitiveFields.recipient;
  const channel = parsed.args.channel as string | undefined;
  const provider = parsed.args.provider as string | undefined;
  const action = parsed.args.action as string | undefined;
  const messageContent =
    (parsed.args.message as string) ||
    (parsed.args.content as string) ||
    (typeof parsed.meta === "string" ? parsed.meta : "");

  return (
    <div className="space-y-3">
      {/* Channel & Provider Info */}
      <div className="grid grid-cols-2 gap-3">
        {recipient && (
          <div>
            <p className="text-xs text-gray-500 mb-1">Recipient:</p>
            <p className="text-sm text-gray-300 font-mono">{recipient}</p>
          </div>
        )}
        {(channel || provider) && (
          <div>
            <p className="text-xs text-gray-500 mb-1">Channel:</p>
            <p className="text-sm text-gray-300">{channel || provider || "N/A"}</p>
          </div>
        )}
      </div>

      {/* Action */}
      {action && (
        <div>
          <p className="text-xs text-gray-500 mb-1">Action:</p>
          <span className="text-xs px-2 py-1 bg-gray-800 rounded text-gray-300">{action}</span>
        </div>
      )}

      {/* Message Content */}
      {messageContent && (
        <div>
          <p className="text-xs text-gray-500 mb-1">Message:</p>
          <div className="p-3 bg-gray-800 rounded text-sm text-gray-300 border border-gray-700 max-h-96 overflow-y-auto whitespace-pre-wrap break-words">
            {messageContent}
          </div>
        </div>
      )}

      {/* Result/Status */}
      {parsed.phase === "result" && (
        <div
          className={`p-2 rounded text-xs border ${
            parsed.isError
              ? "bg-red-900/20 border-red-800/50 text-red-400"
              : "bg-green-900/20 border-green-800/50 text-green-400"
          }`}
        >
          {parsed.isError ? "❌ Message failed to send" : "✓ Message delivered"}
        </div>
      )}

      {/* Additional metadata */}
      {parsed.meta && typeof parsed.meta === "object" && (
        <div>
          <p className="text-xs text-gray-500 mb-1">Additional Info:</p>
          <pre className="text-xs p-2 bg-gray-800 rounded overflow-auto text-gray-400">
            {JSON.stringify(parsed.meta, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
