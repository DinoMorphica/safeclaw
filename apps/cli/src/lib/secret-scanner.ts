import type { ThreatLevel } from "@safeclaw/shared";

export interface SecretMatch {
  type: string;
  severity: ThreatLevel;
}

export const SECRET_PATTERNS: { pattern: RegExp; type: string; severity: ThreatLevel }[] = [
  // AWS
  { pattern: /AKIA[0-9A-Z]{16}/, type: "AWS_ACCESS_KEY", severity: "CRITICAL" },
  {
    pattern: /(?:aws_secret_access_key|AWS_SECRET_ACCESS_KEY)\s*[=:]\s*\S{20,}/,
    type: "AWS_SECRET_KEY",
    severity: "CRITICAL",
  },

  // OpenAI
  { pattern: /sk-[a-zA-Z0-9]{20,}/, type: "OPENAI_API_KEY", severity: "CRITICAL" },

  // GitHub
  { pattern: /ghp_[a-zA-Z0-9]{36}/, type: "GITHUB_TOKEN", severity: "CRITICAL" },
  { pattern: /github_pat_[a-zA-Z0-9_]{22,}/, type: "GITHUB_TOKEN", severity: "CRITICAL" },
  { pattern: /gho_[a-zA-Z0-9]{36}/, type: "GITHUB_TOKEN", severity: "CRITICAL" },

  // GitLab
  { pattern: /glpat-[a-zA-Z0-9\-_]{20,}/, type: "GITLAB_TOKEN", severity: "CRITICAL" },

  // Private keys
  {
    pattern: /-----BEGIN\s+(RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/,
    type: "PEM_PRIVATE_KEY",
    severity: "CRITICAL",
  },

  // Stripe
  { pattern: /[rs]k_(live|test)_[a-zA-Z0-9]{20,}/, type: "STRIPE_KEY", severity: "CRITICAL" },

  // SendGrid
  {
    pattern: /SG\.[a-zA-Z0-9\-_]{22,}\.[a-zA-Z0-9\-_]{22,}/,
    type: "SENDGRID_KEY",
    severity: "CRITICAL",
  },

  // Twilio
  { pattern: /SK[a-f0-9]{32}/, type: "TWILIO_KEY", severity: "CRITICAL" },

  // Slack
  { pattern: /xox[bpars]-[a-zA-Z0-9-]{10,}/, type: "SLACK_TOKEN", severity: "HIGH" },
  {
    pattern: /https:\/\/hooks\.slack\.com\/services\/T[a-zA-Z0-9_]+\/B[a-zA-Z0-9_]+\/[a-zA-Z0-9_]+/,
    type: "SLACK_WEBHOOK",
    severity: "HIGH",
  },

  // Database URLs
  {
    pattern: /(?:postgres|mysql|mongodb|redis|amqp):\/\/[^\s'"]+@[^\s'"]+/,
    type: "DATABASE_URL",
    severity: "HIGH",
  },

  // Basic auth headers
  {
    pattern: /Authorization:\s*Basic\s+[A-Za-z0-9+/=]{10,}/,
    type: "BASIC_AUTH_HEADER",
    severity: "HIGH",
  },

  // Env-style password/secret assignments
  {
    pattern:
      /(?:PASSWORD|SECRET|TOKEN|API_KEY|APIKEY|AUTH_TOKEN|ACCESS_TOKEN)\s*[=:]\s*['"]?[^\s'"]{8,}/i,
    type: "PASSWORD_IN_ENV",
    severity: "HIGH",
  },

  // JWT tokens
  {
    pattern: /eyJ[a-zA-Z0-9_-]{10,}\.eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}/,
    type: "JWT_TOKEN",
    severity: "MEDIUM",
  },

  // Generic API key patterns
  {
    pattern: /(?:api[_-]?key|apikey)\s*[=:]\s*['"]?[a-zA-Z0-9\-_]{16,}/i,
    type: "GENERIC_API_KEY",
    severity: "MEDIUM",
  },

  // Generic secret patterns
  {
    pattern: /(?:secret|private[_-]?key)\s*[=:]\s*['"]?[a-zA-Z0-9\-_]{16,}/i,
    type: "GENERIC_SECRET",
    severity: "MEDIUM",
  },
];

/**
 * Scan content for potential secrets/credentials.
 * Returns an array of unique detected secret types and the highest severity found.
 */
export function scanForSecrets(content: string): {
  types: string[];
  maxSeverity: ThreatLevel;
} {
  if (!content) return { types: [], maxSeverity: "NONE" };

  const found = new Set<string>();
  let maxSeverity: ThreatLevel = "NONE";
  const severityOrder: Record<ThreatLevel, number> = {
    NONE: 0,
    LOW: 1,
    MEDIUM: 2,
    HIGH: 3,
    CRITICAL: 4,
  };

  for (const { pattern, type, severity } of SECRET_PATTERNS) {
    if (pattern.test(content)) {
      found.add(type);
      if (severityOrder[severity] > severityOrder[maxSeverity]) {
        maxSeverity = severity;
      }
    }
  }

  return { types: Array.from(found), maxSeverity };
}
