// Skill Scanner — static security analysis engine for markdown skill definitions
// Runs 15 analyzers (SK-* categories) and returns structured findings

import type {
  ThreatLevel,
  SkillScanCategoryId,
  SkillScanFinding,
  SkillScanResult,
  SkillCleanResult,
} from "@safeclaw/shared";
import { scanForSecrets, SECRET_PATTERNS } from "./secret-scanner.js";
import { EXFILTRATION_URLS, SENSITIVE_PATH_RULES } from "./threat-patterns.js";
import {
  HIDDEN_CONTENT_PATTERNS,
  PROMPT_INJECTION_PATTERNS,
  SHELL_EXECUTION_PATTERNS,
  DATA_EXFILTRATION_PATTERNS,
  MEMORY_POISONING_PATTERNS,
  SUPPLY_CHAIN_PATTERNS,
  ENCODED_PAYLOAD_PATTERNS,
  IMAGE_EXFIL_PATTERNS,
  SYSTEM_PROMPT_EXTRACTION_PATTERNS,
  ARGUMENT_INJECTION_PATTERNS,
  CROSS_TOOL_PATTERNS,
  EXCESSIVE_PERMISSION_PATTERNS,
  type ScanPattern,
} from "./skill-scanner-patterns.js";

const SEVERITY_ORDER: Record<ThreatLevel, number> = {
  NONE: 0,
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
  CRITICAL: 4,
};

function getLineNumber(content: string, index: number): number {
  let line = 1;
  for (let i = 0; i < index && i < content.length; i++) {
    if (content[i] === "\n") line++;
  }
  return line;
}

function maxSeverity(a: ThreatLevel, b: ThreatLevel): ThreatLevel {
  return SEVERITY_ORDER[a] >= SEVERITY_ORDER[b] ? a : b;
}

function runPatternScan(
  content: string,
  patterns: ScanPattern[],
  categoryId: SkillScanCategoryId,
  categoryName: string,
  owaspRef?: string,
  remediation?: string,
): SkillScanFinding[] {
  const findings: SkillScanFinding[] = [];
  const seen = new Set<string>();

  for (const { pattern, label, severity } of patterns) {
    // Use a fresh regex with global flag for match iteration
    const globalPattern = new RegExp(
      pattern.source,
      pattern.flags.includes("g") ? pattern.flags : pattern.flags + "g",
    );
    let match: RegExpExecArray | null;

    while ((match = globalPattern.exec(content)) !== null) {
      const key = `${categoryId}:${label}:${match.index}`;
      if (seen.has(key)) break;
      seen.add(key);

      const evidence = match[0].length > 120 ? match[0].slice(0, 120) + "..." : match[0];
      findings.push({
        categoryId,
        categoryName,
        severity,
        reason: label,
        evidence,
        owaspRef,
        remediation,
        lineNumber: getLineNumber(content, match.index),
      });

      // Only report first match per pattern to avoid noise
      break;
    }
  }

  return findings;
}

// --- Individual Analyzers ---

function scanHiddenContent(content: string): SkillScanFinding[] {
  return runPatternScan(
    content,
    HIDDEN_CONTENT_PATTERNS,
    "SK-HID",
    "Hidden Content",
    "LLM01",
    "Remove all hidden content. HTML comments, zero-width characters, and CSS hiding can conceal malicious instructions from human reviewers.",
  );
}

function scanPromptInjection(content: string): SkillScanFinding[] {
  return runPatternScan(
    content,
    PROMPT_INJECTION_PATTERNS,
    "SK-INJ",
    "Prompt Injection",
    "LLM01",
    "Remove prompt injection vectors. These phrases attempt to override the agent's instructions and redirect its behavior.",
  );
}

function scanShellExecution(content: string): SkillScanFinding[] {
  return runPatternScan(
    content,
    SHELL_EXECUTION_PATTERNS,
    "SK-EXE",
    "Shell Execution",
    "LLM06",
    "Remove dangerous shell commands. Skill definitions should not contain executable code, reverse shells, or remote code execution patterns.",
  );
}

function scanDataExfiltration(content: string): SkillScanFinding[] {
  // Combine our patterns with existing EXFILTRATION_URLS from threat-patterns
  const findings = runPatternScan(
    content,
    DATA_EXFILTRATION_PATTERNS,
    "SK-EXF",
    "Data Exfiltration",
    "LLM02",
    "Remove or replace exfiltration URLs. These destinations are commonly used to steal data from compromised systems.",
  );

  // Also check threat-patterns EXFILTRATION_URLS not already covered
  for (const { pattern, label } of EXFILTRATION_URLS) {
    const globalPattern = new RegExp(pattern.source, "gi");
    const match = globalPattern.exec(content);
    if (match) {
      const alreadyFound = findings.some((f) => f.evidence?.includes(match[0]));
      if (!alreadyFound) {
        findings.push({
          categoryId: "SK-EXF",
          categoryName: "Data Exfiltration",
          severity: "HIGH",
          reason: `Exfiltration URL: ${label}`,
          evidence: match[0],
          owaspRef: "LLM02",
          remediation: "Remove or replace exfiltration URLs.",
          lineNumber: getLineNumber(content, match.index),
        });
      }
    }
  }

  return findings;
}

function scanEmbeddedSecrets(content: string): SkillScanFinding[] {
  const { types } = scanForSecrets(content);
  if (types.length === 0) return [];

  // Re-scan to get line numbers for each type
  const findings: SkillScanFinding[] = [];
  for (const secretType of types) {
    findings.push({
      categoryId: "SK-SEC",
      categoryName: "Embedded Secrets",
      severity: "CRITICAL",
      reason: `Embedded credential: ${secretType}`,
      owaspRef: "LLM02",
      remediation:
        "Remove all hardcoded credentials. Use environment variables or a secrets manager instead.",
    });
  }
  return findings;
}

function scanSensitiveFileRefs(content: string): SkillScanFinding[] {
  const findings: SkillScanFinding[] = [];
  const seen = new Set<string>();

  for (const { pattern, label, readSeverity } of SENSITIVE_PATH_RULES) {
    const globalPattern = new RegExp(pattern.source, "g");
    const match = globalPattern.exec(content);
    if (match && !seen.has(label)) {
      seen.add(label);
      findings.push({
        categoryId: "SK-SFA",
        categoryName: "Sensitive File References",
        severity: readSeverity,
        reason: `Reference to sensitive path: ${label}`,
        evidence: match[0],
        owaspRef: "LLM02",
        remediation:
          "Remove references to sensitive files and directories. Skills should not instruct agents to access credentials, keys, or system auth files.",
        lineNumber: getLineNumber(content, match.index),
      });
    }
  }

  return findings;
}

function scanMemoryPoisoning(content: string): SkillScanFinding[] {
  return runPatternScan(
    content,
    MEMORY_POISONING_PATTERNS,
    "SK-MEM",
    "Memory/Config Poisoning",
    "LLM05",
    "Remove instructions that modify agent memory or configuration files. This is a persistence technique that can compromise future sessions.",
  );
}

function scanSupplyChainRisk(content: string): SkillScanFinding[] {
  return runPatternScan(
    content,
    SUPPLY_CHAIN_PATTERNS,
    "SK-SUP",
    "Supply Chain Risk",
    "LLM03",
    "Verify all external dependencies and script URLs. Prefer pinned versions and checksums over arbitrary remote scripts.",
  );
}

function scanEncodedPayloads(content: string): SkillScanFinding[] {
  return runPatternScan(
    content,
    ENCODED_PAYLOAD_PATTERNS,
    "SK-B64",
    "Encoded Payloads",
    "LLM01",
    "Decode and inspect encoded content. Base64 and hex encoding is commonly used to evade pattern detection in malicious skills.",
  );
}

function scanImageExfiltration(content: string): SkillScanFinding[] {
  return runPatternScan(
    content,
    IMAGE_EXFIL_PATTERNS,
    "SK-IMG",
    "Image Exfiltration",
    "LLM02",
    "Remove image tags with dynamic, suspicious, or embedded content. Images can exfiltrate data via query parameters, inline data URIs, SVG scripts, tracking pixels, or steganographic encoding. Avoid data: URIs, SVG images with scripts, and references to steganography tools.",
  );
}

function scanSystemPromptExtraction(content: string): SkillScanFinding[] {
  return runPatternScan(
    content,
    SYSTEM_PROMPT_EXTRACTION_PATTERNS,
    "SK-SYS",
    "System Prompt Extraction",
    "LLM01",
    "Remove instructions that attempt to extract system prompts. This information can be used to craft more effective attacks.",
  );
}

function scanArgumentInjection(content: string): SkillScanFinding[] {
  return runPatternScan(
    content,
    ARGUMENT_INJECTION_PATTERNS,
    "SK-ARG",
    "Argument Injection",
    "LLM01",
    "Remove shell metacharacters and command substitution patterns. These can be used to inject arbitrary commands via tool arguments.",
  );
}

function scanCrossToolChaining(content: string): SkillScanFinding[] {
  return runPatternScan(
    content,
    CROSS_TOOL_PATTERNS,
    "SK-XTL",
    "Cross-Tool Chaining",
    "LLM05",
    "Review multi-step tool invocation instructions carefully. Attackers chain legitimate tools to achieve malicious outcomes.",
  );
}

function scanExcessivePermissions(content: string): SkillScanFinding[] {
  return runPatternScan(
    content,
    EXCESSIVE_PERMISSION_PATTERNS,
    "SK-PRM",
    "Excessive Permissions",
    "LLM01",
    "Remove requests for unrestricted access or security bypasses. Skills should operate with minimal required permissions.",
  );
}

function scanSuspiciousStructure(content: string): SkillScanFinding[] {
  const findings: SkillScanFinding[] = [];

  // Content length check
  if (content.length > 10_000) {
    findings.push({
      categoryId: "SK-STR",
      categoryName: "Suspicious Structure",
      severity: "MEDIUM",
      reason: `Unusually large skill definition (${content.length.toLocaleString()} characters)`,
      remediation:
        "Large skill definitions have more surface area for hidden threats. Consider splitting into smaller, focused skills.",
    });
  }

  // Imperative instruction density
  const lines = content.split("\n").filter((l) => l.trim().length > 0);
  if (lines.length > 10) {
    const imperativePattern =
      /^\s*(?:you\s+(?:must|should|will|need\s+to)|always|never|do\s+not|ensure|make\s+sure|immediately|execute|run|create|write|read|send|post|upload|download|install|delete|remove|modify|change|update)/i;
    const imperativeCount = lines.filter((l) => imperativePattern.test(l)).length;
    const ratio = imperativeCount / lines.length;

    if (ratio > 0.3) {
      findings.push({
        categoryId: "SK-STR",
        categoryName: "Suspicious Structure",
        severity: "MEDIUM",
        reason: `High imperative instruction density (${Math.round(ratio * 100)}% of lines are directives)`,
        remediation:
          "Skills with a high density of imperative instructions may be attempting to control agent behavior beyond their stated purpose.",
      });
    }
  }

  return findings;
}

// --- Main Entry Point ---

export function scanSkillDefinition(content: string): SkillScanResult {
  const startTime = performance.now();

  const allFindings: SkillScanFinding[] = [
    ...scanHiddenContent(content),
    ...scanPromptInjection(content),
    ...scanShellExecution(content),
    ...scanDataExfiltration(content),
    ...scanEmbeddedSecrets(content),
    ...scanSensitiveFileRefs(content),
    ...scanMemoryPoisoning(content),
    ...scanSupplyChainRisk(content),
    ...scanEncodedPayloads(content),
    ...scanImageExfiltration(content),
    ...scanSystemPromptExtraction(content),
    ...scanArgumentInjection(content),
    ...scanCrossToolChaining(content),
    ...scanExcessivePermissions(content),
    ...scanSuspiciousStructure(content),
  ];

  const scanDurationMs = Math.round(performance.now() - startTime);

  // Compute summary counts
  const summary = { critical: 0, high: 0, medium: 0, low: 0 };
  let overallSeverity: ThreatLevel = "NONE";

  for (const f of allFindings) {
    if (f.severity === "CRITICAL") summary.critical++;
    else if (f.severity === "HIGH") summary.high++;
    else if (f.severity === "MEDIUM") summary.medium++;
    else if (f.severity === "LOW") summary.low++;
    overallSeverity = maxSeverity(overallSeverity, f.severity);
  }

  // Sort findings: CRITICAL first, then HIGH, MEDIUM, LOW
  allFindings.sort((a, b) => SEVERITY_ORDER[b.severity] - SEVERITY_ORDER[a.severity]);

  return {
    overallSeverity,
    findings: allFindings,
    summary,
    scannedAt: new Date().toISOString(),
    contentLength: content.length,
    scanDurationMs,
  };
}

// --- Clean Skill Definition ---

function collectRanges(content: string, pattern: RegExp): { start: number; end: number }[] {
  const ranges: { start: number; end: number }[] = [];
  const flags = pattern.flags.includes("g") ? pattern.flags : pattern.flags + "g";
  const re = new RegExp(pattern.source, flags);
  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) !== null) {
    ranges.push({ start: m.index, end: m.index + m[0].length });
    if (m[0].length === 0) break; // prevent infinite loop on zero-length match
  }
  return ranges;
}

export function cleanSkillDefinition(content: string): SkillCleanResult {
  const ranges: { start: number; end: number }[] = [];

  // Gather from all ScanPattern[] arrays
  const allScanPatterns = [
    ...HIDDEN_CONTENT_PATTERNS,
    ...PROMPT_INJECTION_PATTERNS,
    ...SHELL_EXECUTION_PATTERNS,
    ...DATA_EXFILTRATION_PATTERNS,
    ...MEMORY_POISONING_PATTERNS,
    ...SUPPLY_CHAIN_PATTERNS,
    ...ENCODED_PAYLOAD_PATTERNS,
    ...IMAGE_EXFIL_PATTERNS,
    ...SYSTEM_PROMPT_EXTRACTION_PATTERNS,
    ...ARGUMENT_INJECTION_PATTERNS,
    ...CROSS_TOOL_PATTERNS,
    ...EXCESSIVE_PERMISSION_PATTERNS,
  ];

  for (const { pattern } of allScanPatterns) {
    ranges.push(...collectRanges(content, pattern));
  }

  // Gather from EXFILTRATION_URLS
  for (const { pattern } of EXFILTRATION_URLS) {
    ranges.push(...collectRanges(content, pattern));
  }

  // Gather from SENSITIVE_PATH_RULES
  for (const { pattern } of SENSITIVE_PATH_RULES) {
    ranges.push(...collectRanges(content, pattern));
  }

  // Gather from SECRET_PATTERNS
  for (const { pattern } of SECRET_PATTERNS) {
    ranges.push(...collectRanges(content, pattern));
  }

  if (ranges.length === 0) return { cleanedContent: content, removedCount: 0 };

  // Sort by start position, merge overlapping/adjacent ranges
  ranges.sort((a, b) => a.start - b.start);
  const merged = [{ ...ranges[0] }];
  for (let i = 1; i < ranges.length; i++) {
    const last = merged[merged.length - 1];
    if (ranges[i].start <= last.end) {
      last.end = Math.max(last.end, ranges[i].end);
    } else {
      merged.push({ ...ranges[i] });
    }
  }

  // Remove ranges from end to start to preserve earlier indices
  let cleaned = content;
  for (let i = merged.length - 1; i >= 0; i--) {
    cleaned = cleaned.slice(0, merged[i].start) + cleaned.slice(merged[i].end);
  }

  // Collapse 3+ consecutive blank lines to 2, trim
  cleaned = cleaned.replace(/\n{3,}/g, "\n\n").trim() + "\n";

  return { cleanedContent: cleaned, removedCount: ranges.length };
}
