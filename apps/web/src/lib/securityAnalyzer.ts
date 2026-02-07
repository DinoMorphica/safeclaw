import type { AgentActivity } from "@safeclaw/shared";
import type { ParsedActivity } from "./activityParser.js";

export interface SecurityIndicator {
  level: "critical" | "high" | "medium" | "low";
  message: string;
  color: string;
  icon: string;
}

// Sensitive path patterns
const SYSTEM_DIRS = /^(\/etc|\/usr\/bin|\/usr\/local\/bin|\/root|\/System|\/Library\/Launch)/;
const CREDENTIAL_FILES = /\.(env|pem|key|pass|secret|token|keychain|p12|pfx)$/i;
const SSH_PATHS = /\.(ssh|gnupg|aws|gcloud)\//;

// Dangerous command patterns
const SUDO_COMMANDS = /\bsudo\b/;
const DESTRUCTIVE_COMMANDS = /(rm\s+-+[rfRF]|dd\s+(if|of)=|mkfs\.|format\s)/;
const PRIVILEGE_COMMANDS = /(chmod|chown|passwd|su\s|usermod|useradd)/;
const DOWNLOAD_PIPE = /(curl|wget).*\|\s*(sh|bash|zsh)/;

export function analyzeActivitySecurity(
  activity: AgentActivity,
  parsed: ParsedActivity,
): SecurityIndicator[] {
  const indicators: SecurityIndicator[] = [];

  // Rule 1: System file writes (CRITICAL)
  if (activity.activityType === "file_write") {
    const path = parsed.sensitiveFields.path;
    if (path && SYSTEM_DIRS.test(path)) {
      indicators.push({
        level: "critical",
        message: "Writing to system directory",
        color: "border-red-800 bg-red-900/20 text-red-400",
        icon: "🚨",
      });
    }
  }

  // Rule 2: Sudo commands (CRITICAL)
  if (activity.activityType === "shell_command") {
    const cmd = parsed.sensitiveFields.command;
    if (cmd) {
      if (SUDO_COMMANDS.test(cmd)) {
        indicators.push({
          level: "critical",
          message: "Elevated privileges (sudo)",
          color: "border-red-800 bg-red-900/20 text-red-400",
          icon: "⚠️",
        });
      }

      // Rule 3: Destructive commands (CRITICAL)
      if (DESTRUCTIVE_COMMANDS.test(cmd)) {
        indicators.push({
          level: "critical",
          message: "Destructive operation (rm/dd/mkfs)",
          color: "border-red-800 bg-red-900/20 text-red-400",
          icon: "💥",
        });
      }

      // Rule 4: Privilege modification (HIGH)
      if (PRIVILEGE_COMMANDS.test(cmd)) {
        indicators.push({
          level: "high",
          message: "Modifying permissions or users",
          color: "border-orange-800 bg-orange-900/20 text-orange-400",
          icon: "🔐",
        });
      }

      // Rule 5: Download and execute (HIGH)
      if (DOWNLOAD_PIPE.test(cmd)) {
        indicators.push({
          level: "high",
          message: "Downloading and executing script",
          color: "border-orange-800 bg-orange-900/20 text-orange-400",
          icon: "⬇️",
        });
      }
    }
  }

  // Rule 6: Credential file access (HIGH)
  if (activity.activityType === "file_read" || activity.activityType === "file_write") {
    const path = parsed.sensitiveFields.path;
    if (path) {
      if (CREDENTIAL_FILES.test(path)) {
        indicators.push({
          level: "high",
          message: "Accessing credentials/secrets",
          color: "border-orange-800 bg-orange-900/20 text-orange-400",
          icon: "🔑",
        });
      }

      // Rule 7: SSH/Config directories (HIGH)
      if (SSH_PATHS.test(path)) {
        indicators.push({
          level: "high",
          message: "Accessing sensitive config directory",
          color: "border-orange-800 bg-orange-900/20 text-orange-400",
          icon: "📁",
        });
      }
    }
  }

  // Rule 8: IP address web requests (MEDIUM)
  if (activity.activityType === "web_browse") {
    const url = parsed.sensitiveFields.url;
    if (url && /^https?:\/\/\d+\.\d+\.\d+\.\d+/.test(url)) {
      indicators.push({
        level: "medium",
        message: "Connection to IP address (not domain)",
        color: "border-yellow-800 bg-yellow-900/20 text-yellow-400",
        icon: "🌐",
      });
    }
  }

  // Rule 9: Message sending (MEDIUM for awareness)
  if (activity.activityType === "message") {
    indicators.push({
      level: "medium",
      message: "Sending external message",
      color: "border-yellow-800 bg-yellow-900/20 text-yellow-400",
      icon: "💬",
    });
  }

  return indicators;
}
