import type { FastifyInstance } from "fastify";
import { getDb, schema } from "../db/index.js";
import { desc, eq, and, sql } from "drizzle-orm";
import { readConfig, writeConfig } from "../lib/config.js";
import { readOpenClawConfig, writeOpenClawConfig } from "../lib/openclaw-config.js";
import { getOpenClawMonitor } from "../services/openclaw-monitor.js";
import {
  deriveAccessState,
  applyAccessToggle,
  applyMcpServerToggle,
} from "../services/access-control.js";
import type { OpenClawConfig, ThreatLevel, ExecDecision, SrtSettings } from "@safeclaw/shared";
import { skillScanRequestSchema } from "@safeclaw/shared";
import { scanSkillDefinition, cleanSkillDefinition } from "../lib/skill-scanner.js";
import { computeSecurityPosture } from "../services/security-posture.js";
import {
  getSrtStatus,
  toggleSrt,
  readSrtSettings,
  updateSrtSettings,
  addAllowedDomain,
  removeAllowedDomain,
  addDeniedDomain,
  removeDeniedDomain,
} from "../lib/srt-config.js";

export async function registerRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/health", async () => {
    return { status: "ok", timestamp: new Date().toISOString() };
  });

  app.get("/api/commands", async (request) => {
    const db = getDb();
    const { limit = 50 } = request.query as { limit?: number };
    const commands = await db
      .select()
      .from(schema.commandLogs)
      .orderBy(desc(schema.commandLogs.id))
      .limit(Number(limit));
    return commands;
  });

  app.get("/api/sessions", async () => {
    const db = getDb();
    const sessionList = await db
      .select()
      .from(schema.sessions)
      .orderBy(desc(schema.sessions.startedAt));
    return sessionList;
  });

  app.get("/api/config", async () => {
    const db = getDb();
    const config = await db.select().from(schema.accessConfig);
    return config;
  });

  app.get("/api/access-control/state", async () => {
    return deriveAccessState();
  });

  app.put("/api/config/access", async (request) => {
    const { category, enabled } = request.body as {
      category: string;
      enabled: boolean;
    };
    try {
      return await applyAccessToggle(
        category as "filesystem" | "mcp_servers" | "network" | "system_commands",
        enabled,
      );
    } catch {
      // Fallback: just update DB if OpenClaw config is unavailable
      const db = getDb();
      await db
        .update(schema.accessConfig)
        .set({
          value: enabled ? "true" : "false",
          updatedAt: sql`datetime('now')`,
        })
        .where(
          and(eq(schema.accessConfig.category, category), eq(schema.accessConfig.key, "enabled")),
        );
      return deriveAccessState();
    }
  });

  app.put("/api/config/access/mcp-server", async (request) => {
    const { serverName, enabled } = request.body as {
      serverName: string;
      enabled: boolean;
    };
    try {
      return await applyMcpServerToggle(serverName, enabled);
    } catch {
      return deriveAccessState();
    }
  });

  app.get("/api/settings", async () => {
    return readConfig();
  });

  app.put("/api/settings", async (request) => {
    const updates = request.body as Record<string, unknown>;
    const current = readConfig();
    const updated = { ...current, ...updates };
    writeConfig(updated);
    return updated;
  });

  app.put("/api/commands/:id/decision", async (request) => {
    const { id } = request.params as { id: string };
    const { action } = request.body as { action: "ALLOW" | "DENY" };
    const db = getDb();
    const newStatus = action === "ALLOW" ? "ALLOWED" : "BLOCKED";
    await db
      .update(schema.commandLogs)
      .set({ status: newStatus, decisionBy: "USER" })
      .where(eq(schema.commandLogs.id, Number(id)));
    const [updated] = await db
      .select()
      .from(schema.commandLogs)
      .where(eq(schema.commandLogs.id, Number(id)));
    return updated;
  });

  // --- OpenClaw config routes ---

  app.get("/api/openclaw/config", async () => {
    const config = readOpenClawConfig();
    return config ?? { error: "OpenClaw config not found" };
  });

  app.put("/api/openclaw/config", async (request) => {
    const updates = request.body as Partial<OpenClawConfig>;
    const updated = writeOpenClawConfig(updates);
    if (!updated) {
      return { error: "OpenClaw config not found" };
    }
    return updated;
  });

  // --- OpenClaw monitoring routes ---

  app.get("/api/openclaw/sessions", async () => {
    const monitor = getOpenClawMonitor();
    if (!monitor) return [];
    return monitor.getAllSessions();
  });

  app.get("/api/openclaw/activities", async (request) => {
    const { sessionId, limit = 50 } = request.query as {
      sessionId?: string;
      limit?: number;
    };
    const monitor = getOpenClawMonitor();
    if (!monitor) return [];
    return monitor.getActivities(sessionId, Number(limit));
  });

  app.get("/api/openclaw/threats", async (request) => {
    const {
      severity,
      resolved,
      limit = 100,
    } = request.query as {
      severity?: ThreatLevel;
      resolved?: string;
      limit?: number;
    };
    const monitor = getOpenClawMonitor();
    if (!monitor) return [];
    return monitor.getThreats(
      severity,
      resolved === undefined ? undefined : resolved === "true",
      Number(limit),
    );
  });

  app.put("/api/openclaw/activities/:id/resolve", async (request) => {
    const { id } = request.params as { id: string };
    const { resolved } = request.body as { resolved: boolean };
    const monitor = getOpenClawMonitor();
    if (!monitor) return { error: "Monitor not available" };
    const updated = await monitor.resolveActivity(Number(id), resolved);
    if (!updated) return { error: "Activity not found" };
    return updated;
  });

  app.get("/api/openclaw/status", async () => {
    const monitor = getOpenClawMonitor();
    const config = readOpenClawConfig();
    if (!monitor) {
      return {
        connectionStatus: "not_configured",
        gatewayPort: config?.gateway?.port ?? null,
        lastEventAt: null,
        activeSessionCount: 0,
      };
    }
    return {
      connectionStatus: monitor.getStatus(),
      gatewayPort: config?.gateway?.port ?? null,
      lastEventAt: null,
      activeSessionCount: 0,
    };
  });

  // --- Exec Approval routes ---

  app.get("/api/exec-approvals/pending", async () => {
    const monitor = getOpenClawMonitor();
    if (!monitor) return [];
    return monitor.getExecApprovalService().getPendingApprovals();
  });

  app.get("/api/exec-approvals/history", async (request) => {
    const { limit = 50 } = request.query as { limit?: number };
    const monitor = getOpenClawMonitor();
    if (!monitor) return [];
    return monitor.getExecApprovalService().getHistory(Number(limit));
  });

  app.put("/api/exec-approvals/:id/decision", async (request) => {
    const { id } = request.params as { id: string };
    const { decision } = request.body as { decision: ExecDecision };
    const monitor = getOpenClawMonitor();
    if (!monitor) return { error: "Monitor not available" };
    monitor.getExecApprovalService().handleDecision(id, decision);
    return { ok: true };
  });

  app.get("/api/allowlist", async () => {
    const monitor = getOpenClawMonitor();
    if (!monitor) return { patterns: [] };
    const patterns = monitor.getExecApprovalService().getRestrictedPatterns();
    return { patterns: patterns.map((p: string) => ({ pattern: p })) };
  });

  app.post("/api/allowlist", async (request) => {
    const { pattern } = request.body as { pattern: string };
    const monitor = getOpenClawMonitor();
    if (!monitor) return { error: "Monitor not available" };
    const patterns = monitor.getExecApprovalService().addRestrictedPattern(pattern);
    return { patterns: patterns.map((p: string) => ({ pattern: p })) };
  });

  app.delete("/api/allowlist", async (request) => {
    const { pattern } = request.body as { pattern: string };
    const monitor = getOpenClawMonitor();
    if (!monitor) return { error: "Monitor not available" };
    const patterns = monitor.getExecApprovalService().removeRestrictedPattern(pattern);
    return { patterns: patterns.map((p: string) => ({ pattern: p })) };
  });

  // --- Security Posture ---

  app.get("/api/security-posture", async () => {
    return computeSecurityPosture();
  });

  // --- Skill Scanner ---

  app.post("/api/skill-scanner/scan", async (request, reply) => {
    const parsed = skillScanRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply
        .status(400)
        .send({ error: "Invalid request. Provide { content: string } (1 to 500K chars)." });
    }
    const result = scanSkillDefinition(parsed.data.content);
    return result;
  });

  app.post("/api/skill-scanner/clean", async (request, reply) => {
    const parsed = skillScanRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply
        .status(400)
        .send({ error: "Invalid request. Provide { content: string } (1 to 500K chars)." });
    }
    const result = cleanSkillDefinition(parsed.data.content);
    return result;
  });

  // --- SRT (Sandbox Runtime) routes ---

  app.get("/api/srt/status", async () => {
    return getSrtStatus();
  });

  app.put("/api/srt/toggle", async (request) => {
    const { enabled } = request.body as { enabled: boolean };
    return toggleSrt(enabled);
  });

  app.get("/api/srt/settings", async () => {
    return readSrtSettings() ?? { error: "SRT settings file not found" };
  });

  app.put("/api/srt/settings", async (request) => {
    const updates = request.body as Partial<SrtSettings>;
    return updateSrtSettings(updates);
  });

  app.post("/api/srt/domains/:list", async (request, reply) => {
    const { list } = request.params as { list: string };
    const { domain } = request.body as { domain: string };
    if (!domain?.trim()) {
      return reply.status(400).send({ error: "Domain is required" });
    }
    if (list === "allow") return addAllowedDomain(domain);
    if (list === "deny") return addDeniedDomain(domain);
    return reply.status(400).send({ error: "List must be 'allow' or 'deny'" });
  });

  app.delete("/api/srt/domains/:list", async (request, reply) => {
    const { list } = request.params as { list: string };
    const { domain } = request.body as { domain: string };
    if (!domain?.trim()) {
      return reply.status(400).send({ error: "Domain is required" });
    }
    if (list === "allow") return removeAllowedDomain(domain);
    if (list === "deny") return removeDeniedDomain(domain);
    return reply.status(400).send({ error: "List must be 'allow' or 'deny'" });
  });
}
