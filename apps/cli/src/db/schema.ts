import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

export const commandLogs = sqliteTable("command_logs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  command: text("command").notNull(),
  status: text("status", {
    enum: ["ALLOWED", "BLOCKED", "PENDING"],
  })
    .notNull()
    .default("PENDING"),
  threatLevel: text("threat_level", {
    enum: ["NONE", "LOW", "MEDIUM", "HIGH", "CRITICAL"],
  })
    .notNull()
    .default("NONE"),
  timestamp: text("timestamp")
    .notNull()
    .default(sql`(datetime('now'))`),
  sessionId: text("session_id"),
  decisionBy: text("decision_by"),
});

export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  startedAt: text("started_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  endedAt: text("ended_at"),
  status: text("status", {
    enum: ["ACTIVE", "ENDED"],
  })
    .notNull()
    .default("ACTIVE"),
});

export const accessConfig = sqliteTable("access_config", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  category: text("category").notNull(),
  key: text("key").notNull(),
  value: text("value").notNull(),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

export const openclawSessions = sqliteTable("openclaw_sessions", {
  id: text("id").primaryKey(),
  startedAt: text("started_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  endedAt: text("ended_at"),
  status: text("status", {
    enum: ["ACTIVE", "ENDED"],
  })
    .notNull()
    .default("ACTIVE"),
  model: text("model"),
});

export const agentActivities = sqliteTable("agent_activities", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  openclawSessionId: text("openclaw_session_id").notNull(),
  activityType: text("activity_type", {
    enum: [
      "file_read",
      "file_write",
      "shell_command",
      "web_browse",
      "tool_call",
      "message",
      "unknown",
    ],
  }).notNull(),
  detail: text("detail").notNull(),
  rawPayload: text("raw_payload").notNull().default("{}"),
  threatLevel: text("threat_level", {
    enum: ["NONE", "LOW", "MEDIUM", "HIGH", "CRITICAL"],
  })
    .notNull()
    .default("NONE"),
  timestamp: text("timestamp")
    .notNull()
    .default(sql`(datetime('now'))`),
  toolName: text("tool_name"),
  targetPath: text("target_path"),
  runId: text("run_id"),
  contentPreview: text("content_preview"),
  readContentPreview: text("read_content_preview"),
  secretsDetected: text("secrets_detected"),
  threatFindings: text("threat_findings"),
});
