import { z } from "zod";

export const commandStatusSchema = z.enum(["ALLOWED", "BLOCKED", "PENDING"]);
export const threatLevelSchema = z.enum([
  "NONE",
  "LOW",
  "MEDIUM",
  "HIGH",
  "CRITICAL",
]);
export const sessionStatusSchema = z.enum(["ACTIVE", "ENDED"]);

export const commandLogSchema = z.object({
  id: z.number(),
  command: z.string().min(1),
  status: commandStatusSchema,
  threatLevel: threatLevelSchema,
  timestamp: z.string(),
  sessionId: z.string().nullable(),
  decisionBy: z.string().nullable(),
});

export const sessionSchema = z.object({
  id: z.string(),
  startedAt: z.string(),
  endedAt: z.string().nullable(),
  status: sessionStatusSchema,
});

export const decisionPayloadSchema = z.object({
  commandId: z.number().int().positive(),
  action: z.enum(["ALLOW", "DENY"]),
});

export const safeClawConfigSchema = z.object({
  version: z.string(),
  port: z.number().int().min(1024).max(65535).default(3000),
  autoOpenBrowser: z.boolean().default(true),
  premium: z.boolean().default(false),
  userId: z.string().nullable().default(null),
});

export const activityTypeSchema = z.enum([
  "file_read",
  "file_write",
  "shell_command",
  "web_browse",
  "tool_call",
  "message",
  "unknown",
]);

export const openClawConnectionStatusSchema = z.enum([
  "connected",
  "disconnected",
  "connecting",
  "not_configured",
]);

export const threatCategoryIdSchema = z.enum([
  "TC-SEC", "TC-EXF", "TC-INJ", "TC-DES", "TC-ESC",
  "TC-SUP", "TC-SFA", "TC-SYS", "TC-NET", "TC-MCP",
]);

export const threatFindingSchema = z.object({
  categoryId: threatCategoryIdSchema,
  categoryName: z.string(),
  severity: threatLevelSchema,
  reason: z.string(),
  evidence: z.string().optional(),
  owaspRef: z.string().optional(),
});

export const agentActivitySchema = z.object({
  id: z.number(),
  openclawSessionId: z.string(),
  activityType: activityTypeSchema,
  detail: z.string(),
  rawPayload: z.string(),
  threatLevel: threatLevelSchema,
  timestamp: z.string(),
  toolName: z.string().nullable(),
  targetPath: z.string().nullable(),
  runId: z.string().nullable(),
  contentPreview: z.string().nullable(),
  readContentPreview: z.string().nullable(),
  secretsDetected: z.array(z.string()).nullable(),
  threatFindings: z.array(threatFindingSchema).nullable(),
  resolved: z.boolean(),
  resolvedAt: z.string().nullable(),
});

export const openClawSessionSchema = z.object({
  id: z.string(),
  startedAt: z.string(),
  endedAt: z.string().nullable(),
  status: sessionStatusSchema,
  model: z.string().nullable(),
  activityCount: z.number(),
  threatSummary: z.record(threatLevelSchema, z.number()),
});

export const openClawConfigSchema = z.object({
  messages: z.object({
    ackReactionScope: z.string().optional(),
  }).optional(),
  agents: z.object({
    defaults: z.object({
      maxConcurrent: z.number().optional(),
      subagents: z.object({
        maxConcurrent: z.number().optional(),
      }).optional(),
      compaction: z.object({
        mode: z.string().optional(),
      }).optional(),
      workspace: z.string().optional(),
      model: z.object({
        primary: z.string().optional(),
      }).optional(),
      models: z.record(z.record(z.unknown())).optional(),
    }).optional(),
  }).optional(),
  gateway: z.object({
    mode: z.string().optional(),
    auth: z.object({
      mode: z.string().optional(),
      token: z.string().optional(),
    }).optional(),
    port: z.number().optional(),
    bind: z.string().optional(),
    trustedProxies: z.array(z.string()).optional(),
    tailscale: z.object({
      mode: z.string().optional(),
      resetOnExit: z.boolean().optional(),
    }).optional(),
  }).optional(),
  auth: z.object({
    profiles: z.record(z.object({
      provider: z.string().optional(),
      mode: z.string().optional(),
    })).optional(),
  }).optional(),
  plugins: z.object({
    entries: z.record(z.object({
      enabled: z.boolean().optional(),
    })).optional(),
  }).optional(),
  channels: z.object({
    whatsapp: z.object({
      selfChatMode: z.boolean().optional(),
      dmPolicy: z.string().optional(),
      allowFrom: z.array(z.string()).optional(),
    }).optional(),
  }).optional(),
  wizard: z.object({
    lastRunAt: z.string().optional(),
    lastRunVersion: z.string().optional(),
    lastRunCommand: z.string().optional(),
    lastRunMode: z.string().optional(),
  }).optional(),
  meta: z.object({
    lastTouchedVersion: z.string().optional(),
    lastTouchedAt: z.string().optional(),
  }).optional(),
}).passthrough();
