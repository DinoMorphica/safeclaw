import { useState, useMemo, useRef, useCallback } from "react";
import { SKILL_SCAN_CATEGORIES } from "../lib/skill-scan-categories";
import type { SkillScanResult, SkillScanFinding, SkillCleanResult } from "@safeclaw/shared";

const THREAT_COLORS: Record<string, string> = {
  CRITICAL: "text-red-400",
  HIGH: "text-orange-400",
  MEDIUM: "text-yellow-400",
  LOW: "text-blue-400",
  NONE: "text-green-400",
};

const THREAT_BG_COLORS: Record<string, string> = {
  CRITICAL: "bg-red-900/20 border-red-800",
  HIGH: "bg-orange-900/20 border-orange-800",
  MEDIUM: "bg-yellow-900/20 border-yellow-800",
  LOW: "bg-blue-900/20 border-blue-800",
};

const SEVERITY_BANNER: Record<string, { bg: string; border: string; text: string; label: string }> =
  {
    CRITICAL: {
      bg: "bg-red-950/40",
      border: "border-red-800",
      text: "text-red-400",
      label: "CRITICAL — Do not use this skill",
    },
    HIGH: {
      bg: "bg-orange-950/40",
      border: "border-orange-800",
      text: "text-orange-400",
      label: "HIGH — Significant risk detected",
    },
    MEDIUM: {
      bg: "bg-yellow-950/40",
      border: "border-yellow-800",
      text: "text-yellow-400",
      label: "MEDIUM — Review recommended",
    },
    LOW: {
      bg: "bg-blue-950/40",
      border: "border-blue-800",
      text: "text-blue-400",
      label: "LOW — Minor concerns",
    },
    NONE: {
      bg: "bg-green-950/40",
      border: "border-green-800",
      text: "text-green-400",
      label: "CLEAN — No threats detected",
    },
  };

const SEVERITY_FILTER_OPTIONS = ["ALL", "CRITICAL", "HIGH", "MEDIUM", "LOW"] as const;

const SEVERITY_PILL_COLORS: Record<string, { active: string; inactive: string }> = {
  ALL: {
    active: "bg-gray-200 text-gray-900",
    inactive: "bg-gray-800 text-gray-400 hover:bg-gray-700",
  },
  CRITICAL: {
    active: "bg-red-500/20 text-red-400 ring-1 ring-red-500/40",
    inactive: "bg-gray-800 text-red-400/60 hover:bg-red-500/10",
  },
  HIGH: {
    active: "bg-orange-500/20 text-orange-400 ring-1 ring-orange-500/40",
    inactive: "bg-gray-800 text-orange-400/60 hover:bg-orange-500/10",
  },
  MEDIUM: {
    active: "bg-yellow-500/20 text-yellow-400 ring-1 ring-yellow-500/40",
    inactive: "bg-gray-800 text-yellow-400/60 hover:bg-yellow-500/10",
  },
  LOW: {
    active: "bg-blue-500/20 text-blue-400 ring-1 ring-blue-500/40",
    inactive: "bg-gray-800 text-blue-400/60 hover:bg-blue-500/10",
  },
};

export function SkillScannerPage() {
  const [content, setContent] = useState("");
  const [result, setResult] = useState<SkillScanResult | null>(null);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [severityFilter, setSeverityFilter] = useState<string>("ALL");
  const [expandedFinding, setExpandedFinding] = useState<number | null>(null);
  const [cleaning, setCleaning] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleScan = useCallback(async () => {
    if (!content.trim()) return;
    setScanning(true);
    setError(null);
    setResult(null);
    setExpandedFinding(null);

    try {
      const res = await fetch("/api/skill-scanner/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError((data as { error?: string }).error ?? `Scan failed (HTTP ${res.status})`);
        return;
      }
      const data = (await res.json()) as SkillScanResult;
      setResult(data);
    } catch {
      setError("Failed to connect to scanner. Is the backend running?");
    } finally {
      setScanning(false);
    }
  }, [content]);

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result;
      if (typeof text === "string") {
        setContent(text);
        setResult(null);
        setError(null);
      }
    };
    reader.readAsText(file);
    // Reset so the same file can be re-uploaded
    e.target.value = "";
  }, []);

  const handleClear = useCallback(() => {
    setContent("");
    setResult(null);
    setError(null);
    setExpandedFinding(null);
  }, []);

  const handleClean = useCallback(async () => {
    if (!content.trim()) return;
    setCleaning(true);
    setError(null);

    try {
      const res = await fetch("/api/skill-scanner/clean", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError((data as { error?: string }).error ?? `Clean failed (HTTP ${res.status})`);
        return;
      }
      const data = (await res.json()) as SkillCleanResult;
      setContent(data.cleanedContent);
      // Auto-trigger re-scan on cleaned content
      setResult(null);
      setExpandedFinding(null);
      setTimeout(async () => {
        try {
          const scanRes = await fetch("/api/skill-scanner/scan", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ content: data.cleanedContent }),
          });
          if (scanRes.ok) {
            const scanData = (await scanRes.json()) as SkillScanResult;
            setResult(scanData);
          }
        } catch {
          // Scan after clean is best-effort
        }
      }, 0);
    } catch {
      setError("Failed to connect to scanner. Is the backend running?");
    } finally {
      setCleaning(false);
    }
  }, [content]);

  const handleDownload = useCallback(() => {
    const blob = new Blob([content], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "cleaned-skill.md";
    a.click();
    URL.revokeObjectURL(url);
  }, [content]);

  const filteredFindings = useMemo(() => {
    if (!result) return [];
    if (severityFilter === "ALL") return result.findings;
    return result.findings.filter((f) => f.severity === severityFilter);
  }, [result, severityFilter]);

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold">Skill Scanner</h2>
        <p className="text-sm text-gray-500 mt-1">
          Paste or upload a markdown skill definition for instant security analysis
        </p>
      </div>

      {/* Input area */}
      <div className="rounded-xl border border-gray-800 bg-gray-900 p-4 mb-6">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Paste skill markdown content here..."
          rows={12}
          className="w-full bg-gray-950 border border-gray-800 rounded-lg p-3 text-sm text-gray-200 font-mono placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-primary/50 resize-y"
        />
        <div className="flex items-center justify-between mt-3">
          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".md,.txt,.markdown"
              onChange={handleFileUpload}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-3 py-1.5 text-xs font-medium rounded-lg bg-primary text-white hover:bg-primary/90 transition-colors cursor-pointer"
            >
              Upload .md
            </button>
            <button
              onClick={handleClear}
              disabled={!content}
              className="px-3 py-1.5 text-xs font-medium rounded-lg bg-primary text-white hover:bg-primary/90 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Clear
            </button>
            {content && (
              <span className="text-xs text-gray-600">{content.length.toLocaleString()} chars</span>
            )}
          </div>
          <button
            onClick={handleScan}
            disabled={!content.trim() || scanning}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-primary text-white hover:bg-primary/90 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {scanning ? "Scanning..." : "Scan for Threats"}
          </button>
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="rounded-xl border border-red-800 bg-red-950/30 p-4 mb-6">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {/* Results */}
      {result && (
        <>
          {/* Overall severity banner */}
          <div
            className={`rounded-xl border p-4 mb-6 ${SEVERITY_BANNER[result.overallSeverity].bg} ${SEVERITY_BANNER[result.overallSeverity].border}`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span
                  className={`text-lg font-bold ${SEVERITY_BANNER[result.overallSeverity].text}`}
                >
                  {SEVERITY_BANNER[result.overallSeverity].label}
                </span>
              </div>
              <div className="flex items-center gap-3">
                {result.overallSeverity !== "NONE" && (
                  <button
                    onClick={handleClean}
                    disabled={cleaning}
                    className="px-4 py-2 text-sm font-semibold rounded-lg bg-primary text-white hover:bg-primary/90 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {cleaning ? "Cleaning..." : "Clean Skill"}
                  </button>
                )}
                <button
                  onClick={handleDownload}
                  className="px-4 py-2 text-sm font-semibold rounded-lg bg-gray-700 text-white hover:bg-gray-600 transition-colors cursor-pointer"
                >
                  Download .md
                </button>
                <div className="flex items-center gap-4 text-xs text-gray-500 ml-1">
                  <span>{result.contentLength.toLocaleString()} chars</span>
                  <span>{result.scanDurationMs}ms</span>
                </div>
              </div>
            </div>
          </div>

          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <div className="rounded-lg border border-gray-800 bg-gray-900 p-3 text-center">
              <p className="text-2xl font-bold text-red-400">{result.summary.critical}</p>
              <p className="text-xs text-gray-500">Critical</p>
            </div>
            <div className="rounded-lg border border-gray-800 bg-gray-900 p-3 text-center">
              <p className="text-2xl font-bold text-orange-400">{result.summary.high}</p>
              <p className="text-xs text-gray-500">High</p>
            </div>
            <div className="rounded-lg border border-gray-800 bg-gray-900 p-3 text-center">
              <p className="text-2xl font-bold text-yellow-400">{result.summary.medium}</p>
              <p className="text-xs text-gray-500">Medium</p>
            </div>
            <div className="rounded-lg border border-gray-800 bg-gray-900 p-3 text-center">
              <p className="text-2xl font-bold text-blue-400">{result.summary.low}</p>
              <p className="text-xs text-gray-500">Low</p>
            </div>
          </div>

          {/* Findings */}
          {result.findings.length > 0 && (
            <>
              {/* Severity filter */}
              <div className="flex items-center gap-2 mb-4">
                <span className="text-xs text-gray-500">Filter:</span>
                <div className="flex gap-1">
                  {SEVERITY_FILTER_OPTIONS.map((opt) => {
                    const isActive = severityFilter === opt;
                    const colors = SEVERITY_PILL_COLORS[opt];
                    return (
                      <button
                        key={opt}
                        onClick={() => setSeverityFilter(opt)}
                        className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
                          isActive ? colors.active : colors.inactive
                        }`}
                      >
                        {opt}
                      </button>
                    );
                  })}
                </div>
                <span className="text-xs text-gray-600 ml-2">
                  {filteredFindings.length} finding{filteredFindings.length !== 1 ? "s" : ""}
                </span>
              </div>

              {/* Finding cards */}
              <div className="space-y-3">
                {filteredFindings.map((finding, idx) => (
                  <FindingCard
                    key={idx}
                    finding={finding}
                    expanded={expandedFinding === idx}
                    onToggle={() => setExpandedFinding((prev) => (prev === idx ? null : idx))}
                  />
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

function FindingCard({
  finding,
  expanded,
  onToggle,
}: {
  finding: SkillScanFinding;
  expanded: boolean;
  onToggle: () => void;
}) {
  const catMeta = SKILL_SCAN_CATEGORIES[finding.categoryId];

  return (
    <div
      className={`rounded-xl border bg-gray-900 overflow-hidden ${
        THREAT_BG_COLORS[finding.severity] ? "border-gray-700" : "border-gray-800"
      }`}
    >
      {/* Header row */}
      <div
        className="p-4 flex items-center gap-3 cursor-pointer hover:bg-gray-800/50 transition-colors"
        onClick={onToggle}
      >
        {/* Expand arrow */}
        <span
          className={`text-gray-500 text-xs transition-transform ${expanded ? "rotate-90" : ""}`}
        >
          &#9654;
        </span>

        {/* Category badge */}
        <span className="px-1.5 py-0.5 bg-gray-800 text-gray-300 rounded font-mono text-[10px]">
          {finding.categoryId}
        </span>

        {/* Severity badge */}
        <span
          className={`text-xs font-medium px-1.5 py-0.5 rounded ${THREAT_COLORS[finding.severity]}`}
        >
          {finding.severity}
        </span>

        {/* Reason */}
        <span className="text-xs text-gray-300 flex-1 truncate">{finding.reason}</span>

        {/* Line number */}
        {finding.lineNumber != null && (
          <span className="text-xs text-gray-600 flex-shrink-0">L{finding.lineNumber}</span>
        )}

        {/* OWASP ref */}
        {finding.owaspRef && (
          <span className="text-[10px] text-gray-500 bg-gray-800 px-1.5 py-0.5 rounded flex-shrink-0">
            {finding.owaspRef}
          </span>
        )}
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-gray-800 p-4 space-y-3">
          {/* Category info */}
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs bg-gray-800 px-1.5 py-0.5 rounded text-gray-300">
              {finding.categoryId}
            </span>
            <span className="text-xs font-medium text-gray-300">
              {catMeta?.name ?? finding.categoryName}
            </span>
            <span className={`text-xs font-medium ${THREAT_COLORS[finding.severity]}`}>
              {finding.severity}
            </span>
            {finding.owaspRef && (
              <span className="text-[10px] text-gray-500 bg-gray-800 px-1 rounded">
                OWASP {finding.owaspRef}
              </span>
            )}
          </div>

          {/* Reason */}
          <p className="text-xs text-gray-300">{finding.reason}</p>

          {/* Evidence */}
          {finding.evidence && (
            <div className="rounded border border-gray-700 bg-gray-800/50 p-3">
              <p className="text-[10px] uppercase tracking-wider text-gray-500 font-medium mb-2">
                Evidence
              </p>
              <pre className="text-xs text-gray-300 font-mono whitespace-pre-wrap break-all max-h-32 overflow-y-auto">
                {finding.evidence}
              </pre>
            </div>
          )}

          {/* Line number */}
          {finding.lineNumber != null && (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-gray-500">Line:</span>
              <code className="bg-gray-800 text-gray-400 px-1.5 py-0.5 rounded font-mono">
                {finding.lineNumber}
              </code>
            </div>
          )}

          {/* Remediation */}
          {finding.remediation && (
            <div className="bg-gray-800/50 rounded p-2.5 border border-gray-700/50">
              <p className="text-[10px] uppercase tracking-wider text-gray-500 font-medium mb-1">
                Recommended Action
              </p>
              <p className="text-xs text-gray-300">{finding.remediation}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
