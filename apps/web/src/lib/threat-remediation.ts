import type { ThreatCategoryId, ThreatFinding } from "@safeclaw/shared";

interface RemediationSuggestion {
  defaultAdvice: string;
  dynamicAdvice: (evidence?: string) => string | null;
}

const REMEDIATION_MAP: Record<ThreatCategoryId, RemediationSuggestion> = {
  "TC-SEC": {
    defaultAdvice:
      "Rotate exposed keys/tokens immediately. Check git history for accidental commits.",
    dynamicAdvice: (evidence) =>
      evidence ? `Detected credential: ${evidence}` : null,
  },
  "TC-EXF": {
    defaultAdvice:
      "Block the exfiltration target URL. Review data access patterns.",
    dynamicAdvice: (evidence) =>
      evidence ? `Exfiltration target: ${evidence}` : null,
  },
  "TC-INJ": {
    defaultAdvice:
      "Quarantine the content source. Do not act on injected instructions.",
    dynamicAdvice: (evidence) =>
      evidence ? `Injection source: ${evidence}` : null,
  },
  "TC-DES": {
    defaultAdvice:
      "Prevent execution. Verify the agent's intent before allowing destructive operations.",
    dynamicAdvice: (evidence) =>
      evidence ? `Destructive command: ${evidence}` : null,
  },
  "TC-ESC": {
    defaultAdvice:
      "Deny privilege escalation. Review why elevated permissions were requested.",
    dynamicAdvice: (evidence) =>
      evidence ? `Escalation via: ${evidence}` : null,
  },
  "TC-SUP": {
    defaultAdvice:
      "Verify package integrity. Check for known vulnerabilities before installing.",
    dynamicAdvice: (evidence) =>
      evidence ? `Package involved: ${evidence}` : null,
  },
  "TC-SFA": {
    defaultAdvice:
      "Restrict access to sensitive files. Consider using read-only permissions.",
    dynamicAdvice: (evidence) =>
      evidence ? `Sensitive file: ${evidence}` : null,
  },
  "TC-SYS": {
    defaultAdvice: "Block system modifications. Review changes before applying.",
    dynamicAdvice: (evidence) =>
      evidence ? `System target: ${evidence}` : null,
  },
  "TC-NET": {
    defaultAdvice: "Inspect network traffic. Block suspicious connections.",
    dynamicAdvice: (evidence) =>
      evidence ? `Network target: ${evidence}` : null,
  },
  "TC-MCP": {
    defaultAdvice:
      "Isolate the MCP tool. Verify tool responses are not poisoned.",
    dynamicAdvice: (evidence) =>
      evidence ? `Affected tool: ${evidence}` : null,
  },
};

export function getRemediation(finding: ThreatFinding): {
  defaultAdvice: string;
  contextAdvice: string | null;
} {
  const remed = REMEDIATION_MAP[finding.categoryId];
  return {
    defaultAdvice: remed.defaultAdvice,
    contextAdvice: remed.dynamicAdvice(finding.evidence),
  };
}
