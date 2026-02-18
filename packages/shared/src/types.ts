// --- Enums ---
export type CommandStatus = "ALLOWED" | "BLOCKED" | "PENDING";
export type ThreatLevel = "NONE" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type SessionStatus = "ACTIVE" | "ENDED";

// --- Activity monitoring types ---
export type ActivityType =
  | "file_read"
  | "file_write"
  | "shell_command"
  | "web_browse"
  | "tool_call"
  | "message"
  | "unknown";

// --- Secret detection types ---
export type SecretType =
  | "AWS_ACCESS_KEY"
  | "AWS_SECRET_KEY"
  | "OPENAI_API_KEY"
  | "GITHUB_TOKEN"
  | "GITLAB_TOKEN"
  | "SLACK_TOKEN"
  | "SLACK_WEBHOOK"
  | "PEM_PRIVATE_KEY"
  | "STRIPE_KEY"
  | "SENDGRID_KEY"
  | "TWILIO_KEY"
  | "JWT_TOKEN"
  | "DATABASE_URL"
  | "BASIC_AUTH_HEADER"
  | "PASSWORD_IN_ENV"
  | "GENERIC_API_KEY"
  | "GENERIC_SECRET";

export type OpenClawConnectionStatus =
  | "connected"
  | "disconnected"
  | "connecting"
  | "not_configured";

// --- Threat classification types ---
export type ThreatCategoryId =
  | "TC-SEC" // Secret Exposure
  | "TC-EXF" // Data Exfiltration
  | "TC-INJ" // Prompt Injection Risk
  | "TC-DES" // Destructive Operation
  | "TC-ESC" // Privilege Escalation
  | "TC-SUP" // Supply Chain Risk
  | "TC-SFA" // Sensitive File Access
  | "TC-SYS" // System Modification
  | "TC-NET" // Suspicious Network Activity
  | "TC-MCP"; // MCP/Tool Poisoning

export interface ThreatFinding {
  categoryId: ThreatCategoryId;
  categoryName: string;
  severity: ThreatLevel;
  reason: string;
  evidence?: string;
  owaspRef?: string;
}

// --- Database row types ---
export interface CommandLog {
  id: number;
  command: string;
  status: CommandStatus;
  threatLevel: ThreatLevel;
  timestamp: string;
  sessionId: string | null;
  decisionBy: string | null;
}

export interface Session {
  id: string;
  startedAt: string;
  endedAt: string | null;
  status: SessionStatus;
}

export interface AccessConfigEntry {
  id: number;
  category: string;
  key: string;
  value: string;
  updatedAt: string;
}

export interface AgentActivity {
  id: number;
  openclawSessionId: string;
  activityType: ActivityType;
  detail: string;
  rawPayload: string;
  threatLevel: ThreatLevel;
  timestamp: string;
  toolName: string | null;
  targetPath: string | null;
  runId: string | null;
  contentPreview: string | null;
  readContentPreview: string | null;
  secretsDetected: string[] | null;
  threatFindings: ThreatFinding[] | null;
  resolved: boolean;
  resolvedAt: string | null;
}

export interface OpenClawSession {
  id: string;
  startedAt: string;
  endedAt: string | null;
  status: SessionStatus;
  model: string | null;
  activityCount: number;
  threatSummary: Record<ThreatLevel, number>;
}

export interface OpenClawMonitorStatus {
  connectionStatus: OpenClawConnectionStatus;
  gatewayPort: number | null;
  lastEventAt: string | null;
  activeSessionCount: number;
}

// --- Socket.IO event payloads ---
export interface ServerToClientEvents {
  "safeclaw:alert": (payload: { command: string; threatLevel: ThreatLevel; id: number }) => void;
  "safeclaw:commandLogged": (payload: CommandLog) => void;
  "safeclaw:sessionUpdate": (payload: Session) => void;
  "safeclaw:configUpdate": (payload: AccessConfigEntry) => void;
  "safeclaw:stats": (payload: DashboardStats) => void;
  "safeclaw:accessConfig": (payload: AccessConfigEntry[]) => void;
  "safeclaw:settingsData": (payload: SafeClawConfig) => void;
  "safeclaw:openclawConfig": (payload: OpenClawConfig | null) => void;
  "safeclaw:openclawActivity": (payload: AgentActivity) => void;
  "safeclaw:openclawSessionUpdate": (payload: OpenClawSession) => void;
  "safeclaw:openclawMonitorStatus": (payload: OpenClawMonitorStatus) => void;
  "safeclaw:threatResolved": (payload: AgentActivity) => void;
  "safeclaw:accessControlState": (payload: AccessControlState) => void;
  "safeclaw:execApprovalRequested": (payload: ExecApprovalEntry) => void;
  "safeclaw:execApprovalResolved": (payload: ExecApprovalEntry) => void;
  "safeclaw:approvalHistoryBatch": (payload: ExecApprovalEntry[]) => void;
  "safeclaw:allowlistState": (payload: AllowlistState) => void;
  "safeclaw:srtStatus": (payload: SrtStatus) => void;
}

export interface ClientToServerEvents {
  "safeclaw:decision": (payload: { commandId: number; action: "ALLOW" | "DENY" }) => void;
  "safeclaw:getStats": () => void;
  "safeclaw:getRecentCommands": (payload: { limit: number }) => void;
  "safeclaw:getAccessConfig": () => void;
  "safeclaw:toggleAccess": (payload: { category: string; enabled: boolean }) => void;
  "safeclaw:getSettings": () => void;
  "safeclaw:updateSettings": (payload: Partial<SafeClawConfig>) => void;
  "safeclaw:getOpenclawConfig": () => void;
  "safeclaw:updateOpenclawConfig": (payload: Partial<OpenClawConfig>) => void;
  "safeclaw:getOpenclawSessions": () => void;
  "safeclaw:getOpenclawActivities": (payload: { sessionId?: string; limit: number }) => void;
  "safeclaw:getOpenclawMonitorStatus": () => void;
  "safeclaw:reconnectOpenclaw": () => void;
  "safeclaw:getAccessControlState": () => void;
  "safeclaw:resolveActivity": (payload: { activityId: number; resolved: boolean }) => void;
  "safeclaw:getThreats": (payload: {
    severity?: ThreatLevel;
    resolved?: boolean;
    limit: number;
  }) => void;
  "safeclaw:execDecision": (payload: { approvalId: string; decision: ExecDecision }) => void;
  "safeclaw:getPendingApprovals": () => void;
  "safeclaw:getApprovalHistory": (payload: { limit: number }) => void;
  "safeclaw:getAllowlist": () => void;
  "safeclaw:addAllowlistPattern": (payload: { pattern: string }) => void;
  "safeclaw:removeAllowlistPattern": (payload: { pattern: string }) => void;
  "safeclaw:toggleMcpServer": (payload: { serverName: string; enabled: boolean }) => void;
  "safeclaw:getSrtStatus": () => void;
  "safeclaw:toggleSrt": (payload: { enabled: boolean }) => void;
  "safeclaw:updateSrtDomains": (payload: {
    list: "allow" | "deny";
    action: "add" | "remove";
    domain: string;
  }) => void;
  "safeclaw:updateSrtSettings": (payload: Partial<SrtSettings>) => void;
}

export interface DashboardStats {
  totalCommands: number;
  blockedCommands: number;
  allowedCommands: number;
  activeSessions: number;
  threatBreakdown: Record<ThreatLevel, number>;
  openclawActivities: number;
  openclawActiveSessions: number;
  openclawThreatBreakdown: Record<ThreatLevel, number>;
  resolvedThreatBreakdown: Record<ThreatLevel, number>;
  threatDetectionRate: {
    activitiesWithThreats: number;
    totalActivities: number;
  };
  execApprovalTotal: number;
  execApprovalBlocked: number;
  execApprovalAllowed: number;
  execApprovalPending: number;
}

// --- Exec approval types ---
export type ExecDecision = "allow-once" | "allow-always" | "deny";

export interface ExecApprovalEntry {
  id: string;
  command: string;
  cwd: string;
  security: string;
  sessionKey: string;
  requestedAt: string;
  expiresAt: string;
  decision: ExecDecision | null;
  decidedBy: "user" | "auto-deny" | "auto-approve" | "access-control" | null;
  decidedAt: string | null;
}

export interface AllowlistPattern {
  pattern: string;
}

export interface AllowlistState {
  patterns: AllowlistPattern[];
}

// --- Config file shape ---
export interface SafeClawConfig {
  version: string;
  port: number;
  autoOpenBrowser: boolean;
  premium: boolean;
  userId: string | null;
  srt?: {
    enabled: boolean;
    settingsPath?: string;
  };
}

// --- Access control types ---
export type AccessCategory = "filesystem" | "mcp_servers" | "network" | "system_commands";

export interface AccessToggleState {
  category: AccessCategory;
  enabled: boolean;
}

export interface McpServerState {
  name: string;
  pluginEnabled: boolean;
  toolsDenyBlocked: boolean;
  effectivelyEnabled: boolean;
}

export interface AccessControlState {
  toggles: AccessToggleState[];
  mcpServers: McpServerState[];
  openclawConfigAvailable: boolean;
}

// --- OpenClaw config shape (mirrors ~/.openclaw/openclaw.json) ---
export interface OpenClawToolsExec {
  host?: string;
  security?: "deny" | "allowlist" | "full";
  ask?: "off" | "on-miss" | "always";
}

export interface OpenClawToolsConfig {
  allow?: string[];
  deny?: string[];
  profile?: string;
  exec?: OpenClawToolsExec;
}

export interface OpenClawBrowserConfig {
  enabled?: boolean;
}

export interface OpenClawSandboxDockerConfig {
  binds?: string[];
  network?: string;
}

export interface OpenClawSandboxConfig {
  mode?: "off" | "non-main" | "all";
  workspaceAccess?: "none" | "ro" | "rw";
  docker?: OpenClawSandboxDockerConfig;
}

export interface OpenClawConfig {
  messages?: {
    ackReactionScope?: string;
  };
  agents?: {
    defaults?: {
      maxConcurrent?: number;
      subagents?: {
        maxConcurrent?: number;
      };
      compaction?: {
        mode?: string;
      };
      workspace?: string;
      sandbox?: OpenClawSandboxConfig;
      model?: {
        primary?: string;
      };
      models?: Record<string, Record<string, unknown>>;
    };
  };
  gateway?: {
    mode?: string;
    auth?: {
      mode?: string;
      token?: string;
    };
    port?: number;
    bind?: string;
    trustedProxies?: string[];
    tailscale?: {
      mode?: string;
      resetOnExit?: boolean;
    };
  };
  auth?: {
    profiles?: Record<
      string,
      {
        provider?: string;
        mode?: string;
      }
    >;
  };
  plugins?: {
    entries?: Record<
      string,
      {
        enabled?: boolean;
      }
    >;
  };
  tools?: OpenClawToolsConfig;
  browser?: OpenClawBrowserConfig;
  channels?: {
    whatsapp?: {
      selfChatMode?: boolean;
      dmPolicy?: string;
      allowFrom?: string[];
    };
  };
  wizard?: {
    lastRunAt?: string;
    lastRunVersion?: string;
    lastRunCommand?: string;
    lastRunMode?: string;
  };
  meta?: {
    lastTouchedVersion?: string;
    lastTouchedAt?: string;
  };
}

// --- Skill Scanner types ---
export type SkillScanCategoryId =
  | "SK-HID" // Hidden Content
  | "SK-INJ" // Prompt Injection
  | "SK-EXE" // Shell Execution
  | "SK-EXF" // Data Exfiltration
  | "SK-SEC" // Embedded Secrets
  | "SK-SFA" // Sensitive File Refs
  | "SK-MEM" // Memory/Config Poisoning
  | "SK-SUP" // Supply Chain Risk
  | "SK-B64" // Encoded Payloads
  | "SK-IMG" // Image Exfiltration
  | "SK-SYS" // System Prompt Extraction
  | "SK-ARG" // Argument Injection
  | "SK-XTL" // Cross-Tool Chaining
  | "SK-PRM" // Excessive Permissions
  | "SK-STR"; // Suspicious Structure

export interface SkillScanFinding {
  categoryId: SkillScanCategoryId;
  categoryName: string;
  severity: ThreatLevel;
  reason: string;
  evidence?: string;
  owaspRef?: string;
  remediation?: string;
  lineNumber?: number;
}

export interface SkillScanResult {
  overallSeverity: ThreatLevel;
  findings: SkillScanFinding[];
  summary: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  scannedAt: string;
  contentLength: number;
  scanDurationMs: number;
}

export interface SkillCleanResult {
  cleanedContent: string;
  removedCount: number;
}

// --- Security Posture types ---
export type SecurityLayerStatus = "configured" | "partial" | "unconfigured" | "error";

export interface SecurityCheck {
  id: string;
  label: string;
  passed: boolean;
  detail: string;
  severity: "info" | "warning" | "critical";
}

export interface SecurityLayer {
  id: string;
  name: string;
  status: SecurityLayerStatus;
  checks: SecurityCheck[];
  passedCount: number;
  totalCount: number;
}

export interface SecurityPosture {
  layers: SecurityLayer[];
  overallScore: number;
  configuredLayers: number;
  partialLayers: number;
  unconfiguredLayers: number;
  totalLayers: number;
  checkedAt: string;
}

// --- SRT (Sandbox Runtime) types ---
export interface SrtNetworkConfig {
  allowedDomains: string[];
  deniedDomains: string[];
  allowLocalBinding: boolean;
}

export interface SrtFilesystemConfig {
  denyRead: string[];
  allowWrite: string[];
  denyWrite: string[];
}

export interface SrtSettings {
  network: SrtNetworkConfig;
  filesystem: SrtFilesystemConfig;
}

export interface SrtStatus {
  installed: boolean;
  version: string | null;
  enabled: boolean;
  settingsPath: string;
  settings: SrtSettings | null;
}
