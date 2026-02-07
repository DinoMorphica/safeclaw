import type { ThreatLevel, ActivityType } from "@safeclaw/shared";

// --- Shell command patterns ---

const CRITICAL_PATTERNS = [
  /rm\s+(-rf?|--recursive)\s+\//,
  /mkfs\./,
  /dd\s+if=\/dev/,
  /:\(\)\s*\{\s*:\|:\s*&\s*\}\s*;/,
  /chmod\s+777\s+\//,
];

const HIGH_PATTERNS = [
  /sudo\s+/,
  /rm\s+-rf/,
  /DROP\s+TABLE/i,
  /DELETE\s+FROM/i,
  /npm\s+install\s+-g/,
  /pip\s+install/,
];

const MEDIUM_PATTERNS = [
  /curl\s+.*\|\s*(sh|bash)/,
  /wget\s+/,
  /chmod\s+/,
  /chown\s+/,
];

export function analyzeThreat(command: string): ThreatLevel {
  if (CRITICAL_PATTERNS.some((p) => p.test(command))) return "CRITICAL";
  if (HIGH_PATTERNS.some((p) => p.test(command))) return "HIGH";
  if (MEDIUM_PATTERNS.some((p) => p.test(command))) return "MEDIUM";
  return "NONE";
}

// --- File operation patterns ---

const SENSITIVE_PATHS = [
  /\/etc\/passwd/,
  /\/etc\/shadow/,
  /\.ssh\//,
  /\.env$/,
  /\.env\./,
  /\.aws\/credentials/,
  /\.gnupg\//,
  /id_rsa/,
  /\.pem$/,
  /\.key$/,
  /\.keychain/,
];

const SYSTEM_CRITICAL_PATHS = [
  /^\/etc\//,
  /^\/usr\/bin\//,
  /^\/usr\/sbin\//,
  /^\/boot\//,
  /^\/System\//,
  /^\/Library\/Launch/,
];

export function analyzeFileReadThreat(filePath: string): ThreatLevel {
  if (SENSITIVE_PATHS.some((p) => p.test(filePath))) return "HIGH";
  if (SYSTEM_CRITICAL_PATHS.some((p) => p.test(filePath))) return "MEDIUM";
  return "NONE";
}

export function analyzeFileWriteThreat(filePath: string): ThreatLevel {
  if (SENSITIVE_PATHS.some((p) => p.test(filePath))) return "CRITICAL";
  if (SYSTEM_CRITICAL_PATHS.some((p) => p.test(filePath))) return "HIGH";
  if (/\/\.\w+/.test(filePath)) return "MEDIUM";
  return "LOW";
}

// --- Web browsing patterns ---

const SUSPICIOUS_URLS = [
  /pastebin\.com/,
  /paste\.ee/,
  /transfer\.sh/,
  /ngrok\.io/,
  /requestbin/,
  /webhook\.site/,
];

export function analyzeWebBrowseThreat(url: string): ThreatLevel {
  if (SUSPICIOUS_URLS.some((p) => p.test(url))) return "HIGH";
  if (/^https?:\/\/\d+\.\d+\.\d+\.\d+/.test(url)) return "MEDIUM";
  return "NONE";
}

// --- Unified activity threat analyzer ---

export function analyzeActivityThreat(
  activityType: ActivityType,
  detail: string,
  targetPath: string | null,
): ThreatLevel {
  switch (activityType) {
    case "shell_command":
      return analyzeThreat(detail);
    case "file_read":
      return analyzeFileReadThreat(targetPath ?? detail);
    case "file_write":
      return analyzeFileWriteThreat(targetPath ?? detail);
    case "web_browse":
      return analyzeWebBrowseThreat(targetPath ?? detail);
    case "tool_call":
      return "LOW";
    case "message":
      return "MEDIUM";
    default:
      return "NONE";
  }
}
