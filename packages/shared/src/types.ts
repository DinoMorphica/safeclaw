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

export type OpenClawConnectionStatus =
  | "connected"
  | "disconnected"
  | "connecting"
  | "not_configured";

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
  "safeclaw:alert": (payload: {
    command: string;
    threatLevel: ThreatLevel;
    id: number;
  }) => void;
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
}

export interface ClientToServerEvents {
  "safeclaw:decision": (payload: {
    commandId: number;
    action: "ALLOW" | "DENY";
  }) => void;
  "safeclaw:getStats": () => void;
  "safeclaw:getRecentCommands": (payload: { limit: number }) => void;
  "safeclaw:getAccessConfig": () => void;
  "safeclaw:toggleAccess": (payload: {
    category: string;
    enabled: boolean;
  }) => void;
  "safeclaw:getSettings": () => void;
  "safeclaw:updateSettings": (payload: Partial<SafeClawConfig>) => void;
  "safeclaw:getOpenclawConfig": () => void;
  "safeclaw:updateOpenclawConfig": (payload: Partial<OpenClawConfig>) => void;
  "safeclaw:getOpenclawSessions": () => void;
  "safeclaw:getOpenclawActivities": (payload: {
    sessionId?: string;
    limit: number;
  }) => void;
  "safeclaw:getOpenclawMonitorStatus": () => void;
  "safeclaw:reconnectOpenclaw": () => void;
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
}

// --- Config file shape ---
export interface SafeClawConfig {
  version: string;
  port: number;
  autoOpenBrowser: boolean;
  premium: boolean;
  userId: string | null;
}

// --- OpenClaw config shape (mirrors ~/.openclaw/openclaw.json) ---
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
