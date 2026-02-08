import Database from "better-sqlite3";
import { DB_PATH } from "../lib/paths.js";
import { ensureDataDir } from "../lib/config.js";

const DEFAULT_ACCESS_CONFIG = [
  { category: "filesystem", key: "enabled", value: "true" },
  { category: "mcp_servers", key: "enabled", value: "true" },
  { category: "network", key: "enabled", value: "true" },
  { category: "system_commands", key: "enabled", value: "false" },
];

export function pushSchema(): void {
  ensureDataDir();
  const sqlite = new Database(DB_PATH);
  sqlite.pragma("journal_mode = WAL");

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS command_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      command TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'PENDING',
      threat_level TEXT NOT NULL DEFAULT 'NONE',
      timestamp TEXT NOT NULL DEFAULT (datetime('now')),
      session_id TEXT,
      decision_by TEXT
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      started_at TEXT NOT NULL DEFAULT (datetime('now')),
      ended_at TEXT,
      status TEXT NOT NULL DEFAULT 'ACTIVE'
    );

    CREATE TABLE IF NOT EXISTS access_config (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category TEXT NOT NULL,
      key TEXT NOT NULL,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS openclaw_sessions (
      id TEXT PRIMARY KEY,
      started_at TEXT NOT NULL DEFAULT (datetime('now')),
      ended_at TEXT,
      status TEXT NOT NULL DEFAULT 'ACTIVE',
      model TEXT
    );

    CREATE TABLE IF NOT EXISTS agent_activities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      openclaw_session_id TEXT NOT NULL,
      activity_type TEXT NOT NULL,
      detail TEXT NOT NULL,
      raw_payload TEXT NOT NULL DEFAULT '{}',
      threat_level TEXT NOT NULL DEFAULT 'NONE',
      timestamp TEXT NOT NULL DEFAULT (datetime('now')),
      tool_name TEXT,
      target_path TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_agent_activities_session
      ON agent_activities(openclaw_session_id);
    CREATE INDEX IF NOT EXISTS idx_agent_activities_threat
      ON agent_activities(threat_level);
  `);

  // --- v0.2.0 migration: add run_id, content_preview, secrets_detected columns ---
  const columns = sqlite
    .prepare("PRAGMA table_info(agent_activities)")
    .all() as { name: string }[];
  const columnNames = new Set(columns.map((c) => c.name));

  if (!columnNames.has("run_id")) {
    sqlite.exec("ALTER TABLE agent_activities ADD COLUMN run_id TEXT");
  }
  if (!columnNames.has("content_preview")) {
    sqlite.exec(
      "ALTER TABLE agent_activities ADD COLUMN content_preview TEXT",
    );
  }
  if (!columnNames.has("secrets_detected")) {
    sqlite.exec(
      "ALTER TABLE agent_activities ADD COLUMN secrets_detected TEXT",
    );
  }
  if (!columnNames.has("read_content_preview")) {
    sqlite.exec(
      "ALTER TABLE agent_activities ADD COLUMN read_content_preview TEXT",
    );
  }
  if (!columnNames.has("threat_findings")) {
    sqlite.exec(
      "ALTER TABLE agent_activities ADD COLUMN threat_findings TEXT",
    );
  }
  if (!columnNames.has("resolved")) {
    sqlite.exec(
      "ALTER TABLE agent_activities ADD COLUMN resolved INTEGER NOT NULL DEFAULT 0",
    );
  }
  if (!columnNames.has("resolved_at")) {
    sqlite.exec(
      "ALTER TABLE agent_activities ADD COLUMN resolved_at TEXT",
    );
  }

  sqlite.exec(
    "CREATE INDEX IF NOT EXISTS idx_agent_activities_run_id ON agent_activities(run_id)",
  );

  // Seed default access config if table is empty
  const count = sqlite
    .prepare("SELECT COUNT(*) as cnt FROM access_config")
    .get() as { cnt: number };

  if (count.cnt === 0) {
    const insert = sqlite.prepare(
      "INSERT INTO access_config (category, key, value) VALUES (?, ?, ?)",
    );
    const seedAll = sqlite.transaction(() => {
      for (const entry of DEFAULT_ACCESS_CONFIG) {
        insert.run(entry.category, entry.key, entry.value);
      }
    });
    seedAll();
  }

  // Clean stale "unknown" session data from previous broken event parsing
  const unknownSession = sqlite
    .prepare("SELECT id FROM openclaw_sessions WHERE id = 'unknown'")
    .get() as { id: string } | undefined;

  if (unknownSession) {
    sqlite.exec(`
      DELETE FROM agent_activities WHERE openclaw_session_id = 'unknown';
      DELETE FROM openclaw_sessions WHERE id = 'unknown';
    `);
  }

  // Migration: Remove "database" access category (no OpenClaw equivalent)
  sqlite.exec("DELETE FROM access_config WHERE category = 'database'");

  sqlite.close();
}
