import type { ThreatLevel, ActivityType, ThreatFinding } from "@safeclaw/shared";
import { classifyActivity } from "./lib/threat-classifier.js";

// --- Unified activity threat analyzer ---

export interface ActivityThreatResult {
  threatLevel: ThreatLevel;
  secretsDetected: string[] | null;
  findings: ThreatFinding[];
}

export function analyzeActivityThreat(
  activityType: ActivityType,
  detail: string,
  targetPath: string | null,
  contentPreview?: string | null,
  readContentPreview?: string | null,
  toolName?: string | null,
): ActivityThreatResult {
  const classification = classifyActivity({
    activityType,
    detail,
    targetPath,
    contentPreview: contentPreview ?? null,
    readContentPreview: readContentPreview ?? null,
    toolName: toolName ?? null,
  });

  return {
    threatLevel: classification.threatLevel,
    secretsDetected: classification.secretsDetected,
    findings: classification.findings,
  };
}
