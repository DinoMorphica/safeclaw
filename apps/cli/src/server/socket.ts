import { Server as SocketIOServer } from "socket.io";
import type { Server as HttpServer } from "node:http";
import type {
  ServerToClientEvents,
  ClientToServerEvents,
} from "@safeclaw/shared";
import { getDb, schema } from "../db/index.js";
import { eq, desc, and, sql } from "drizzle-orm";
import { logger } from "../lib/logger.js";
import { readConfig, writeConfig } from "../lib/config.js";
import { readOpenClawConfig, writeOpenClawConfig } from "../lib/openclaw-config.js";
import { getOpenClawMonitor } from "../services/openclaw-monitor.js";
import { deriveAccessState, applyAccessToggle } from "../services/access-control.js";

export type TypedSocketServer = SocketIOServer<
  ClientToServerEvents,
  ServerToClientEvents
>;

let io: TypedSocketServer | null = null;

export function getIO(): TypedSocketServer {
  if (!io) throw new Error("Socket.IO not initialized");
  return io;
}

export function setupSocketIO(httpServer: HttpServer): TypedSocketServer {
  io = new SocketIOServer<ClientToServerEvents, ServerToClientEvents>(
    httpServer,
    {
      cors: {
        origin: "*",
        methods: ["GET", "POST"],
      },
    },
  );

  io.on("connection", (socket) => {
    logger.info(`Client connected: ${socket.id}`);

    socket.on("safeclaw:getStats", async () => {
      const db = getDb();
      const allLogs = await db.select().from(schema.commandLogs);
      const activeSessions = await db
        .select()
        .from(schema.sessions)
        .where(eq(schema.sessions.status, "ACTIVE"));

      // OpenClaw activity stats
      const allActivities = await db.select().from(schema.agentActivities);
      const openclawActiveSessions = await db
        .select()
        .from(schema.openclawSessions)
        .where(eq(schema.openclawSessions.status, "ACTIVE"));

      const stats = {
        totalCommands: allLogs.length,
        blockedCommands: allLogs.filter((l) => l.status === "BLOCKED").length,
        allowedCommands: allLogs.filter((l) => l.status === "ALLOWED").length,
        activeSessions: activeSessions.length,
        threatBreakdown: {
          NONE: allLogs.filter((l) => l.threatLevel === "NONE").length,
          LOW: allLogs.filter((l) => l.threatLevel === "LOW").length,
          MEDIUM: allLogs.filter((l) => l.threatLevel === "MEDIUM").length,
          HIGH: allLogs.filter((l) => l.threatLevel === "HIGH").length,
          CRITICAL: allLogs.filter((l) => l.threatLevel === "CRITICAL").length,
        },
        openclawActivities: allActivities.length,
        openclawActiveSessions: openclawActiveSessions.length,
        openclawThreatBreakdown: {
          NONE: allActivities.filter((a) => a.threatLevel === "NONE").length,
          LOW: allActivities.filter((a) => a.threatLevel === "LOW").length,
          MEDIUM: allActivities.filter((a) => a.threatLevel === "MEDIUM").length,
          HIGH: allActivities.filter((a) => a.threatLevel === "HIGH").length,
          CRITICAL: allActivities.filter((a) => a.threatLevel === "CRITICAL").length,
        },
        resolvedThreatBreakdown: {
          NONE: allActivities.filter((a) => a.threatLevel === "NONE" && a.resolved === 1).length,
          LOW: allActivities.filter((a) => a.threatLevel === "LOW" && a.resolved === 1).length,
          MEDIUM: allActivities.filter((a) => a.threatLevel === "MEDIUM" && a.resolved === 1).length,
          HIGH: allActivities.filter((a) => a.threatLevel === "HIGH" && a.resolved === 1).length,
          CRITICAL: allActivities.filter((a) => a.threatLevel === "CRITICAL" && a.resolved === 1).length,
        },
        threatDetectionRate: {
          activitiesWithThreats: allActivities.filter((a) => a.threatLevel !== "NONE").length,
          totalActivities: allActivities.length,
        },
      };
      socket.emit("safeclaw:stats", stats);
    });

    socket.on("safeclaw:decision", async ({ commandId, action }) => {
      const db = getDb();
      const newStatus = action === "ALLOW" ? "ALLOWED" : "BLOCKED";
      await db
        .update(schema.commandLogs)
        .set({ status: newStatus, decisionBy: "USER" })
        .where(eq(schema.commandLogs.id, commandId));

      logger.info(`Command ${commandId} ${newStatus} by user`);

      // Broadcast updated command to all clients
      const [updated] = await db
        .select()
        .from(schema.commandLogs)
        .where(eq(schema.commandLogs.id, commandId));

      if (updated) {
        io!.emit("safeclaw:commandLogged", {
          id: updated.id,
          command: updated.command,
          status: updated.status as "ALLOWED" | "BLOCKED" | "PENDING",
          threatLevel: updated.threatLevel as
            | "NONE"
            | "LOW"
            | "MEDIUM"
            | "HIGH"
            | "CRITICAL",
          timestamp: updated.timestamp,
          sessionId: updated.sessionId,
          decisionBy: updated.decisionBy,
        });
      }
    });

    socket.on("safeclaw:getRecentCommands", async ({ limit }) => {
      const db = getDb();
      const commands = await db
        .select()
        .from(schema.commandLogs)
        .orderBy(desc(schema.commandLogs.id))
        .limit(limit);

      for (const cmd of commands) {
        socket.emit("safeclaw:commandLogged", {
          id: cmd.id,
          command: cmd.command,
          status: cmd.status as "ALLOWED" | "BLOCKED" | "PENDING",
          threatLevel: cmd.threatLevel as
            | "NONE"
            | "LOW"
            | "MEDIUM"
            | "HIGH"
            | "CRITICAL",
          timestamp: cmd.timestamp,
          sessionId: cmd.sessionId,
          decisionBy: cmd.decisionBy,
        });
      }
    });

    socket.on("safeclaw:getAccessConfig", async () => {
      const db = getDb();
      const config = await db.select().from(schema.accessConfig);
      socket.emit("safeclaw:accessConfig", config);
    });

    socket.on("safeclaw:getAccessControlState", () => {
      const state = deriveAccessState();
      socket.emit("safeclaw:accessControlState", state);
    });

    socket.on("safeclaw:toggleAccess", async ({ category, enabled }) => {
      try {
        const toggles = await applyAccessToggle(
          category as "filesystem" | "mcp_servers" | "network" | "system_commands",
          enabled,
        );
        logger.info(`Access toggle: ${category} set to ${enabled}`);
        io!.emit("safeclaw:accessControlState", {
          toggles,
          openclawConfigAvailable: true,
        });
      } catch (err) {
        logger.error({ err, category, enabled }, "Failed to apply access toggle");
        const state = deriveAccessState();
        io!.emit("safeclaw:accessControlState", state);
      }
    });

    socket.on("safeclaw:getSettings", async () => {
      const config = readConfig();
      socket.emit("safeclaw:settingsData", config);
    });

    socket.on("safeclaw:updateSettings", async (updates) => {
      const current = readConfig();
      const updated = { ...current, ...updates };
      writeConfig(updated);
      logger.info({ updates }, "Settings updated");
      socket.emit("safeclaw:settingsData", updated);
    });

    socket.on("safeclaw:getOpenclawConfig", async () => {
      const config = readOpenClawConfig();
      socket.emit("safeclaw:openclawConfig", config);
    });

    socket.on("safeclaw:updateOpenclawConfig", async (updates) => {
      const updated = writeOpenClawConfig(updates);
      logger.info({ updates }, "OpenClaw config updated");
      socket.emit("safeclaw:openclawConfig", updated);
    });

    socket.on("safeclaw:getOpenclawSessions", async () => {
      const monitor = getOpenClawMonitor();
      if (!monitor) return;
      const sessions = await monitor.getAllSessions();
      for (const session of sessions) {
        socket.emit("safeclaw:openclawSessionUpdate", session);
      }
    });

    socket.on("safeclaw:getOpenclawActivities", async ({ sessionId, limit }) => {
      const monitor = getOpenClawMonitor();
      if (!monitor) return;
      const activities = await monitor.getActivities(sessionId, limit);
      for (const activity of activities) {
        socket.emit("safeclaw:openclawActivity", activity);
      }
    });

    socket.on("safeclaw:getOpenclawMonitorStatus", async () => {
      const monitor = getOpenClawMonitor();
      if (!monitor) return;
      monitor.broadcastStatus();
    });

    socket.on("safeclaw:reconnectOpenclaw", () => {
      const monitor = getOpenClawMonitor();
      if (!monitor) return;
      monitor.reconnect();
    });

    socket.on("safeclaw:resolveActivity", async ({ activityId, resolved }) => {
      const monitor = getOpenClawMonitor();
      if (!monitor) return;
      const updated = await monitor.resolveActivity(activityId, resolved);
      if (updated) {
        io!.emit("safeclaw:threatResolved", updated);
      }
    });

    socket.on("safeclaw:getThreats", async ({ severity, resolved, limit }) => {
      const monitor = getOpenClawMonitor();
      if (!monitor) return;
      const threats = await monitor.getThreats(severity, resolved, limit);
      for (const threat of threats) {
        socket.emit("safeclaw:openclawActivity", threat);
      }
    });

    // --- Exec Approval events ---

    socket.on("safeclaw:execDecision", ({ approvalId, decision }) => {
      const monitor = getOpenClawMonitor();
      if (!monitor) return;
      const service = monitor.getExecApprovalService();
      service.handleDecision(approvalId, decision);
    });

    socket.on("safeclaw:getPendingApprovals", () => {
      const monitor = getOpenClawMonitor();
      if (!monitor) return;
      const service = monitor.getExecApprovalService();
      const pending = service.getPendingApprovals();
      for (const entry of pending) {
        socket.emit("safeclaw:execApprovalRequested", entry);
      }
    });

    socket.on("safeclaw:getApprovalHistory", ({ limit }) => {
      const monitor = getOpenClawMonitor();
      if (!monitor) return;
      const service = monitor.getExecApprovalService();
      const history = service.getHistory(limit);
      for (const entry of history) {
        socket.emit("safeclaw:execApprovalResolved", entry);
      }
    });

    socket.on("safeclaw:getAllowlist", () => {
      const monitor = getOpenClawMonitor();
      if (!monitor) return;
      const service = monitor.getExecApprovalService();
      const patterns = service.getRestrictedPatterns();
      socket.emit("safeclaw:allowlistState", {
        patterns: patterns.map((p) => ({ pattern: p })),
      });
    });

    socket.on("safeclaw:addAllowlistPattern", ({ pattern }) => {
      const monitor = getOpenClawMonitor();
      if (!monitor) return;
      const service = monitor.getExecApprovalService();
      try {
        service.addRestrictedPattern(pattern);
      } catch (err) {
        logger.error({ err, pattern }, "Failed to add restricted pattern");
      }
    });

    socket.on("safeclaw:removeAllowlistPattern", ({ pattern }) => {
      const monitor = getOpenClawMonitor();
      if (!monitor) return;
      const service = monitor.getExecApprovalService();
      try {
        service.removeRestrictedPattern(pattern);
      } catch (err) {
        logger.error({ err, pattern }, "Failed to remove restricted pattern");
      }
    });

    socket.on("disconnect", () => {
      logger.info(`Client disconnected: ${socket.id}`);
    });
  });

  return io;
}
