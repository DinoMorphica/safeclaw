import { useEffect, useState, useCallback, useRef } from "react";
import { Link } from "react-router-dom";
import { socket } from "../lib/socket";
import {
  Box,
  FolderLock,
  Globe,
  Shield,
  Terminal,
  Plug,
  DoorOpen,
  KeyRound,
  PackageCheck,
  ScanLine,
  Eye,
  UserCheck,
  CheckCircle,
  AlertTriangle,
  XCircle,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  ExternalLink,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { SecurityPosture, SecurityLayer, SecurityLayerStatus } from "@safeclaw/shared";
import { SECURITY_LAYER_META } from "../lib/security-layers";

const ICON_MAP: Record<string, LucideIcon> = {
  Box,
  FolderLock,
  Globe,
  Shield,
  Terminal,
  Plug,
  DoorOpen,
  KeyRound,
  PackageCheck,
  ScanLine,
  Eye,
  UserCheck,
};

const STATUS_COLORS: Record<SecurityLayerStatus, string> = {
  configured: "bg-emerald-500",
  partial: "bg-yellow-500",
  unconfigured: "bg-red-500",
  error: "bg-gray-500",
};

const STATUS_LABELS: Record<SecurityLayerStatus, string> = {
  configured: "Configured",
  partial: "Partial",
  unconfigured: "Not Configured",
  error: "Error",
};

const CONNECTOR_COLORS: Record<SecurityLayerStatus, string> = {
  configured: "bg-emerald-500/40",
  partial: "bg-yellow-500/40",
  unconfigured: "bg-red-500/30",
  error: "bg-gray-500/30",
};

function scoreColor(score: number): string {
  if (score >= 80) return "text-emerald-400";
  if (score >= 50) return "text-yellow-400";
  return "text-red-400";
}

function scoreStrokeColor(score: number): string {
  if (score >= 80) return "stroke-emerald-400";
  if (score >= 50) return "stroke-yellow-400";
  return "stroke-red-400";
}

function scoreBgColor(score: number): string {
  if (score >= 80) return "bg-emerald-500/10 border-emerald-500/20";
  if (score >= 50) return "bg-yellow-500/10 border-yellow-500/20";
  return "bg-red-500/10 border-red-500/20";
}

function ScoreRing({ score }: { score: number }) {
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width="140" height="140" className="-rotate-90">
        <circle
          cx="70"
          cy="70"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="8"
          className="text-gray-800"
        />
        <circle
          cx="70"
          cy="70"
          r={radius}
          fill="none"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className={`${scoreStrokeColor(score)} transition-all duration-700`}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className={`text-3xl font-bold ${scoreColor(score)}`}>{score}</span>
        <span className="text-xs text-gray-500">/ 100</span>
      </div>
    </div>
  );
}

function CheckItem({
  check,
}: {
  check: { id: string; label: string; passed: boolean; detail: string; severity: string };
}) {
  const Icon = check.passed ? CheckCircle : check.severity === "critical" ? XCircle : AlertTriangle;
  const iconColor = check.passed
    ? "text-emerald-400"
    : check.severity === "critical"
      ? "text-red-400"
      : "text-yellow-400";

  return (
    <div className="flex items-start gap-3 py-2">
      <Icon size={16} className={`mt-0.5 flex-shrink-0 ${iconColor}`} />
      <div className="min-w-0">
        <p className="text-sm text-gray-200">{check.label}</p>
        <p className="text-xs text-gray-500 mt-0.5">{check.detail}</p>
      </div>
    </div>
  );
}

function LayerCard({
  layer,
  index,
  isLast,
}: {
  layer: SecurityLayer;
  index: number;
  isLast: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const meta = SECURITY_LAYER_META[layer.id];
  const IconComponent = meta ? ICON_MAP[meta.icon] || Box : Box;
  const Chevron = expanded ? ChevronDown : ChevronRight;

  return (
    <div className="relative">
      {/* Connector line to next card */}
      {!isLast && (
        <div
          className={`absolute left-[23px] top-full w-0.5 h-6 ${CONNECTOR_COLORS[layer.status]}`}
        />
      )}

      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left rounded-xl border border-gray-800 bg-gray-900 hover:border-gray-700 transition-colors"
      >
        <div className="flex items-center gap-4 px-5 py-4">
          {/* Status dot */}
          <div className="relative flex-shrink-0">
            <div className={`w-3 h-3 rounded-full ${STATUS_COLORS[layer.status]}`} />
          </div>

          {/* Icon */}
          <div className="flex-shrink-0 text-gray-400">
            <IconComponent size={20} />
          </div>

          {/* Layer info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-200">
                {index + 1}. {meta?.name ?? layer.name}
              </span>
              <span className="text-xs text-gray-600">{STATUS_LABELS[layer.status]}</span>
            </div>
            {meta && <p className="text-xs text-gray-500 mt-0.5 truncate">{meta.description}</p>}
          </div>

          {/* Check count */}
          <div className="flex items-center gap-3 flex-shrink-0">
            <span className="text-xs text-gray-500">
              {layer.passedCount}/{layer.totalCount} checks
            </span>
            {meta && (
              <Link
                to={meta.actionPath}
                onClick={(e) => e.stopPropagation()}
                className="text-xs text-primary hover:text-primary/80 flex items-center gap-1"
              >
                Configure
                <ExternalLink size={10} />
              </Link>
            )}
            <Chevron size={16} className="text-gray-500" />
          </div>
        </div>
      </button>

      {/* Expanded details */}
      {expanded && (
        <div className="rounded-b-xl border border-t-0 border-gray-800 bg-gray-900/50 px-5 pb-4 -mt-3 pt-1">
          {/* Individual checks */}
          <div className="divide-y divide-gray-800/50">
            {layer.checks.map((check) => (
              <CheckItem key={check.id} check={check} />
            ))}
          </div>

          {/* Guidance & refs */}
          {meta && (
            <div className="mt-3 pt-3 border-t border-gray-800/50">
              <p className="text-xs text-gray-500 leading-relaxed">{meta.guidance}</p>
              {meta.owaspRefs.length > 0 && (
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-xs text-gray-600">OWASP:</span>
                  {meta.owaspRefs.map((ref) => (
                    <span
                      key={ref}
                      className="text-xs bg-gray-800 text-gray-400 px-1.5 py-0.5 rounded"
                    >
                      {ref}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function SecurityWorkflowPage() {
  const [posture, setPosture] = useState<SecurityPosture | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchPosture = useCallback(async () => {
    try {
      const res = await fetch("/api/security-posture");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as SecurityPosture;
      setPosture(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  const debouncedRefetch = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchPosture();
    }, 500);
  }, [fetchPosture]);

  useEffect(() => {
    fetchPosture();

    socket.on("safeclaw:accessControlState", debouncedRefetch);
    socket.on("safeclaw:openclawConfig", debouncedRefetch);
    socket.on("safeclaw:openclawMonitorStatus", debouncedRefetch);
    socket.on("safeclaw:threatResolved", debouncedRefetch);

    return () => {
      socket.off("safeclaw:accessControlState", debouncedRefetch);
      socket.off("safeclaw:openclawConfig", debouncedRefetch);
      socket.off("safeclaw:openclawMonitorStatus", debouncedRefetch);
      socket.off("safeclaw:threatResolved", debouncedRefetch);
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [fetchPosture, debouncedRefetch]);

  if (loading) {
    return (
      <div>
        <h2 className="text-2xl font-bold mb-6">Security Workflow</h2>
        <p className="text-gray-500">Analyzing security posture...</p>
      </div>
    );
  }

  if (error || !posture) {
    return (
      <div>
        <h2 className="text-2xl font-bold mb-6">Security Workflow</h2>
        <p className="text-red-400">Failed to load security posture{error ? `: ${error}` : ""}</p>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold">Security Workflow</h2>
          <p className="text-sm text-gray-500 mt-1">
            12-layer security pipeline — checks run against your live configuration
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-600">
            Last scan: {new Date(posture.checkedAt).toLocaleTimeString()}
          </span>
          <button
            onClick={() => {
              setLoading(true);
              fetchPosture();
            }}
            className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-200 bg-gray-800 hover:bg-gray-700 rounded-lg px-3 py-1.5 transition-colors"
          >
            <RefreshCw size={12} />
            Re-scan
          </button>
        </div>
      </div>

      {/* Score Section */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        {/* Score Ring */}
        <div
          className={`rounded-xl border p-6 flex flex-col items-center justify-center ${scoreBgColor(posture.overallScore)}`}
        >
          <ScoreRing score={posture.overallScore} />
          <p className="text-sm text-gray-400 mt-2">Security Score</p>
        </div>

        {/* Status Cards */}
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-6 flex flex-col justify-center">
          <p className="text-sm text-gray-400">Configured</p>
          <p className="text-3xl font-bold mt-1 text-emerald-400">{posture.configuredLayers}</p>
          <p className="text-xs text-gray-600 mt-1">of {posture.totalLayers} layers</p>
        </div>
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-6 flex flex-col justify-center">
          <p className="text-sm text-gray-400">Partial</p>
          <p className="text-3xl font-bold mt-1 text-yellow-400">{posture.partialLayers}</p>
          <p className="text-xs text-gray-600 mt-1">need attention</p>
        </div>
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-6 flex flex-col justify-center">
          <p className="text-sm text-gray-400">Not Configured</p>
          <p className="text-3xl font-bold mt-1 text-red-400">{posture.unconfiguredLayers}</p>
          <p className="text-xs text-gray-600 mt-1">require setup</p>
        </div>
      </div>

      {/* Pipeline */}
      <div className="space-y-6">
        <h3 className="text-sm font-medium text-gray-400">Security Pipeline</h3>
        <div className="space-y-6">
          {posture.layers.map((layer, idx) => (
            <LayerCard
              key={layer.id}
              layer={layer}
              index={idx}
              isLast={idx === posture.layers.length - 1}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
