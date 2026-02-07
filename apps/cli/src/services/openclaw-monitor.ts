import {
  OpenClawClient,
  type ParsedActivity,
} from "../lib/openclaw-client.js";
import { SessionWatcher, type SessionFileActivity } from "./session-watcher.js";
import { analyzeActivityThreat } from "../interceptor.js";
import { getDb, schema } from "../db/index.js";
import { eq, desc, sql } from "drizzle-orm";
import { logger } from "../lib/logger.js";
import { readOpenClawConfig } from "../lib/openclaw-config.js";
import type { TypedSocketServer } from "../server/socket.js";
import type {
  OpenClawConnectionStatus,
  OpenClawSession,
  ThreatLevel,
  ThreatFinding,
  AgentActivity,
  ActivityType,
} from "@safeclaw/shared";

let instance: OpenClawMonitor | null = null;

export class OpenClawMonitor {
  private client: OpenClawClient;
  private sessionWatcher: SessionWatcher;
  private io: TypedSocketServer;
  private lastEventAt: string | null = null;

  constructor(io: TypedSocketServer) {
    this.io = io;
    this.client = new OpenClawClient();
    this.sessionWatcher = new SessionWatcher();
    this.setupListeners();
  }

  private setupListeners(): void {
    this.client.on("activity", (parsed: ParsedActivity) => {
      this.handleActivity({
        openclawSessionId: parsed.openclawSessionId,
        activityType: parsed.activityType,
        detail: parsed.detail,
        rawPayload: parsed.rawPayload,
        toolName: parsed.toolName,
        targetPath: parsed.targetPath,
        timestamp: parsed.timestamp,
        runId: parsed.runId ?? null,
        contentPreview: null,
        readContentPreview: null,
      }).catch((err) =>
        logger.error({ err }, "Failed to handle OpenClaw activity"),
      );
    });

    this.client.on("sessionStart", (sessionId: string, model?: string) => {
      this.handleSessionStart(sessionId, model).catch((err) =>
        logger.error({ err }, "Failed to handle OpenClaw session start"),
      );
    });

    this.client.on("sessionEnd", (sessionId: string) => {
      this.handleSessionEnd(sessionId).catch((err) =>
        logger.error({ err }, "Failed to handle OpenClaw session end"),
      );
    });

    this.client.on("statusChange", (_status: OpenClawConnectionStatus) => {
      this.broadcastStatus();
    });

    // Session file watcher activities (tool calls with content)
    this.sessionWatcher.on("activity", (activity: SessionFileActivity) => {
      this.handleActivity(activity).catch((err) =>
        logger.error({ err }, "Failed to handle session file activity"),
      );
    });
  }

  private async handleActivity(parsed: {
    openclawSessionId: string;
    activityType: ActivityType;
    detail: string;
    rawPayload: string;
    toolName: string | null;
    targetPath: string | null;
    timestamp: string;
    runId: string | null;
    contentPreview: string | null;
    readContentPreview: string | null;
  }): Promise<void> {
    const { threatLevel, secretsDetected, findings } = analyzeActivityThreat(
      parsed.activityType,
      parsed.detail,
      parsed.targetPath,
      parsed.contentPreview,
      parsed.readContentPreview,
      parsed.toolName,
    );

    const db = getDb();

    // Ensure session exists (create if not seen before)
    const existingSession = await db
      .select()
      .from(schema.openclawSessions)
      .where(eq(schema.openclawSessions.id, parsed.openclawSessionId))
      .limit(1);

    if (existingSession.length === 0) {
      await db.insert(schema.openclawSessions).values({
        id: parsed.openclawSessionId,
        status: "ACTIVE",
      });
    }

    // Serialize secretsDetected and threatFindings as JSON strings for SQLite storage
    const secretsJson = secretsDetected ? JSON.stringify(secretsDetected) : null;
    const findingsJson = findings.length > 0 ? JSON.stringify(findings) : null;

    // Insert activity
    const [inserted] = await db
      .insert(schema.agentActivities)
      .values({
        openclawSessionId: parsed.openclawSessionId,
        activityType: parsed.activityType,
        detail: parsed.detail,
        rawPayload: parsed.rawPayload,
        threatLevel,
        timestamp: parsed.timestamp,
        toolName: parsed.toolName,
        targetPath: parsed.targetPath,
        runId: parsed.runId,
        contentPreview: parsed.contentPreview,
        readContentPreview: parsed.readContentPreview,
        secretsDetected: secretsJson,
        threatFindings: findingsJson,
      })
      .returning();

    this.lastEventAt = parsed.timestamp;

    // Parse secretsDetected and threatFindings back from JSON for the emitted activity
    let parsedSecrets: string[] | null = null;
    if (inserted.secretsDetected) {
      try {
        parsedSecrets = JSON.parse(inserted.secretsDetected) as string[];
      } catch {
        parsedSecrets = null;
      }
    }

    let parsedFindings: ThreatFinding[] | null = null;
    if (inserted.threatFindings) {
      try {
        parsedFindings = JSON.parse(inserted.threatFindings) as ThreatFinding[];
      } catch {
        parsedFindings = null;
      }
    }

    const activity: AgentActivity = {
      id: inserted.id,
      openclawSessionId: inserted.openclawSessionId,
      activityType: inserted.activityType as ActivityType,
      detail: inserted.detail,
      rawPayload: inserted.rawPayload,
      threatLevel: inserted.threatLevel as ThreatLevel,
      timestamp: inserted.timestamp,
      toolName: inserted.toolName,
      targetPath: inserted.targetPath,
      runId: inserted.runId,
      contentPreview: inserted.contentPreview,
      readContentPreview: inserted.readContentPreview,
      secretsDetected: parsedSecrets,
      threatFindings: parsedFindings,
    };

    this.io.emit("safeclaw:openclawActivity", activity);

    // Emit alert for HIGH or CRITICAL
    if (threatLevel === "HIGH" || threatLevel === "CRITICAL") {
      this.io.emit("safeclaw:alert", {
        command: parsed.detail,
        threatLevel,
        id: inserted.id,
      });
    }

    // Log secrets detection
    if (secretsDetected && secretsDetected.length > 0) {
      logger.warn(
        {
          sessionId: parsed.openclawSessionId,
          secrets: secretsDetected,
          threat: threatLevel,
        },
        `Secrets detected in agent activity: ${secretsDetected.join(", ")}`,
      );
    }

    logger.info(
      {
        sessionId: parsed.openclawSessionId,
        type: parsed.activityType,
        threat: threatLevel,
        runId: parsed.runId,
      },
      `OpenClaw activity: ${parsed.detail}`,
    );
  }

  private async handleSessionStart(
    sessionId: string,
    model?: string,
  ): Promise<void> {
    const db = getDb();

    // Upsert: insert or update if exists
    const existing = await db
      .select()
      .from(schema.openclawSessions)
      .where(eq(schema.openclawSessions.id, sessionId))
      .limit(1);

    if (existing.length === 0) {
      await db.insert(schema.openclawSessions).values({
        id: sessionId,
        status: "ACTIVE",
        model: model ?? null,
      });
    } else {
      await db
        .update(schema.openclawSessions)
        .set({ status: "ACTIVE", model: model ?? null })
        .where(eq(schema.openclawSessions.id, sessionId));
    }

    const session = await this.buildSessionPayload(sessionId);
    if (session) {
      this.io.emit("safeclaw:openclawSessionUpdate", session);
    }
  }

  private async handleSessionEnd(sessionId: string): Promise<void> {
    const db = getDb();
    await db
      .update(schema.openclawSessions)
      .set({
        status: "ENDED",
        endedAt: sql`datetime('now')`,
      })
      .where(eq(schema.openclawSessions.id, sessionId));

    const session = await this.buildSessionPayload(sessionId);
    if (session) {
      this.io.emit("safeclaw:openclawSessionUpdate", session);
    }
  }

  async buildSessionPayload(
    sessionId: string,
  ): Promise<OpenClawSession | null> {
    const db = getDb();
    const [row] = await db
      .select()
      .from(schema.openclawSessions)
      .where(eq(schema.openclawSessions.id, sessionId));

    if (!row) return null;

    const activities = await db
      .select()
      .from(schema.agentActivities)
      .where(eq(schema.agentActivities.openclawSessionId, sessionId));

    const threatSummary: Record<ThreatLevel, number> = {
      NONE: 0,
      LOW: 0,
      MEDIUM: 0,
      HIGH: 0,
      CRITICAL: 0,
    };
    for (const a of activities) {
      threatSummary[a.threatLevel as ThreatLevel]++;
    }

    return {
      id: row.id,
      startedAt: row.startedAt,
      endedAt: row.endedAt,
      status: row.status as "ACTIVE" | "ENDED",
      model: row.model,
      activityCount: activities.length,
      threatSummary,
    };
  }

  async getActivities(
    sessionId?: string,
    limit = 50,
  ): Promise<AgentActivity[]> {
    const db = getDb();

    let rows;
    if (sessionId) {
      rows = await db
        .select()
        .from(schema.agentActivities)
        .where(eq(schema.agentActivities.openclawSessionId, sessionId))
        .orderBy(desc(schema.agentActivities.id))
        .limit(limit);
    } else {
      rows = await db
        .select()
        .from(schema.agentActivities)
        .orderBy(desc(schema.agentActivities.id))
        .limit(limit);
    }

    return rows.map((r) => {
      let parsedSecrets: string[] | null = null;
      if (r.secretsDetected) {
        try {
          parsedSecrets = JSON.parse(r.secretsDetected) as string[];
        } catch {
          parsedSecrets = null;
        }
      }

      let parsedFindings: ThreatFinding[] | null = null;
      if (r.threatFindings) {
        try {
          parsedFindings = JSON.parse(r.threatFindings) as ThreatFinding[];
        } catch {
          parsedFindings = null;
        }
      }

      return {
        id: r.id,
        openclawSessionId: r.openclawSessionId,
        activityType: r.activityType as ActivityType,
        detail: r.detail,
        rawPayload: r.rawPayload,
        threatLevel: r.threatLevel as ThreatLevel,
        timestamp: r.timestamp,
        toolName: r.toolName,
        targetPath: r.targetPath,
        runId: r.runId,
        contentPreview: r.contentPreview,
        readContentPreview: r.readContentPreview,
        secretsDetected: parsedSecrets,
        threatFindings: parsedFindings,
      };
    });
  }

  async getAllSessions(): Promise<OpenClawSession[]> {
    const db = getDb();
    const rows = await db
      .select()
      .from(schema.openclawSessions)
      .orderBy(desc(schema.openclawSessions.startedAt));

    const results: OpenClawSession[] = [];
    for (const row of rows) {
      const session = await this.buildSessionPayload(row.id);
      if (session) results.push(session);
    }
    return results;
  }

  broadcastStatus(): void {
    const config = readOpenClawConfig();
    this.io.emit("safeclaw:openclawMonitorStatus", {
      connectionStatus: this.client.getStatus(),
      gatewayPort: config?.gateway?.port ?? null,
      lastEventAt: this.lastEventAt,
      activeSessionCount: 0,
    });
  }

  start(): void {
    this.client.connect();
    this.sessionWatcher.start();
  }

  reconnect(): void {
    this.client.reconnect();
  }

  stop(): void {
    this.client.destroy();
    this.sessionWatcher.stop();
  }

  getStatus(): OpenClawConnectionStatus {
    return this.client.getStatus();
  }
}

export function createOpenClawMonitor(
  io: TypedSocketServer,
): OpenClawMonitor {
  if (instance) {
    instance.stop();
  }
  instance = new OpenClawMonitor(io);
  return instance;
}

export function getOpenClawMonitor(): OpenClawMonitor | null {
  return instance;
}
