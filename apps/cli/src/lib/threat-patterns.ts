// Threat pattern library — all regex patterns organized by threat category
// Used by threat-classifier.ts to classify activity content

import type { ThreatLevel } from "@safeclaw/shared";

// --- TC-INJ: Prompt Injection Patterns ---

export const PROMPT_INJECTION_STRONG: RegExp[] = [
  /\b(?:ignore|disregard|forget|override)\s+(?:all\s+)?(?:previous|prior|above|your)\s+(?:instructions?|rules?|prompts?|guidelines?|constraints?)/i,
  /\b(?:you\s+(?:are|must|should|will)\s+(?:now|henceforth|from\s+now)\s+(?:be|act|behave|respond)\s+(?:as|like))/i,
  /\bsystem\s*prompt\b/i,
  /\bnew\s+instructions?\s*:/i,
  /\b(?:execute|run|perform)\s+(?:the\s+following|these)\s+(?:commands?|actions?|steps?)\s*:/i,
  /<!--\s*(?:hidden|invisible|system)\s*(?:instruction|prompt|directive)/i,
  /\[INST\]|\[\/INST\]|<\|im_start\|>|<\|im_end\|>/,
  /\bdo\s+not\s+(?:follow|obey|listen\s+to)\s+(?:the|your|any)\s+(?:original|previous|prior)/i,
];

export const PROMPT_INJECTION_WEAK: RegExp[] = [
  /\b(?:as\s+an?\s+(?:AI|assistant|language\s+model|LLM|agent))/i,
  /\b(?:your\s+(?:task|job|role|purpose)\s+is\s+(?:to|now))/i,
  /\b(?:pretend|imagine|suppose)\s+(?:you\s+are|that\s+you)/i,
  /\b(?:do\s+not|don'?t)\s+(?:tell|reveal|share|disclose|mention)\s+(?:the|this|any)/i,
  /\bact\s+as\s+(?:a|an|if)\b/i,
];

// --- TC-DES: Destructive Operation Patterns ---

export const DESTRUCTIVE_CRITICAL: Array<{ pattern: RegExp; label: string }> = [
  {
    pattern: /rm\s+(-[a-z]*r[a-z]*f|--recursive\s+--force|-[a-z]*f[a-z]*r)\s+\/(?:\s|$)/,
    label: "rm -rf /",
  },
  { pattern: /mkfs\./, label: "filesystem format" },
  { pattern: /dd\s+if=\/dev/, label: "raw disk write (dd)" },
  { pattern: /:\(\)\s*\{\s*:\|:\s*&\s*\}\s*;/, label: "fork bomb" },
  { pattern: /chmod\s+777\s+\/(?:\s|$)/, label: "chmod 777 /" },
  { pattern: />\s*\/dev\/sd[a-z]/, label: "overwrite disk device" },
];

export const DESTRUCTIVE_HIGH: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /rm\s+-[a-z]*r[a-z]*f?\b/, label: "recursive delete (rm -rf)" },
  { pattern: /DROP\s+(?:TABLE|DATABASE|SCHEMA)\b/i, label: "SQL DROP" },
  { pattern: /TRUNCATE\s+TABLE\b/i, label: "SQL TRUNCATE" },
  { pattern: /DELETE\s+FROM\s+\w+\s*(?:;|$)/i, label: "SQL DELETE without WHERE" },
  { pattern: /git\s+push\s+.*--force/, label: "git force push" },
  { pattern: /git\s+reset\s+--hard/, label: "git hard reset" },
];

// --- TC-ESC: Privilege Escalation Patterns ---

export const PRIVILEGE_CRITICAL: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /sudo\s+.*(?:rm|dd|mkfs|chmod\s+777)/, label: "sudo + destructive command" },
];

export const PRIVILEGE_HIGH: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /\bsudo\b/, label: "sudo" },
  { pattern: /\busermod\b/, label: "usermod" },
  { pattern: /\buseradd\b/, label: "useradd" },
  { pattern: /\bpasswd\b/, label: "passwd" },
  { pattern: /\bsu\s+-?\s*\w/, label: "su (switch user)" },
  { pattern: /chmod\s+[0-7]{3,4}\s+\/(?:etc|usr|sys|boot)/, label: "chmod on system path" },
  { pattern: /chown\s+\w+[:\s]\w*\s+\/(?:etc|usr|sys|boot)/, label: "chown on system path" },
];

export const PRIVILEGE_MEDIUM: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /\bchmod\b/, label: "chmod" },
  { pattern: /\bchown\b/, label: "chown" },
];

// --- TC-SUP: Supply Chain Patterns ---

export const SUPPLY_CHAIN_HIGH: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /npm\s+install\s+(?:-g\s+)?\S+(?:\s|$)/, label: "npm install package" },
  { pattern: /pip\s+install\s+(?!-r\s+requirements)\S+/, label: "pip install package" },
  { pattern: /gem\s+install\s+/, label: "gem install" },
  { pattern: /cargo\s+install\s+/, label: "cargo install" },
  { pattern: /go\s+install\s+/, label: "go install" },
  {
    pattern: /(?:curl|wget)\s+.*\|\s*(?:sh|bash|zsh|node|python)/,
    label: "download and execute script",
  },
  { pattern: /npx\s+(?!safeclaw)\S+/, label: "npx execute remote package" },
];

export const SUPPLY_CHAIN_MEDIUM: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /npm\s+install\b/, label: "npm install" },
  { pattern: /pip\s+install\s+-r/, label: "pip install from requirements" },
  { pattern: /brew\s+install\s+/, label: "brew install" },
  { pattern: /apt(?:-get)?\s+install\s+/, label: "apt install" },
  { pattern: /yum\s+install\s+/, label: "yum install" },
];

// --- TC-NET: Network Activity Patterns ---

export const EXFILTRATION_URLS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /pastebin\.com/, label: "pastebin.com" },
  { pattern: /paste\.ee/, label: "paste.ee" },
  { pattern: /transfer\.sh/, label: "transfer.sh" },
  { pattern: /ngrok\.io/, label: "ngrok.io" },
  { pattern: /requestbin/, label: "requestbin" },
  { pattern: /webhook\.site/, label: "webhook.site" },
  { pattern: /pipedream\.net/, label: "pipedream.net" },
  { pattern: /hookbin\.com/, label: "hookbin.com" },
  { pattern: /beeceptor\.com/, label: "beeceptor.com" },
  { pattern: /postb\.in/, label: "postb.in" },
];

export const NETWORK_COMMAND_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /curl\s+.*-X\s*POST\b/i, label: "curl POST" },
  { pattern: /curl\s+.*(?:--data|-d)\s+/i, label: "curl with data" },
  { pattern: /wget\s+.*--post-data/i, label: "wget POST" },
  { pattern: /nc\s+-.*\d+\.\d+\.\d+\.\d+/, label: "netcat to IP" },
  { pattern: /\bssh\s+.*@/, label: "SSH connection" },
  { pattern: /\bscp\s+/, label: "SCP file transfer" },
];

export const RAW_IP_URL = /^https?:\/\/\d+\.\d+\.\d+\.\d+/;

// --- TC-EXF: Data Exfiltration Code Patterns ---

export const CODE_EXFILTRATION_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  {
    pattern: /(?:fetch|axios|http|request)\s*\(.*process\.env/s,
    label: "HTTP request with env vars",
  },
  {
    pattern: /(?:fetch|axios|http|request)\s*\(.*(?:readFileSync|readFile)/s,
    label: "HTTP request with file content",
  },
  {
    pattern: /(?:Buffer|btoa|atob).*(?:fetch|http|request|send)/s,
    label: "encoded data in HTTP request",
  },
];

export const OBFUSCATION_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  {
    pattern: /eval\s*\(\s*(?:atob|Buffer\.from|decodeURIComponent)\s*\(/,
    label: "eval with decoded content",
  },
  { pattern: /(?:String\.fromCharCode|\\x[0-9a-f]{2}){5,}/i, label: "character code obfuscation" },
  { pattern: /new\s+Function\s*\(\s*['"`].*['"`]\s*\)/, label: "dynamic Function constructor" },
];

// --- TC-SFA: Sensitive File Access Patterns ---

export interface SensitivePathRule {
  pattern: RegExp;
  label: string;
  readSeverity: ThreatLevel;
  writeSeverity: ThreatLevel;
}

export const SENSITIVE_PATH_RULES: SensitivePathRule[] = [
  // Auth files — write is CRITICAL, read is HIGH
  {
    pattern: /\/etc\/passwd$/,
    label: "/etc/passwd",
    readSeverity: "HIGH",
    writeSeverity: "CRITICAL",
  },
  {
    pattern: /\/etc\/shadow$/,
    label: "/etc/shadow",
    readSeverity: "HIGH",
    writeSeverity: "CRITICAL",
  },
  {
    pattern: /\/etc\/sudoers/,
    label: "/etc/sudoers",
    readSeverity: "HIGH",
    writeSeverity: "CRITICAL",
  },
  {
    pattern: /\.ssh\/authorized_keys$/,
    label: ".ssh/authorized_keys",
    readSeverity: "HIGH",
    writeSeverity: "CRITICAL",
  },

  // Credential directories
  { pattern: /\.ssh\//, label: ".ssh directory", readSeverity: "HIGH", writeSeverity: "HIGH" },
  { pattern: /\.aws\//, label: ".aws directory", readSeverity: "HIGH", writeSeverity: "HIGH" },
  { pattern: /\.gnupg\//, label: ".gnupg directory", readSeverity: "HIGH", writeSeverity: "HIGH" },
  {
    pattern: /\.gcloud\//,
    label: ".gcloud directory",
    readSeverity: "HIGH",
    writeSeverity: "HIGH",
  },

  // Credential files
  { pattern: /\.env$/, label: ".env file", readSeverity: "HIGH", writeSeverity: "CRITICAL" },
  { pattern: /\.env\.\w+$/, label: ".env.* file", readSeverity: "HIGH", writeSeverity: "HIGH" },
  {
    pattern: /\.(pem|key|p12|pfx)$/i,
    label: "key/certificate file",
    readSeverity: "HIGH",
    writeSeverity: "CRITICAL",
  },
  {
    pattern: /id_rsa$|id_ed25519$|id_ecdsa$/,
    label: "SSH private key",
    readSeverity: "HIGH",
    writeSeverity: "CRITICAL",
  },
  { pattern: /\.keychain$/, label: "keychain file", readSeverity: "HIGH", writeSeverity: "HIGH" },
  {
    pattern: /\.(pass|secret|token)$/i,
    label: "credentials file",
    readSeverity: "HIGH",
    writeSeverity: "HIGH",
  },
];

// --- TC-SYS: System Modification Patterns ---

export interface SystemPathRule {
  pattern: RegExp;
  label: string;
  severity: ThreatLevel;
}

export const SYSTEM_PATH_RULES: SystemPathRule[] = [
  // Critical system paths (write only — reads are TC-SFA)
  { pattern: /^\/etc\//, label: "/etc/ system config", severity: "HIGH" },
  { pattern: /^\/usr\/bin\//, label: "/usr/bin/ system binaries", severity: "HIGH" },
  { pattern: /^\/usr\/sbin\//, label: "/usr/sbin/ system admin binaries", severity: "HIGH" },
  { pattern: /^\/usr\/local\/bin\//, label: "/usr/local/bin/ local binaries", severity: "HIGH" },
  { pattern: /^\/boot\//, label: "/boot/ boot configuration", severity: "CRITICAL" },
  { pattern: /^\/System\//, label: "/System/ macOS system", severity: "CRITICAL" },
  { pattern: /^\/Library\/Launch/, label: "macOS LaunchDaemons/Agents", severity: "CRITICAL" },

  // Config files
  { pattern: /\/\.bashrc$|\/\.bash_profile$/, label: ".bashrc/.bash_profile", severity: "MEDIUM" },
  { pattern: /\/\.zshrc$|\/\.zprofile$/, label: ".zshrc/.zprofile", severity: "MEDIUM" },
  { pattern: /\/\.npmrc$/, label: ".npmrc", severity: "MEDIUM" },
  { pattern: /\/\.gitconfig$/, label: ".gitconfig", severity: "MEDIUM" },
];

// --- TC-SUP: Dependency File Patterns ---

export const DEPENDENCY_FILES: RegExp[] = [
  /package\.json$/,
  /requirements\.txt$/,
  /Gemfile$/,
  /go\.mod$/,
  /Cargo\.toml$/,
  /pom\.xml$/,
  /build\.gradle$/,
  /pyproject\.toml$/,
  /composer\.json$/,
];

export const BUILD_CI_FILES: RegExp[] = [
  /\.github\/workflows\//,
  /\.gitlab-ci\.yml$/,
  /Jenkinsfile$/,
  /Makefile$/,
  /Dockerfile$/,
  /docker-compose\.ya?ml$/,
  /\.circleci\//,
];
