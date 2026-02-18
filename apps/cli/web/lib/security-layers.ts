export interface SecurityLayerMeta {
  name: string;
  description: string;
  icon: string;
  actionPath: string;
  actionLabel: string;
  owaspRefs: string[];
  guidance: string;
}

export const SECURITY_LAYER_META: Record<string, SecurityLayerMeta> = {
  sandbox: {
    name: "Sandbox Isolation",
    description: "Run the agent in an isolated environment with filesystem and network boundaries",
    icon: "Box",
    actionPath: "/access#sandbox",
    actionLabel: "Configure in Access Control",
    owaspRefs: ["ASI05"],
    guidance:
      "Anthropic recommends dual-boundary isolation: an inner sandbox (container) restricting OS access, and an outer boundary limiting network egress. Set sandbox mode to 'all' with read-only workspace access for maximum protection.",
  },
  filesystem: {
    name: "Filesystem Access",
    description: "Control which files and directories the agent can read and write",
    icon: "FolderLock",
    actionPath: "/access",
    actionLabel: "Configure in Access Control",
    owaspRefs: ["ASI03"],
    guidance:
      "Restrict filesystem access to the project workspace only. Use read-only workspace mode when the agent doesn't need to write files. Disable the filesystem tool group entirely for analysis-only sessions.",
  },
  network: {
    name: "Network & Egress Control",
    description: "Prevent unauthorized data exfiltration and outbound connections",
    icon: "Globe",
    actionPath: "/access",
    actionLabel: "Configure in Access Control",
    owaspRefs: ["ASI01"],
    guidance:
      "Disable network access when not required. Use Docker network isolation to prevent the agent from making arbitrary connections. Browser access adds additional attack surface — disable unless needed.",
  },
  exec: {
    name: "Command Execution Controls",
    description: "Restrict which shell commands the agent can execute on the host system",
    icon: "Terminal",
    actionPath: "/interception",
    actionLabel: "Configure in Command Interception",
    owaspRefs: ["ASI02", "ASI05"],
    guidance:
      "Use 'deny' or 'allowlist' exec security mode. Add critical patterns (sudo, rm -rf, chmod, curl|bash) to the blocklist. The exec approval system intercepts matching commands for human review before execution.",
  },
  mcp: {
    name: "MCP Server Security",
    description: "Control which MCP servers and tools the agent can access",
    icon: "Plug",
    actionPath: "/access",
    actionLabel: "Configure in Access Control",
    owaspRefs: ["ASI04", "ASI07"],
    guidance:
      "Review each MCP server individually — only enable servers you trust. Use tools.deny entries to block specific MCP tools. MCP tool poisoning (injecting malicious instructions via tool responses) is a known attack vector.",
  },
  "egress-proxy": {
    name: "Egress Proxy & Domain Filtering",
    description:
      "Control outbound traffic through Sandbox Runtime (srt) domain filtering or proxy environment variables",
    icon: "Shield",
    actionPath: "/access#egress",
    actionLabel: "Configure in Access Control",
    owaspRefs: ["ASI01"],
    guidance:
      "Anthropic recommends using Sandbox Runtime (srt) to enforce network domain allowlists. Enable srt in Access Control and add allowed domains — all other network access is denied by default. Alternatively, set HTTP_PROXY/HTTPS_PROXY environment variables. Launch your agent with `srt openclaw start` to enforce filtering.",
  },
  gateway: {
    name: "Gateway & Inbound Security",
    description:
      "Secure inbound access to the agent gateway with authentication and binding controls",
    icon: "DoorOpen",
    actionPath: "/openclaw",
    actionLabel: "Configure in OpenClaw",
    owaspRefs: ["ASI03", "ASI07"],
    guidance:
      "The OpenClaw gateway accepts WebSocket connections and external channel triggers. Ensure device identity is configured for Ed25519 authentication, gateway is bound to localhost (not 0.0.0.0), and external channels like WhatsApp restrict which senders can trigger agent actions.",
  },
  secrets: {
    name: "Secret & Credential Protection",
    description: "Detect and prevent credential exposure in agent activities",
    icon: "KeyRound",
    actionPath: "/threats",
    actionLabel: "Review in Threat Center",
    owaspRefs: ["ASI03"],
    guidance:
      "The built-in secret scanner detects 15+ credential types (AWS keys, API tokens, PEM keys, database URLs). Resolve flagged threats promptly to prevent credential leakage. Never expose .env files or credential stores to the agent.",
  },
  "supply-chain": {
    name: "Supply Chain Protection",
    description:
      "Prevent compromised packages, malicious MCP servers, and untrusted tool installations",
    icon: "PackageCheck",
    actionPath: "/interception",
    actionLabel: "Configure in Command Interception",
    owaspRefs: ["ASI04"],
    guidance:
      "AI agent CLI tools are active targets for supply chain attacks. Add restricted patterns for package manager commands (npm install, pip install, curl|bash). Use 'deny' or 'allowlist' exec security mode. Review MCP servers individually — the first malicious MCP server was discovered on npm in 2025.",
  },
  "input-output": {
    name: "Input/Output Validation",
    description:
      "Detect prompt injection, MCP tool poisoning, and adversarial content in agent inputs and outputs",
    icon: "ScanLine",
    actionPath: "/threats",
    actionLabel: "Review in Threat Center",
    owaspRefs: ["ASI01", "ASI06"],
    guidance:
      "The agent processes untrusted content from files, web pages, and MCP tool responses — any can contain adversarial instructions. The built-in threat classifier detects prompt injection (TC-INJ) and MCP tool poisoning (TC-MCP). Resolve flagged threats promptly. Use the Skill Scanner to audit MCP server definitions before enabling them.",
  },
  monitoring: {
    name: "Threat Monitoring",
    description:
      "Active connection to OpenClaw for real-time activity monitoring and threat detection",
    icon: "Eye",
    actionPath: "/sessions",
    actionLabel: "View in Session Monitor",
    owaspRefs: ["ASI10"],
    guidance:
      "Keep the OpenClaw connection active for real-time monitoring. Every agent invocation should be treated as high-risk. Regularly review and resolve detected threats to maintain visibility.",
  },
  "human-in-loop": {
    name: "Human-in-the-Loop Controls",
    description: "Ensure critical operations require human approval before execution",
    icon: "UserCheck",
    actionPath: "/interception",
    actionLabel: "Configure in Command Interception",
    owaspRefs: ["ASI09"],
    guidance:
      "The exec approval system intercepts commands matching restricted patterns. Add patterns for dangerous operations. Monitor the timeout rate — if approvals frequently time out, consider adjusting your workflow or timeout settings.",
  },
};
