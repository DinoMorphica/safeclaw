import { useEffect, useState, useCallback } from "react";
import { socket } from "../lib/socket";
import type {
  ExecApprovalEntry,
  AllowlistState,
  ExecDecision,
} from "@safeclaw/shared";

const DECISION_COLORS: Record<string, string> = {
  "allow-once": "text-success",
  "allow-always": "text-blue-400",
  deny: "text-danger",
};

const DECISION_LABELS: Record<string, string> = {
  "allow-once": "ALLOWED",
  "allow-always": "UNRESTRICTED",
  deny: "BLOCKED",
};

function PendingApprovalCard({
  entry,
  onDecision,
}: {
  entry: ExecApprovalEntry;
  onDecision: (id: string, decision: ExecDecision) => void;
}) {
  const [secondsLeft, setSecondsLeft] = useState(() => {
    const ms = new Date(entry.expiresAt).getTime() - Date.now();
    return Math.max(0, Math.ceil(ms / 1000));
  });

  useEffect(() => {
    const interval = setInterval(() => {
      const ms = new Date(entry.expiresAt).getTime() - Date.now();
      const secs = Math.max(0, Math.ceil(ms / 1000));
      setSecondsLeft(secs);
      if (secs <= 0) clearInterval(interval);
    }, 1000);
    return () => clearInterval(interval);
  }, [entry.expiresAt]);

  return (
    <div className="rounded-xl border border-warning/30 bg-gray-900 p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <code className="text-sm text-gray-200 break-all">
            {entry.command}
          </code>
          <div className="flex items-center gap-3 mt-2">
            <span className="text-xs text-gray-500">{entry.cwd}</span>
            <span
              className={`text-xs font-medium ${secondsLeft <= 10 ? "text-danger" : "text-warning"}`}
            >
              {secondsLeft}s remaining
            </span>
          </div>
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            type="button"
            onClick={() => onDecision(entry.id, "allow-once")}
            className="px-3 py-1.5 text-xs font-medium rounded-lg bg-success/10 text-success hover:bg-success/20 transition-colors"
          >
            Allow Once
          </button>
          <button
            type="button"
            onClick={() => onDecision(entry.id, "allow-always")}
            className="px-3 py-1.5 text-xs font-medium rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition-colors"
          >
            Unrestrict
          </button>
          <button
            type="button"
            onClick={() => onDecision(entry.id, "deny")}
            className="px-3 py-1.5 text-xs font-medium rounded-lg bg-danger/10 text-danger hover:bg-danger/20 transition-colors"
          >
            Deny
          </button>
        </div>
      </div>
    </div>
  );
}

export function InterceptionPage() {
  const [pending, setPending] = useState<ExecApprovalEntry[]>([]);
  const [history, setHistory] = useState<ExecApprovalEntry[]>([]);
  const [allowlist, setAllowlist] = useState<string[]>([]);
  const [newPattern, setNewPattern] = useState("");
  const [loading, setLoading] = useState(true);

  const handleApprovalRequested = useCallback(
    (entry: ExecApprovalEntry) => {
      setPending((prev) => {
        if (prev.some((p) => p.id === entry.id)) return prev;
        return [entry, ...prev];
      });
      setLoading(false);
    },
    [],
  );

  const handleApprovalResolved = useCallback(
    (entry: ExecApprovalEntry) => {
      setPending((prev) => prev.filter((p) => p.id !== entry.id));
      setHistory((prev) => {
        if (prev.some((h) => h.id === entry.id)) return prev;
        return [entry, ...prev];
      });
    },
    [],
  );

  const handleHistoryBatch = useCallback((batch: ExecApprovalEntry[]) => {
    // Set history directly from batch (already sorted newest-first)
    setHistory(batch);
  }, []);

  const handleAllowlistState = useCallback((state: AllowlistState) => {
    setAllowlist(state.patterns.map((p) => p.pattern));
  }, []);

  useEffect(() => {
    socket.emit("safeclaw:getPendingApprovals");
    socket.emit("safeclaw:getApprovalHistory", { limit: 50 });
    socket.emit("safeclaw:getAllowlist");

    socket.on("safeclaw:execApprovalRequested", handleApprovalRequested);
    socket.on("safeclaw:execApprovalResolved", handleApprovalResolved);
    socket.on("safeclaw:approvalHistoryBatch", handleHistoryBatch);
    socket.on("safeclaw:allowlistState", handleAllowlistState);

    const timeout = setTimeout(() => setLoading(false), 1000);

    return () => {
      socket.off("safeclaw:execApprovalRequested", handleApprovalRequested);
      socket.off("safeclaw:execApprovalResolved", handleApprovalResolved);
      socket.off("safeclaw:approvalHistoryBatch", handleHistoryBatch);
      socket.off("safeclaw:allowlistState", handleAllowlistState);
      clearTimeout(timeout);
    };
  }, [handleApprovalRequested, handleApprovalResolved, handleHistoryBatch, handleAllowlistState]);

  // Re-request data on reconnect
  useEffect(() => {
    const onReconnect = () => {
      socket.emit("safeclaw:getPendingApprovals");
      socket.emit("safeclaw:getAllowlist");
    };
    socket.on("connect", onReconnect);
    return () => {
      socket.off("connect", onReconnect);
    };
  }, []);

  const handleDecision = (approvalId: string, decision: ExecDecision) => {
    socket.emit("safeclaw:execDecision", { approvalId, decision });
  };

  const handleAddPattern = () => {
    const trimmed = newPattern.trim();
    if (!trimmed) return;
    socket.emit("safeclaw:addAllowlistPattern", { pattern: trimmed });
    setNewPattern("");
  };

  const handleRemovePattern = (pattern: string) => {
    socket.emit("safeclaw:removeAllowlistPattern", { pattern });
  };

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Command Interception</h2>

      {/* Section 1: Restricted Commands */}
      <div className="mb-8">
        <h3 className="text-lg font-semibold text-gray-300 mb-4">
          Restricted Commands
        </h3>
        <p className="text-sm text-gray-500 mb-3">
          Commands matching these patterns will require your approval before
          OpenClaw can execute them. Everything else runs automatically.
        </p>
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-4">
          <div className="flex gap-2 mb-4">
            <input
              type="text"
              value={newPattern}
              onChange={(e) => setNewPattern(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddPattern()}
              placeholder="e.g. sudo *, rm -rf *, curl * | bash"
              className="flex-1 rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-primary"
            />
            <button
              type="button"
              onClick={handleAddPattern}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
            >
              Add Rule
            </button>
          </div>
          {allowlist.length === 0 ? (
            <p className="text-sm text-gray-500">
              No restricted patterns. All commands will auto-execute without
              approval.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {allowlist.map((pattern) => (
                <span
                  key={pattern}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-gray-800 px-3 py-1.5 text-sm text-gray-300"
                >
                  <code>{pattern}</code>
                  <button
                    type="button"
                    onClick={() => handleRemovePattern(pattern)}
                    className="text-gray-500 hover:text-danger transition-colors ml-1"
                    aria-label={`Remove pattern ${pattern}`}
                  >
                    &times;
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Section 2: Pending Approvals */}
      {pending.length > 0 && (
        <div className="mb-8">
          <h3 className="text-lg font-semibold text-warning mb-4">
            Pending Approval ({pending.length})
          </h3>
          <div className="space-y-3">
            {pending.map((entry) => (
              <PendingApprovalCard
                key={entry.id}
                entry={entry}
                onDecision={handleDecision}
              />
            ))}
          </div>
        </div>
      )}

      {/* Section 3: Command History */}
      <div>
        <h3 className="text-lg font-semibold text-gray-300 mb-4">
          Command History
        </h3>
        {loading ? (
          <p className="text-gray-500">Loading...</p>
        ) : history.length === 0 && pending.length === 0 ? (
          <div className="rounded-xl border border-gray-800 bg-gray-900 p-8">
            <p className="text-gray-400">
              No commands intercepted yet. Add restricted command patterns above,
              then commands matching those patterns will appear here for your
              approval.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {history.map((entry) => (
              <div
                key={entry.id}
                className="rounded-lg border border-gray-800 bg-gray-900 p-3 flex items-center gap-4"
              >
                <span
                  className={`text-xs font-medium whitespace-nowrap ${DECISION_COLORS[entry.decision ?? "deny"] ?? "text-gray-400"}`}
                >
                  {entry.decidedBy === "auto-deny"
                    ? "TIMED OUT"
                    : DECISION_LABELS[entry.decision ?? "deny"] ?? "UNKNOWN"}
                </span>
                <code className="text-sm text-gray-300 flex-1 truncate">
                  {entry.command}
                </code>
                <span className="text-xs text-gray-600 whitespace-nowrap">
                  {entry.decidedBy === "auto-deny" ? "auto" : "user"}
                </span>
                <span className="text-xs text-gray-500 whitespace-nowrap">
                  {entry.decidedAt
                    ? new Date(entry.decidedAt).toLocaleTimeString()
                    : ""}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
