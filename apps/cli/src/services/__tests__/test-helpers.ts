import { vi } from "vitest";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "../../db/schema.js";
import type { ExecApprovalRequest, OpenClawClient } from "../../lib/openclaw-client.js";
import type { TypedSocketServer } from "../../server/socket.js";

// --- In-memory SQLite for tests ---

export function createTestDb() {
  const sqlite = new Database(":memory:");
  sqlite.pragma("journal_mode = WAL");

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS restricted_patterns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pattern TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS exec_approvals (
      id TEXT PRIMARY KEY,
      command TEXT NOT NULL,
      cwd TEXT NOT NULL,
      security TEXT NOT NULL,
      session_key TEXT NOT NULL,
      requested_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      decision TEXT,
      decided_by TEXT,
      decided_at TEXT,
      matched_pattern TEXT
    );

    CREATE TABLE IF NOT EXISTS access_config (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category TEXT NOT NULL,
      key TEXT NOT NULL,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_exec_approvals_decision
      ON exec_approvals(decision);
    CREATE INDEX IF NOT EXISTS idx_exec_approvals_decided_at
      ON exec_approvals(decided_at);
  `);

  return drizzle(sqlite, { schema });
}

// --- Mock OpenClawClient ---

export function createMockClient() {
  return {
    resolveExecApproval: vi.fn().mockResolvedValue(true),
    getExecApprovals: vi.fn().mockResolvedValue(null),
    setExecApprovals: vi.fn().mockResolvedValue(true),
    on: vi.fn(),
    emit: vi.fn(),
    removeAllListeners: vi.fn(),
  } as unknown as OpenClawClient;
}

// --- Mock Socket.IO server ---

export function createMockIO() {
  return {
    emit: vi.fn(),
    on: vi.fn(),
    to: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
  } as unknown as TypedSocketServer;
}

// --- Test request factory ---

export function makeRequest(
  overrides: Partial<ExecApprovalRequest> = {},
): ExecApprovalRequest {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    command: overrides.command ?? "echo hello",
    cwd: overrides.cwd ?? "/tmp",
    security: overrides.security ?? "normal",
    sessionKey: overrides.sessionKey ?? "agent:main:main",
    ...overrides,
  };
}
