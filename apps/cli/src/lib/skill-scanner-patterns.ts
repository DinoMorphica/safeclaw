// Skill Scanner pattern library — regex patterns for 15 SK-* scan categories
// Used by skill-scanner.ts to analyze static markdown skill definitions

import type { ThreatLevel } from "@safeclaw/shared";

export interface ScanPattern {
  pattern: RegExp;
  label: string;
  severity: ThreatLevel;
}

// --- SK-HID: Hidden Content ---

export const HIDDEN_CONTENT_PATTERNS: ScanPattern[] = [
  // HTML comments with instructional content
  { pattern: /<!--[\s\S]*?(?:instruction|command|execute|ignore|override|system|prompt|inject|do not|must|should|always|never)[\s\S]*?-->/i, label: "HTML comment with instructions", severity: "CRITICAL" },
  { pattern: /<!--[\s\S]{50,}?-->/s, label: "Large HTML comment (>50 chars)", severity: "HIGH" },
  // Zero-width Unicode characters
  { pattern: /[\u200B\u200C\u200D\u200E\u200F]/, label: "Zero-width Unicode character (U+200B-200F)", severity: "CRITICAL" },
  { pattern: /[\u2060\u2061\u2062\u2063\u2064]/, label: "Invisible Unicode separator (U+2060-2064)", severity: "CRITICAL" },
  { pattern: /[\uFEFF]/, label: "Zero-width no-break space (BOM)", severity: "HIGH" },
  // CSS hiding
  { pattern: /display\s*:\s*none/i, label: "CSS display:none", severity: "HIGH" },
  { pattern: /opacity\s*:\s*0(?:[;\s]|$)/i, label: "CSS opacity:0", severity: "HIGH" },
  { pattern: /visibility\s*:\s*hidden/i, label: "CSS visibility:hidden", severity: "HIGH" },
  // Bidi overrides
  { pattern: /[\u202A\u202B\u202C\u202D\u202E]/, label: "Bidi override character", severity: "CRITICAL" },
  { pattern: /[\u2066\u2067\u2068\u2069]/, label: "Bidi isolate character", severity: "CRITICAL" },
];

// --- SK-INJ: Prompt Injection ---

export const PROMPT_INJECTION_PATTERNS: ScanPattern[] = [
  { pattern: /\b(?:ignore|disregard|forget|override)\s+(?:all\s+)?(?:previous|prior|above|your)\s+(?:instructions?|rules?|prompts?|guidelines?|constraints?)/i, label: "Override previous instructions", severity: "CRITICAL" },
  { pattern: /\b(?:you\s+(?:are|must|should|will)\s+(?:now|henceforth|from\s+now)\s+(?:be|act|behave|respond)\s+(?:as|like))/i, label: "Role reassignment", severity: "CRITICAL" },
  { pattern: /\bnew\s+instructions?\s*:/i, label: "New instructions directive", severity: "CRITICAL" },
  { pattern: /\[INST\]|\[\/INST\]|<\|im_start\|>|<\|im_end\|>/i, label: "Special model tokens", severity: "CRITICAL" },
  { pattern: /\bsystem\s*prompt\s*(?:override|injection|:)/i, label: "System prompt manipulation", severity: "CRITICAL" },
  { pattern: /\bdo\s+not\s+(?:follow|obey|listen\s+to)\s+(?:the|your|any)\s+(?:original|previous|prior)/i, label: "Instruction disobedience", severity: "CRITICAL" },
  { pattern: /\b(?:IMPORTANT|CRITICAL|URGENT)\s*:\s*(?:ignore|override|disregard|you must)/i, label: "Urgent override phrasing", severity: "HIGH" },
  { pattern: /\b(?:pretend|imagine|suppose)\s+(?:you\s+are|that\s+you)/i, label: "Persona manipulation", severity: "MEDIUM" },
  { pattern: /\bact\s+as\s+(?:a|an|if)\b/i, label: "Act-as directive", severity: "MEDIUM" },
];

// --- SK-EXE: Shell Execution ---

export const SHELL_EXECUTION_PATTERNS: ScanPattern[] = [
  { pattern: /(?:curl|wget)\s+[^\n]*\|\s*(?:sh|bash|zsh|node|python)/i, label: "Download and execute (curl|bash)", severity: "CRITICAL" },
  { pattern: /\beval\s*\(/, label: "eval() call", severity: "CRITICAL" },
  { pattern: /\bexec\s*\(/, label: "exec() call", severity: "HIGH" },
  { pattern: /\bnpx\s+-y\s+/, label: "npx -y (auto-confirm remote package)", severity: "HIGH" },
  { pattern: /\/dev\/tcp\//, label: "Reverse shell via /dev/tcp", severity: "CRITICAL" },
  { pattern: /\bnc\s+.*-e\s+/, label: "Netcat with exec (nc -e)", severity: "CRITICAL" },
  { pattern: /\bmkfifo\b.*\bnc\b/s, label: "Named pipe + netcat (reverse shell)", severity: "CRITICAL" },
  { pattern: /python[23]?\s+-c\s+.*(?:socket|subprocess|os\.system)/i, label: "Python one-liner with system access", severity: "CRITICAL" },
  { pattern: /\bphp\s+-r\s+.*(?:exec|system|passthru|shell_exec)/i, label: "PHP exec one-liner", severity: "CRITICAL" },
  { pattern: /\bperl\s+-e\s+.*(?:socket|exec|system)/i, label: "Perl exec one-liner", severity: "CRITICAL" },
  { pattern: /\bruby\s+-e\s+.*(?:exec|system|spawn)/i, label: "Ruby exec one-liner", severity: "CRITICAL" },
  { pattern: /\bchmod\s+\+x\b/, label: "Make file executable", severity: "MEDIUM" },
];

// --- SK-EXF: Data Exfiltration ---

export const DATA_EXFILTRATION_PATTERNS: ScanPattern[] = [
  { pattern: /pastebin\.com/, label: "pastebin.com", severity: "HIGH" },
  { pattern: /paste\.ee/, label: "paste.ee", severity: "HIGH" },
  { pattern: /transfer\.sh/, label: "transfer.sh", severity: "HIGH" },
  { pattern: /ngrok\.io/, label: "ngrok.io", severity: "HIGH" },
  { pattern: /requestbin/i, label: "requestbin", severity: "HIGH" },
  { pattern: /webhook\.site/, label: "webhook.site", severity: "HIGH" },
  { pattern: /pipedream\.net/, label: "pipedream.net", severity: "HIGH" },
  { pattern: /hookbin\.com/, label: "hookbin.com", severity: "HIGH" },
  { pattern: /beeceptor\.com/, label: "beeceptor.com", severity: "HIGH" },
  { pattern: /postb\.in/, label: "postb.in", severity: "HIGH" },
  { pattern: /https?:\/\/hooks\.slack\.com\/services\//, label: "Slack webhook URL", severity: "HIGH" },
  { pattern: /https?:\/\/discord(?:app)?\.com\/api\/webhooks\//, label: "Discord webhook URL", severity: "HIGH" },
  { pattern: /https?:\/\/api\.telegram\.org\/bot/, label: "Telegram bot API URL", severity: "HIGH" },
  { pattern: /https?:\/\/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/, label: "Raw IP URL", severity: "HIGH" },
];

// --- SK-MEM: Memory/Config Poisoning ---

export const MEMORY_POISONING_PATTERNS: ScanPattern[] = [
  { pattern: /\bSOUL\.md\b/, label: "SOUL.md reference", severity: "CRITICAL" },
  { pattern: /\bMEMORY\.md\b/, label: "MEMORY.md reference", severity: "CRITICAL" },
  { pattern: /\.claude\//, label: ".claude/ directory reference", severity: "CRITICAL" },
  { pattern: /\bCLAUDE\.md\b/, label: "CLAUDE.md reference", severity: "CRITICAL" },
  { pattern: /\.cursorrules\b/, label: ".cursorrules reference", severity: "CRITICAL" },
  { pattern: /\.windsurfrules\b/, label: ".windsurfrules reference", severity: "CRITICAL" },
  { pattern: /\.clinerules\b/, label: ".clinerules reference", severity: "HIGH" },
  { pattern: /\bCODEX\.md\b/, label: "CODEX.md reference", severity: "HIGH" },
  { pattern: /(?:write|modify|edit|append|create|overwrite)\s+(?:to\s+)?(?:the\s+)?(?:SOUL|MEMORY|CLAUDE|CODEX)\.md/i, label: "Instruction to modify agent config file", severity: "CRITICAL" },
  { pattern: /(?:write|modify|edit|append|create|overwrite)\s+(?:to\s+)?(?:the\s+)?\.(?:cursorrules|windsurfrules|clinerules)/i, label: "Instruction to modify IDE rules file", severity: "CRITICAL" },
];

// --- SK-SUP: Supply Chain Risk ---

export const SUPPLY_CHAIN_PATTERNS: ScanPattern[] = [
  { pattern: /https?:\/\/raw\.githubusercontent\.com\/[^\s]+\.(?:sh|py|js|rb|pl)\b/, label: "Raw GitHub script URL", severity: "HIGH" },
  { pattern: /https?:\/\/[^\s]+\.(?:sh|py|js|rb|pl)(?:\s|$)/, label: "External script URL", severity: "HIGH" },
  { pattern: /\bnpm\s+install\s+(?:-g\s+)?[a-zA-Z@]/, label: "npm install command", severity: "HIGH" },
  { pattern: /\bpip\s+install\s+[a-zA-Z]/, label: "pip install command", severity: "HIGH" },
  { pattern: /\bgem\s+install\s+/, label: "gem install command", severity: "HIGH" },
  { pattern: /\bcargo\s+install\s+/, label: "cargo install command", severity: "MEDIUM" },
  { pattern: /\bgo\s+install\s+/, label: "go install command", severity: "MEDIUM" },
  { pattern: /\bbrew\s+install\s+/, label: "brew install command", severity: "MEDIUM" },
];

// --- SK-B64: Encoded Payloads ---

export const ENCODED_PAYLOAD_PATTERNS: ScanPattern[] = [
  { pattern: /[A-Za-z0-9+/]{40,}={0,2}/, label: "Base64 string (>40 chars)", severity: "HIGH" },
  { pattern: /\batob\s*\(/, label: "atob() call (base64 decode)", severity: "HIGH" },
  { pattern: /\bbtoa\s*\(/, label: "btoa() call (base64 encode)", severity: "MEDIUM" },
  { pattern: /\bBuffer\.from\s*\([^)]*,\s*['"]base64['"]\)/, label: "Buffer.from base64", severity: "HIGH" },
  { pattern: /(?:\\x[0-9a-fA-F]{2}){8,}/, label: "Hex escape sequence (8+ bytes)", severity: "HIGH" },
  { pattern: /String\.fromCharCode\s*\((?:\s*\d+\s*,?\s*){5,}\)/, label: "String.fromCharCode (5+ codes)", severity: "HIGH" },
  { pattern: /\|\s*base64\s+(?:-d|--decode)/, label: "Piped base64 decode", severity: "CRITICAL" },
];

// --- SK-IMG: Image Exfiltration ---

export const IMAGE_EXFIL_PATTERNS: ScanPattern[] = [
  // URL-based exfiltration (original 5)
  { pattern: /!\[.*?\]\(https?:\/\/[^\s)]*(?:\?|&)(?:data|content|file|token|secret|key|password|env)=[^\s)]*\)/i, label: "Image URL with exfil query params", severity: "CRITICAL" },
  { pattern: /!\[.*?\]\(https?:\/\/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}[^\s)]*\)/, label: "Image from raw IP address", severity: "CRITICAL" },
  { pattern: /!\[.*?\]\([^)]*\$\{[^}]+\}[^)]*\)/, label: "Variable interpolation in image URL", severity: "CRITICAL" },
  { pattern: /!\[.*?\]\([^)]*\$\([^)]+\)[^)]*\)/, label: "Command substitution in image URL", severity: "CRITICAL" },
  { pattern: /<img[^>]+src\s*=\s*["'][^"']*\$\{[^}]+\}[^"']*["']/i, label: "Variable interpolation in img src", severity: "CRITICAL" },
  // Group A: Data URI image payloads
  { pattern: /!\[.*?\]\(data:image\/[^\s)]+\)/i, label: "Data URI image in markdown", severity: "CRITICAL" },
  { pattern: /<img[^>]+src\s*=\s*["']data:image\/[^"']+["']/i, label: "Data URI image in HTML img tag", severity: "CRITICAL" },
  { pattern: /data:image\/[^;]+;base64,[A-Za-z0-9+/]{200,}/, label: "Large base64 data URI (steganographic carrier)", severity: "CRITICAL" },
  // Group B: SVG embedded scripts & data
  { pattern: /<svg[\s>][\s\S]*?<script[\s>]/i, label: "SVG with embedded script tag", severity: "CRITICAL" },
  { pattern: /<svg[\s>][\s\S]*?\bon(?:load|error|click|mouseover)\s*=/i, label: "SVG with event handler", severity: "CRITICAL" },
  { pattern: /<svg[\s>][\s\S]*?<foreignObject[\s>]/i, label: "SVG with foreignObject (arbitrary HTML embed)", severity: "HIGH" },
  { pattern: /data:image\/svg\+xml[^"'\s)]+/i, label: "SVG data URI (inline payload + script risk)", severity: "CRITICAL" },
  // Group C: Web beacons / tracking pixels
  { pattern: /<img[^>]+(?:width\s*=\s*["']?1["']?[^>]+height\s*=\s*["']?1["']?|height\s*=\s*["']?1["']?[^>]+width\s*=\s*["']?1["']?)/i, label: "1x1 tracking pixel (web beacon)", severity: "HIGH" },
  { pattern: /<img[^>]+style\s*=\s*["'][^"']*(?:display\s*:\s*none|visibility\s*:\s*hidden|opacity\s*:\s*0|width\s*:\s*0|height\s*:\s*0)/i, label: "CSS-hidden image beacon", severity: "HIGH" },
  // Group D: Steganography tool references
  { pattern: /\b(?:steghide|stegano|openstego|zsteg|stegsolve|stegdetect|steganograph(?:y|ic)?|outguess|pixelknot|deepsteg|stegpy)\b/i, label: "Steganography tool/library reference", severity: "HIGH" },
  // Group E: Canvas pixel manipulation
  { pattern: /\b(?:getImageData|putImageData|createImageData|toDataURL|drawImage)\s*\(/i, label: "Canvas API pixel manipulation", severity: "HIGH" },
  // Group F: Double extension disguise
  { pattern: /\.(?:png|jpe?g|gif|bmp|webp|svg|ico|tiff?)\.(?:exe|sh|bat|cmd|ps1|py|rb|pl|js|vbs|com|scr|msi)\b/i, label: "Double file extension (executable disguised as image)", severity: "CRITICAL" },
  // Group G: Obfuscated image URLs
  { pattern: /!\[.*?\]\([^)]*(?:%[0-9a-fA-F]{2}){5,}[^)]*\)/, label: "Excessive URL encoding in image URL", severity: "MEDIUM" },
];

// --- SK-SYS: System Prompt Extraction ---

export const SYSTEM_PROMPT_EXTRACTION_PATTERNS: ScanPattern[] = [
  { pattern: /\b(?:reveal|show|print|output|display|repeat|echo)\s+(?:your\s+)?(?:system\s+)?(?:prompt|instructions|rules|guidelines)/i, label: "System prompt reveal request", severity: "HIGH" },
  { pattern: /\brepeat\s+(?:the\s+)?(?:words?|text|everything)\s+above\b/i, label: "Repeat words above", severity: "HIGH" },
  { pattern: /\bprint\s+everything\s+above\b/i, label: "Print everything above", severity: "HIGH" },
  { pattern: /\bwhat\s+(?:are|were)\s+your\s+(?:original\s+)?(?:instructions|directives|rules)\b/i, label: "Ask for original instructions", severity: "MEDIUM" },
  { pattern: /\btell\s+me\s+your\s+(?:system\s+)?prompt\b/i, label: "Ask for system prompt", severity: "HIGH" },
];

// --- SK-ARG: Argument Injection ---

export const ARGUMENT_INJECTION_PATTERNS: ScanPattern[] = [
  { pattern: /\$\([^)]+\)/, label: "Command substitution $()", severity: "CRITICAL" },
  { pattern: /\$\{[^}]+\}/, label: "Variable expansion ${}", severity: "HIGH" },
  { pattern: /`[^`]+`/, label: "Backtick command substitution", severity: "HIGH" },
  { pattern: /;\s*(?:rm|cat|curl|wget|nc|python|perl|ruby|sh|bash)\b/, label: "Shell metachar chained command", severity: "CRITICAL" },
  { pattern: /\|\s*(?:sh|bash|zsh|python|perl|ruby|node)\b/, label: "Pipe to interpreter", severity: "CRITICAL" },
  { pattern: /&&\s*(?:rm|curl|wget|nc|python|perl|ruby)\b/, label: "AND-chained dangerous command", severity: "HIGH" },
  // GTFOBINS exploitation flags
  { pattern: /\b(?:tar|zip|find|vim|less|more|man|nmap)\b.*--(?:exec|checkpoint-action|to-command)/i, label: "GTFOBINS exploitation flags", severity: "CRITICAL" },
];

// --- SK-XTL: Cross-Tool Chaining ---

export const CROSS_TOOL_PATTERNS: ScanPattern[] = [
  { pattern: /(?:read|cat|view)\s+(?:the\s+)?(?:file|content)[\s\S]{0,100}(?:send|post|upload|transmit|exfiltrate)/is, label: "Read-then-exfiltrate pattern", severity: "HIGH" },
  { pattern: /(?:first|step\s*1)[\s\S]{0,200}(?:then|step\s*2|next|after\s+that)[\s\S]{0,200}(?:then|step\s*3|finally)/is, label: "Multi-step tool invocation", severity: "HIGH" },
  { pattern: /\b(?:use_mcp_tool|call_tool|execute_tool|run_tool|invoke_tool)\b/i, label: "Direct tool reference", severity: "MEDIUM" },
  { pattern: /\b(?:read_file|write_file|execute_command|list_directory|search_files)\s*\(/i, label: "Tool function call syntax", severity: "MEDIUM" },
];

// --- SK-PRM: Excessive Permissions ---

export const EXCESSIVE_PERMISSION_PATTERNS: ScanPattern[] = [
  { pattern: /\bunrestricted\s+access\b/i, label: "Unrestricted access request", severity: "HIGH" },
  { pattern: /\bbypass\s+(?:security|restrictions?|permissions?|safeguards?|protections?|filters?)\b/i, label: "Security bypass request", severity: "HIGH" },
  { pattern: /\bno\s+restrictions?\b/i, label: "No restrictions request", severity: "HIGH" },
  { pattern: /\b(?:root|admin(?:istrator)?|superuser)\s+(?:access|privileges?|permissions?)\b/i, label: "Root/admin access request", severity: "HIGH" },
  { pattern: /\bdisable\s+(?:all\s+)?(?:safety|security|restrictions?|protections?|checks?|filters?)\b/i, label: "Disable safety request", severity: "HIGH" },
  { pattern: /\bfull\s+(?:system\s+)?(?:access|control|permissions?)\b/i, label: "Full access request", severity: "MEDIUM" },
];
