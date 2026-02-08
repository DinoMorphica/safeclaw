import type { FastifyInstance } from "fastify";
import { getDb, schema } from "../db/index.js";
import { desc, eq, and, sql } from "drizzle-orm";
import { readConfig, writeConfig } from "../lib/config.js";
import { readOpenClawConfig, writeOpenClawConfig } from "../lib/openclaw-config.js";
import { getOpenClawMonitor } from "../services/openclaw-monitor.js";
import type { OpenClawConfig, ThreatLevel } from "@safeclaw/shared";

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

  app.put("/api/config/access", async (request) => {
    const { category, enabled } = request.body as {
      category: string;
      enabled: boolean;
    };
    const db = getDb();
    await db
      .update(schema.accessConfig)
      .set({
        value: enabled ? "true" : "false",
        updatedAt: sql`datetime('now')`,
      })
      .where(
        and(
          eq(schema.accessConfig.category, category),
          eq(schema.accessConfig.key, "enabled"),
        ),
      );
    const updated = await db.select().from(schema.accessConfig);
    return updated;
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
    const { severity, resolved, limit = 100 } = request.query as {
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
}
