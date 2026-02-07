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

    socket.on("safeclaw:toggleAccess", async ({ category, enabled }) => {
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

      logger.info(`Access config ${category} set to ${enabled}`);

      // Send updated config to all clients
      const config = await db.select().from(schema.accessConfig);
      io!.emit("safeclaw:accessConfig", config);
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

    socket.on("disconnect", () => {
      logger.info(`Client disconnected: ${socket.id}`);
    });
  });

  return io;
}
