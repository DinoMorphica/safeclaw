import type { AgentActivity } from "@safeclaw/shared";
import type { ParsedActivity } from "../../../lib/activityParser.js";

interface Props {
  activity: AgentActivity;
  parsed: ParsedActivity;
}

export function ShellCommandRenderer({ activity, parsed }: Props) {
  const command = parsed.sensitiveFields.command;
  const isDangerous =
    command &&
    (/\bsudo\b/i.test(command) ||
      /(rm\s+-+[rfRF]|dd\s+(if|of)=|mkfs\.|format\s)/i.test(command));

  const result = parsed.result as string | undefined;
  const cwd = parsed.args.cwd as string | undefined;

  return (
    <div className="space-y-3">
      {/* Command */}
      <div>
        <p className="text-xs text-gray-500 mb-1">Command:</p>
        <code
          className={`text-sm block p-3 bg-gray-800 rounded font-mono break-all ${
            isDangerous
              ? "text-red-300 border border-red-800/50"
              : "text-gray-200"
          }`}
        >
          {command || "unknown"}
        </code>
      </div>

      {/* Working Directory */}
      {cwd && (
        <div>
          <p className="text-xs text-gray-500 mb-1">Working Directory:</p>
          <code className="text-xs block p-2 bg-gray-800 rounded text-gray-400 font-mono">
            {cwd}
          </code>
        </div>
      )}

      {/* Output */}
      {result && parsed.phase === "result" && (
        <div>
          <p className="text-xs text-gray-500 mb-1">Output:</p>
          <pre className="text-xs p-3 bg-gray-800 rounded max-h-96 overflow-y-auto text-gray-300 border border-gray-700 whitespace-pre-wrap break-words">
            {result}
          </pre>
        </div>
      )}

      {/* Error indicator */}
      {parsed.isError && (
        <div className="p-2 bg-red-900/20 border border-red-800/50 rounded">
          <p className="text-xs text-red-400 font-medium">
            ⚠️ Command execution failed
          </p>
          {result && (
            <pre className="text-xs mt-2 text-red-300 whitespace-pre-wrap">
              {result}
            </pre>
          )}
        </div>
      )}

      {/* Metadata */}
      {parsed.meta && typeof parsed.meta === "string" && (
        <div>
          <p className="text-xs text-gray-500 mb-1">Description:</p>
          <p className="text-xs text-gray-400">{parsed.meta}</p>
        </div>
      )}
    </div>
  );
}
