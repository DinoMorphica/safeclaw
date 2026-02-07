// Content-aware threat classifier — 10 independent analyzers
// Replaces the action-based interceptor logic with content-based classification

import type { ThreatLevel, ActivityType, ThreatFinding, ThreatCategoryId } from "@safeclaw/shared";
import { scanForSecrets } from "./secret-scanner.js";
import {
  PROMPT_INJECTION_STRONG,
  PROMPT_INJECTION_WEAK,
  DESTRUCTIVE_CRITICAL,
  DESTRUCTIVE_HIGH,
  PRIVILEGE_CRITICAL,
  PRIVILEGE_HIGH,
  PRIVILEGE_MEDIUM,
  SUPPLY_CHAIN_HIGH,
  SUPPLY_CHAIN_MEDIUM,
  EXFILTRATION_URLS,
  NETWORK_COMMAND_PATTERNS,
  RAW_IP_URL,
  CODE_EXFILTRATION_PATTERNS,
  OBFUSCATION_PATTERNS,
  SENSITIVE_PATH_RULES,
  SYSTEM_PATH_RULES,
  DEPENDENCY_FILES,
  BUILD_CI_FILES,
} from "./threat-patterns.js";

// --- Input / Output types ---

export interface ClassificationInput {
  activityType: ActivityType;
  detail: string;
  targetPath: string | null;
  contentPreview: string | null;
  readContentPreview: string | null;
  toolName: string | null;
}

export interface ThreatClassification {
  threatLevel: ThreatLevel;
  findings: ThreatFinding[];
  secretsDetected: string[] | null;
}

// --- Severity helpers ---

const SEVERITY_ORDER: Record<ThreatLevel, number> = {
  NONE: 0, LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4,
};

function maxThreat(a: ThreatLevel, b: ThreatLevel): ThreatLevel {
  return SEVERITY_ORDER[a] >= SEVERITY_ORDER[b] ? a : b;
}

function finding(
  categoryId: ThreatCategoryId,
  categoryName: string,
  severity: ThreatLevel,
  reason: string,
  evidence?: string,
  owaspRef?: string,
): ThreatFinding {
  const f: ThreatFinding = { categoryId, categoryName, severity, reason };
  if (evidence) f.evidence = evidence;
  if (owaspRef) f.owaspRef = owaspRef;
  return f;
}

// --- Main classifier ---

export function classifyActivity(input: ClassificationInput): ThreatClassification {
  const findings: ThreatFinding[] = [];

  findings.push(...analyzeSecretExposure(input));
  findings.push(...analyzeDataExfiltration(input));
  findings.push(...analyzePromptInjection(input));
  findings.push(...analyzeDestructiveOps(input));
  findings.push(...analyzePrivilegeEscalation(input));
  findings.push(...analyzeSupplyChain(input));
  findings.push(...analyzeSensitiveFileAccess(input));
  findings.push(...analyzeSystemModification(input));
  findings.push(...analyzeNetworkActivity(input));
  findings.push(...analyzeMcpToolPoisoning(input));

  const threatLevel = findings.length > 0
    ? findings.reduce((max, f) => maxThreat(max, f.severity), "NONE" as ThreatLevel)
    : "NONE";

  const secretTypes = findings
    .filter(f => f.categoryId === "TC-SEC" && f.evidence)
    .map(f => f.evidence!);
  const secretsDetected = secretTypes.length > 0 ? secretTypes : null;

  return { threatLevel, findings, secretsDetected };
}

// --- TC-SEC: Secret Exposure ---
// Agent reads content containing secrets → sent to model provider cloud

function analyzeSecretExposure(input: ClassificationInput): ThreatFinding[] {
  const results: ThreatFinding[] = [];

  // Only relevant for activities that consume content into agent context
  const consumesContent = ["file_read", "shell_command", "web_browse", "tool_call"].includes(input.activityType);
  const writesContent = input.activityType === "file_write";

  // Scan contentPreview for secrets
  if (input.contentPreview) {
    const scan = scanForSecrets(input.contentPreview);
    for (const secretType of scan.types) {
      if (consumesContent) {
        results.push(finding(
          "TC-SEC", "Secret Exposure", scan.maxSeverity,
          `Content contains ${secretType} \u2014 sent to model provider cloud as part of agent context`,
          secretType, "LLM02",
        ));
      } else if (writesContent) {
        results.push(finding(
          "TC-SEC", "Secret Exposure",
          SEVERITY_ORDER[scan.maxSeverity] >= SEVERITY_ORDER["HIGH"] ? "HIGH" : scan.maxSeverity,
          `Writing content containing ${secretType} \u2014 creates credential leak risk`,
          secretType, "LLM02",
        ));
      }
    }
  }

  // Also scan readContentPreview for writes (what was there before the edit)
  if (writesContent && input.readContentPreview) {
    const scan = scanForSecrets(input.readContentPreview);
    for (const secretType of scan.types) {
      // Avoid duplicates if same secret found in both
      if (!results.some(r => r.evidence === secretType)) {
        results.push(finding(
          "TC-SEC", "Secret Exposure", scan.maxSeverity,
          `File being edited contains ${secretType} \u2014 original content was in agent context`,
          secretType, "LLM02",
        ));
      }
    }
  }

  return results;
}

// --- TC-EXF: Data Exfiltration ---
// Agent sends sensitive data to external endpoints

function analyzeDataExfiltration(input: ClassificationInput): ThreatFinding[] {
  const results: ThreatFinding[] = [];

  // Shell commands with outbound data
  if (input.activityType === "shell_command") {
    const cmd = input.detail;

    // Check for data being sent to exfiltration services
    for (const { pattern, label } of EXFILTRATION_URLS) {
      if (pattern.test(cmd)) {
        results.push(finding(
          "TC-EXF", "Data Exfiltration", "HIGH",
          `Command targets known exfiltration service: ${label}`,
          label, "LLM02",
        ));
        break;
      }
    }

    // curl/wget POST with data
    for (const { pattern, label } of NETWORK_COMMAND_PATTERNS) {
      if (pattern.test(cmd) && /(?:--data|-d\s|--post-data)/.test(cmd)) {
        results.push(finding(
          "TC-EXF", "Data Exfiltration", "MEDIUM",
          `Outbound data transfer via ${label}`,
          label, "LLM02",
        ));
        break;
      }
    }
  }

  // Web browse to exfiltration services
  if (input.activityType === "web_browse" && input.targetPath) {
    for (const { pattern, label } of EXFILTRATION_URLS) {
      if (pattern.test(input.targetPath)) {
        results.push(finding(
          "TC-EXF", "Data Exfiltration", "HIGH",
          `Browsing known exfiltration service: ${label}`,
          label, "LLM02",
        ));
        break;
      }
    }
  }

  // Messages containing secrets
  if (input.activityType === "message" && input.contentPreview) {
    const scan = scanForSecrets(input.contentPreview);
    if (scan.types.length > 0) {
      results.push(finding(
        "TC-EXF", "Data Exfiltration", "CRITICAL",
        `Message contains secrets (${scan.types.join(", ")}) being sent externally`,
        scan.types.join(", "), "LLM02",
      ));
    }
  }

  // File writes with exfiltration code patterns
  if (input.activityType === "file_write" && input.contentPreview) {
    for (const { pattern, label } of CODE_EXFILTRATION_PATTERNS) {
      if (pattern.test(input.contentPreview)) {
        results.push(finding(
          "TC-EXF", "Data Exfiltration", "HIGH",
          `Written code contains data exfiltration pattern: ${label}`,
          label, "LLM02",
        ));
        break;
      }
    }
    for (const { pattern, label } of OBFUSCATION_PATTERNS) {
      if (pattern.test(input.contentPreview)) {
        results.push(finding(
          "TC-EXF", "Data Exfiltration", "HIGH",
          `Written code contains obfuscation pattern: ${label}`,
          label, "LLM05",
        ));
        break;
      }
    }
  }

  return results;
}

// --- TC-INJ: Prompt Injection Risk ---
// Agent consumes untrusted content with adversarial instructions

function analyzePromptInjection(input: ClassificationInput): ThreatFinding[] {
  const results: ThreatFinding[] = [];

  // Only relevant for activities that consume external content
  if (!["file_read", "web_browse", "shell_command", "tool_call"].includes(input.activityType)) {
    return results;
  }

  if (!input.contentPreview) return results;

  // Strong patterns — explicit attempts to override agent behavior
  for (const pattern of PROMPT_INJECTION_STRONG) {
    const match = input.contentPreview.match(pattern);
    if (match) {
      const source = input.activityType === "web_browse" ? "Web page" :
        input.activityType === "file_read" ? "File" :
        input.activityType === "shell_command" ? "Command output" : "Content";
      results.push(finding(
        "TC-INJ", "Prompt Injection Risk", "HIGH",
        `${source} contains potential prompt injection: "${match[0].slice(0, 80)}"`,
        match[0].slice(0, 100), "LLM01",
      ));
      break; // One strong match is enough
    }
  }

  // Weak patterns — only flag if from external/untrusted source
  if (results.length === 0 && (input.activityType === "web_browse" || input.activityType === "tool_call")) {
    for (const pattern of PROMPT_INJECTION_WEAK) {
      const match = input.contentPreview.match(pattern);
      if (match) {
        results.push(finding(
          "TC-INJ", "Prompt Injection Risk", "MEDIUM",
          `External content contains instruction-like pattern: "${match[0].slice(0, 80)}"`,
          match[0].slice(0, 100), "LLM01",
        ));
        break;
      }
    }
  }

  return results;
}

// --- TC-DES: Destructive Operation ---

function analyzeDestructiveOps(input: ClassificationInput): ThreatFinding[] {
  const results: ThreatFinding[] = [];

  if (input.activityType === "shell_command") {
    const cmd = input.detail;

    for (const { pattern, label } of DESTRUCTIVE_CRITICAL) {
      if (pattern.test(cmd)) {
        results.push(finding(
          "TC-DES", "Destructive Operation", "CRITICAL",
          `Destructive system command: ${label}`,
          label, "LLM06",
        ));
        return results; // CRITICAL found, no need to check HIGH
      }
    }

    for (const { pattern, label } of DESTRUCTIVE_HIGH) {
      if (pattern.test(cmd)) {
        results.push(finding(
          "TC-DES", "Destructive Operation", "HIGH",
          `Potentially destructive command: ${label}`,
          label, "LLM06",
        ));
        break;
      }
    }
  }

  // File writes with destructive SQL content
  if (input.activityType === "file_write" && input.contentPreview) {
    if (/DROP\s+(?:TABLE|DATABASE|SCHEMA)\b/i.test(input.contentPreview)) {
      results.push(finding(
        "TC-DES", "Destructive Operation", "MEDIUM",
        "File contains destructive SQL statements (DROP)",
        "DROP TABLE/DATABASE", "LLM06",
      ));
    }
  }

  return results;
}

// --- TC-ESC: Privilege Escalation ---

function analyzePrivilegeEscalation(input: ClassificationInput): ThreatFinding[] {
  const results: ThreatFinding[] = [];

  if (input.activityType !== "shell_command") return results;

  const cmd = input.detail;

  for (const { pattern, label } of PRIVILEGE_CRITICAL) {
    if (pattern.test(cmd)) {
      results.push(finding(
        "TC-ESC", "Privilege Escalation", "CRITICAL",
        `Elevated privilege with destructive command: ${label}`,
        label, "LLM06",
      ));
      return results;
    }
  }

  for (const { pattern, label } of PRIVILEGE_HIGH) {
    if (pattern.test(cmd)) {
      results.push(finding(
        "TC-ESC", "Privilege Escalation", "HIGH",
        `Privilege escalation: ${label}`,
        label, "LLM06",
      ));
      break;
    }
  }

  // Only check MEDIUM if no HIGH found
  if (results.length === 0) {
    for (const { pattern, label } of PRIVILEGE_MEDIUM) {
      if (pattern.test(cmd)) {
        results.push(finding(
          "TC-ESC", "Privilege Escalation", "MEDIUM",
          `Permission modification: ${label}`,
          label, "LLM06",
        ));
        break;
      }
    }
  }

  return results;
}

// --- TC-SUP: Supply Chain Risk ---

function analyzeSupplyChain(input: ClassificationInput): ThreatFinding[] {
  const results: ThreatFinding[] = [];

  if (input.activityType === "shell_command") {
    const cmd = input.detail;

    for (const { pattern, label } of SUPPLY_CHAIN_HIGH) {
      if (pattern.test(cmd)) {
        results.push(finding(
          "TC-SUP", "Supply Chain Risk", "HIGH",
          `Package installation or remote execution: ${label}`,
          label, "LLM03",
        ));
        return results;
      }
    }

    for (const { pattern, label } of SUPPLY_CHAIN_MEDIUM) {
      if (pattern.test(cmd)) {
        results.push(finding(
          "TC-SUP", "Supply Chain Risk", "MEDIUM",
          `Package management operation: ${label}`,
          label, "LLM03",
        ));
        break;
      }
    }
  }

  // File writes to dependency/build files
  if (input.activityType === "file_write" && input.targetPath) {
    for (const pattern of DEPENDENCY_FILES) {
      if (pattern.test(input.targetPath)) {
        results.push(finding(
          "TC-SUP", "Supply Chain Risk", "MEDIUM",
          `Modifying dependency file: ${input.targetPath.split("/").pop()}`,
          input.targetPath, "LLM03",
        ));
        break;
      }
    }
    for (const pattern of BUILD_CI_FILES) {
      if (pattern.test(input.targetPath)) {
        results.push(finding(
          "TC-SUP", "Supply Chain Risk", "MEDIUM",
          `Modifying build/CI configuration: ${input.targetPath.split("/").pop()}`,
          input.targetPath, "LLM03",
        ));
        break;
      }
    }
  }

  return results;
}

// --- TC-SFA: Sensitive File Access ---

function analyzeSensitiveFileAccess(input: ClassificationInput): ThreatFinding[] {
  const results: ThreatFinding[] = [];

  if (!["file_read", "file_write"].includes(input.activityType)) return results;
  if (!input.targetPath) return results;

  const isWrite = input.activityType === "file_write";

  for (const rule of SENSITIVE_PATH_RULES) {
    if (rule.pattern.test(input.targetPath)) {
      const severity = isWrite ? rule.writeSeverity : rule.readSeverity;
      const verb = isWrite ? "Writing to" : "Reading";
      results.push(finding(
        "TC-SFA", "Sensitive File Access", severity,
        `${verb} sensitive path: ${rule.label}`,
        input.targetPath, "LLM02",
      ));
      break; // One path match is enough
    }
  }

  return results;
}

// --- TC-SYS: System Modification ---

function analyzeSystemModification(input: ClassificationInput): ThreatFinding[] {
  const results: ThreatFinding[] = [];

  // Only file writes trigger system modification warnings
  if (input.activityType !== "file_write") return results;
  if (!input.targetPath) return results;

  for (const rule of SYSTEM_PATH_RULES) {
    if (rule.pattern.test(input.targetPath)) {
      results.push(finding(
        "TC-SYS", "System Modification", rule.severity,
        `Modifying system path: ${rule.label}`,
        input.targetPath, "LLM06",
      ));
      break;
    }
  }

  return results;
}

// --- TC-NET: Suspicious Network Activity ---

function analyzeNetworkActivity(input: ClassificationInput): ThreatFinding[] {
  const results: ThreatFinding[] = [];

  // Web browse — check URL
  if (input.activityType === "web_browse" && input.targetPath) {
    // Exfiltration URLs are covered in TC-EXF, check for additional network threats
    if (RAW_IP_URL.test(input.targetPath)) {
      results.push(finding(
        "TC-NET", "Suspicious Network", "MEDIUM",
        `Browsing raw IP address instead of domain name`,
        input.targetPath,
      ));
    }
  }

  // Shell commands with network tools
  if (input.activityType === "shell_command") {
    const cmd = input.detail;

    // Check for network commands to suspicious destinations
    for (const { pattern, label } of NETWORK_COMMAND_PATTERNS) {
      if (pattern.test(cmd)) {
        // Only flag if it's not already captured by TC-EXF
        const hasExfilUrl = EXFILTRATION_URLS.some(e => e.pattern.test(cmd));
        if (!hasExfilUrl) {
          results.push(finding(
            "TC-NET", "Suspicious Network", "MEDIUM",
            `Network operation: ${label}`,
            label,
          ));
          break;
        }
      }
    }
  }

  // Messages are inherently network activity
  if (input.activityType === "message") {
    results.push(finding(
      "TC-NET", "Suspicious Network", "LOW",
      "External message sent",
      input.targetPath ?? undefined,
    ));
  }

  return results;
}

// --- TC-MCP: MCP/Tool Poisoning ---

function analyzeMcpToolPoisoning(input: ClassificationInput): ThreatFinding[] {
  const results: ThreatFinding[] = [];

  // Only relevant for unrecognized tool calls
  if (input.activityType !== "tool_call") return results;

  // Check if tool response contains agent-directive content
  if (input.contentPreview) {
    for (const pattern of PROMPT_INJECTION_STRONG) {
      if (pattern.test(input.contentPreview)) {
        results.push(finding(
          "TC-MCP", "MCP/Tool Poisoning", "HIGH",
          `Tool response contains agent-directive content that may manipulate behavior`,
          input.toolName ?? undefined, "LLM01",
        ));
        break;
      }
    }
  }

  return results;
}
