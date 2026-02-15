import { eq, desc, sql } from "drizzle-orm";
import path from "node:path";
import { logger } from "../lib/logger.js";
import { getDb, schema } from "../db/index.js";
import { deriveAccessState } from "./access-control.js";
import type {
  OpenClawClient,
  ExecApprovalRequest,
  OpenClawAllowlistEntry,
} from "../lib/openclaw-client.js";
import type { TypedSocketServer } from "../server/socket.js";
import type {
  ExecApprovalEntry,
  ExecDecision,
} from "@safeclaw/shared";

const DEFAULT_TIMEOUT_MS = 600_000; // 10 minutes

interface PendingApproval {
  entry: ExecApprovalEntry;
  timer: ReturnType<typeof setTimeout>;
  /** Which restricted pattern matched this command (null if no pattern matched) */
  matchedPattern: string | null;
}

let instance: ExecApprovalService | null = null;

/**
 * Simple glob-to-regex matching.
 * Converts patterns like "sudo *", "rm -rf *", "python*" to regex tests.
 */
export function matchesPattern(command: string, pattern: string): boolean {
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&");
  const regexStr = "^" + escaped.replace(/\*/g, ".*") + "$";
  return new RegExp(regexStr, "i").test(command);
}

const NETWORK_BINARIES: ReadonlySet<string> = new Set([
  "curl", "wget", "httpie", "http",
  "ssh", "scp", "sftp",
  "nc", "ncat", "netcat",
  "dig", "nslookup", "host",
  "ping", "traceroute", "tracepath", "mtr",
  "telnet", "ftp", "lftp",
  "rsync", "socat", "nmap",
]);

export function isNetworkCommand(command: string): boolean {
  const firstToken = command.trim().split(/\s+/)[0];
  if (!firstToken) return false;
  const basename = firstToken.includes("/")
    ? firstToken.split("/").pop()!
    : firstToken;
  return NETWORK_BINARIES.has(basename.toLowerCase());
}

export class ExecApprovalService {
  private client: OpenClawClient;
  private io: TypedSocketServer;
  private pending = new Map<string, PendingApproval>();
  private timeoutMs: number;
  /** In-memory cache of restricted patterns, loaded from DB on init */
  private restrictedPatterns: string[] = [];

  constructor(
    client: OpenClawClient,
    io: TypedSocketServer,
    timeoutMs = DEFAULT_TIMEOUT_MS,
  ) {
    this.client = client;
    this.io = io;
    this.timeoutMs = timeoutMs;
    this.loadPatternsFromDb();
  }

  /**
   * Load restricted patterns from the database into the in-memory cache.
   * Called once on construction so patterns survive restarts.
   */
  private loadPatternsFromDb(): void {
    try {
      const db = getDb();
      const rows = db
        .select({ pattern: schema.restrictedPatterns.pattern })
        .from(schema.restrictedPatterns)
        .all();
      this.restrictedPatterns = rows.map((r) => r.pattern);
      logger.info(
        { count: this.restrictedPatterns.length },
        "Loaded restricted patterns from database",
      );
    } catch (err) {
      logger.error({ err }, "Failed to load restricted patterns from database");
    }
  }

  /**
   * Handle an incoming exec approval request from the OpenClaw gateway.
   *
   * Blocklist model:
   * - If the command matches a restricted pattern → queue for user approval
   * - If it doesn't match → auto-approve immediately with "allow-once"
   */
  handleRequest(request: ExecApprovalRequest): void {
    const matchedPattern = this.findMatchingPattern(request.command);

    if (!matchedPattern) {
      // Access control cross-check: deny network commands when toggle is OFF
      if (isNetworkCommand(request.command)) {
        try {
          const accessState = deriveAccessState();
          const networkToggle = accessState.toggles.find(
            (t) => t.category === "network",
          );
          if (networkToggle && !networkToggle.enabled) {
            this.resolveToGateway(request.id, "deny");
            const now = new Date();
            const entry: ExecApprovalEntry = {
              id: request.id,
              command: request.command,
              cwd: request.cwd,
              security: request.security,
              sessionKey: request.sessionKey,
              requestedAt: now.toISOString(),
              expiresAt: now.toISOString(),
              decision: "deny",
              decidedBy: "access-control",
              decidedAt: now.toISOString(),
            };
            this.persistApproval(entry, null);
            this.io.emit("safeclaw:execApprovalResolved", entry);
            logger.info(
              { command: request.command },
              "Network command auto-denied (network toggle OFF)",
            );
            return;
          }
        } catch {
          // If access state can't be read, fall through to auto-approve
          logger.debug(
            { command: request.command },
            "Could not read access state for network check, falling through",
          );
        }
      }

      // Not restricted, not blocked by access control → auto-approve
      this.resolveToGateway(request.id, "allow-once");

      const now = new Date();
      const entry: ExecApprovalEntry = {
        id: request.id,
        command: request.command,
        cwd: request.cwd,
        security: request.security,
        sessionKey: request.sessionKey,
        requestedAt: now.toISOString(),
        expiresAt: now.toISOString(),
        decision: "allow-once",
        decidedBy: "auto-approve",
        decidedAt: now.toISOString(),
      };

      this.persistApproval(entry, null);
      this.io.emit("safeclaw:execApprovalResolved", entry);

      logger.debug(
        { command: request.command },
        "Command auto-approved (not restricted)",
      );
      return;
    }

    // Restricted → queue for manual approval
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.timeoutMs);

    const entry: ExecApprovalEntry = {
      id: request.id,
      command: request.command,
      cwd: request.cwd,
      security: request.security,
      sessionKey: request.sessionKey,
      requestedAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      decision: null,
      decidedBy: null,
      decidedAt: null,
    };

    const timer = setTimeout(() => {
      this.handleTimeout(request.id);
    }, this.timeoutMs);

    this.pending.set(request.id, { entry, timer, matchedPattern });

    // Persist as a pending row in DB (no decision yet)
    this.persistApproval(entry, matchedPattern);

    this.io.emit("safeclaw:execApprovalRequested", entry);

    logger.info(
      {
        command: request.command,
        matchedPattern,
        timeoutMs: this.timeoutMs,
      },
      "Restricted command queued for approval",
    );
  }

  /**
   * Handle a user decision from the UI.
   */
  handleDecision(approvalId: string, decision: ExecDecision): void {
    const pending = this.pending.get(approvalId);
    if (!pending) {
      logger.warn(
        { approvalId },
        "Decision for unknown or already-resolved approval",
      );
      return;
    }

    clearTimeout(pending.timer);
    this.pending.delete(approvalId);

    const entry = pending.entry;
    entry.decision = decision;
    entry.decidedBy = "user";
    entry.decidedAt = new Date().toISOString();

    this.resolveToGateway(approvalId, decision);
    this.updateApprovalDecision(entry);

    // "allow-always" → remove the restricted pattern that triggered this
    if (decision === "allow-always" && pending.matchedPattern) {
      this.removeRestrictedPattern(pending.matchedPattern);
    }

    this.io.emit("safeclaw:execApprovalResolved", entry);

    logger.info(
      { command: entry.command, decision, approvalId },
      "Exec approval decided by user",
    );
  }

  // --- Timeout handling ---

  private handleTimeout(approvalId: string): void {
    const pending = this.pending.get(approvalId);
    if (!pending) return;

    this.pending.delete(approvalId);

    const entry = pending.entry;
    entry.decision = "deny";
    entry.decidedBy = "auto-deny";
    entry.decidedAt = new Date().toISOString();

    this.resolveToGateway(approvalId, "deny");
    this.updateApprovalDecision(entry);

    this.io.emit("safeclaw:execApprovalResolved", entry);

    logger.info(
      { command: entry.command, approvalId },
      "Exec approval auto-denied (timeout)",
    );
  }

  // --- Gateway communication ---

  private resolveToGateway(
    approvalId: string,
    decision: ExecDecision,
  ): void {
    this.client.resolveExecApproval(approvalId, decision).catch((err) => {
      logger.error(
        { err, approvalId, decision },
        "Failed to send decision to gateway",
      );
    });
  }

  // --- Database persistence ---

  private persistApproval(
    entry: ExecApprovalEntry,
    matchedPattern: string | null,
  ): void {
    try {
      const db = getDb();
      db.insert(schema.execApprovals)
        .values({
          id: entry.id,
          command: entry.command,
          cwd: entry.cwd,
          security: entry.security,
          sessionKey: entry.sessionKey,
          requestedAt: entry.requestedAt,
          expiresAt: entry.expiresAt,
          decision: entry.decision,
          decidedBy: entry.decidedBy,
          decidedAt: entry.decidedAt,
          matchedPattern,
        })
        .run();
    } catch (err) {
      logger.error({ err, id: entry.id }, "Failed to persist exec approval");
    }
  }

  private updateApprovalDecision(entry: ExecApprovalEntry): void {
    try {
      const db = getDb();
      db.update(schema.execApprovals)
        .set({
          decision: entry.decision,
          decidedBy: entry.decidedBy,
          decidedAt: entry.decidedAt,
        })
        .where(eq(schema.execApprovals.id, entry.id))
        .run();
    } catch (err) {
      logger.error(
        { err, id: entry.id },
        "Failed to update exec approval decision",
      );
    }
  }

  // --- Pattern matching ---

  private findMatchingPattern(command: string): string | null {
    for (const pattern of this.restrictedPatterns) {
      if (matchesPattern(command, pattern)) {
        return pattern;
      }
    }
    return null;
  }

  // --- Restricted patterns management ---

  getRestrictedPatterns(): string[] {
    return [...this.restrictedPatterns];
  }

  addRestrictedPattern(pattern: string): string[] {
    const trimmed = pattern.trim();
    if (!trimmed) return this.restrictedPatterns;
    if (!this.restrictedPatterns.includes(trimmed)) {
      this.restrictedPatterns.push(trimmed);

      // Persist to database
      try {
        const db = getDb();
        db.insert(schema.restrictedPatterns)
          .values({ pattern: trimmed })
          .onConflictDoNothing()
          .run();
      } catch (err) {
        logger.error({ err, pattern: trimmed }, "Failed to persist restricted pattern");
      }

      // Sync: remove matching entries from OpenClaw's allowlist
      this.syncRemoveFromOpenClawAllowlist(trimmed).catch((err) => {
        logger.error(
          { err, pattern: trimmed },
          "Failed to sync pattern to OpenClaw allowlist",
        );
      });

      logger.info({ pattern: trimmed }, "Added restricted command pattern");
    }
    this.broadcastPatterns();
    return [...this.restrictedPatterns];
  }

  removeRestrictedPattern(pattern: string): string[] {
    this.restrictedPatterns = this.restrictedPatterns.filter(
      (p) => p !== pattern,
    );

    // Remove from database
    try {
      const db = getDb();
      db.delete(schema.restrictedPatterns)
        .where(eq(schema.restrictedPatterns.pattern, pattern))
        .run();
    } catch (err) {
      logger.error({ err, pattern }, "Failed to remove restricted pattern from database");
    }

    logger.info({ pattern }, "Removed restricted command pattern");
    this.broadcastPatterns();
    return [...this.restrictedPatterns];
  }

  // --- OpenClaw allowlist sync ---

  /**
   * Determine if an OpenClaw allowlist entry matches a SafeClaw restricted pattern.
   *
   * Matching strategy:
   * 1. Extract the binary name from the SafeClaw pattern's first token
   *    and compare against the basename of the allowlist entry's path.
   * 2. Check entry.lastUsedCommand against the full glob pattern.
   * 3. Check the entry.pattern itself against the full glob pattern.
   */
  private allowlistEntryMatchesRestriction(
    entry: OpenClawAllowlistEntry,
    restrictedPattern: string,
  ): boolean {
    // Strategy 1: basename comparison
    const firstToken = restrictedPattern.split(/\s+/)[0].replace(/\*+$/, "");
    if (firstToken) {
      const entryBasename = path.basename(entry.pattern);
      if (
        entryBasename === firstToken ||
        entryBasename.startsWith(firstToken)
      ) {
        return true;
      }
      if (entry.lastResolvedPath) {
        const resolvedBasename = path.basename(entry.lastResolvedPath);
        if (
          resolvedBasename === firstToken ||
          resolvedBasename.startsWith(firstToken)
        ) {
          return true;
        }
      }
    }

    // Strategy 2: match lastUsedCommand against the full glob
    if (
      entry.lastUsedCommand &&
      matchesPattern(entry.lastUsedCommand, restrictedPattern)
    ) {
      return true;
    }

    // Strategy 3: match the entry pattern path against the glob
    if (matchesPattern(entry.pattern, restrictedPattern)) {
      return true;
    }

    return false;
  }

  /**
   * Remove entries from OpenClaw's exec-approvals allowlist that match
   * the given restricted pattern. Uses optimistic locking via the gateway.
   */
  private async syncRemoveFromOpenClawAllowlist(
    pattern: string,
    maxRetries = 2,
  ): Promise<void> {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const result = await this.client.getExecApprovals();
        if (!result) {
          logger.warn("Could not read OpenClaw exec approvals for sync");
          return;
        }

        const { file, hash } = result;
        let modified = false;

        if (file.agents) {
          for (const agentKey of Object.keys(file.agents)) {
            const agent = file.agents[agentKey];
            if (!agent.allowlist || agent.allowlist.length === 0) continue;

            const before = agent.allowlist.length;
            agent.allowlist = agent.allowlist.filter(
              (entry) =>
                !this.allowlistEntryMatchesRestriction(entry, pattern),
            );
            const removed = before - agent.allowlist.length;

            if (removed > 0) {
              modified = true;
              logger.info(
                { agentKey, pattern, removed },
                "Filtered OpenClaw allowlist entries matching new restriction",
              );
            }
          }
        }

        if (!modified) return;

        const success = await this.client.setExecApprovals(file, hash);
        if (success) return;

        // Optimistic lock failed — retry
        if (attempt < maxRetries) {
          logger.warn(
            { attempt, pattern },
            "Optimistic lock conflict, retrying sync",
          );
        }
      } catch (err) {
        logger.error({ err, pattern, attempt }, "Sync attempt failed");
        if (attempt >= maxRetries) return;
      }
    }
    logger.error(
      { pattern },
      "Exhausted retries for OpenClaw allowlist sync",
    );
  }

  broadcastPatterns(): void {
    this.io.emit("safeclaw:allowlistState", {
      patterns: this.restrictedPatterns.map((p) => ({ pattern: p })),
    });
  }

  // --- Query methods ---

  getPendingApprovals(): ExecApprovalEntry[] {
    return Array.from(this.pending.values()).map((p) => p.entry);
  }

  getHistory(limit = 50): ExecApprovalEntry[] {
    try {
      const db = getDb();
      const rows = db
        .select()
        .from(schema.execApprovals)
        .where(sql`${schema.execApprovals.decision} IS NOT NULL`)
        .orderBy(desc(schema.execApprovals.decidedAt))
        .limit(limit)
        .all();
      return rows.map((r) => ({
        id: r.id,
        command: r.command,
        cwd: r.cwd,
        security: r.security,
        sessionKey: r.sessionKey,
        requestedAt: r.requestedAt,
        expiresAt: r.expiresAt,
        decision: r.decision as ExecDecision | null,
        decidedBy: r.decidedBy as "user" | "auto-deny" | "auto-approve" | "access-control" | null,
        decidedAt: r.decidedAt,
      }));
    } catch (err) {
      logger.error({ err }, "Failed to load approval history from database");
      return [];
    }
  }

  /**
   * Get total counts for exec approvals from the database.
   */
  getStats(): {
    total: number;
    blocked: number;
    allowed: number;
    pending: number;
  } {
    try {
      const db = getDb();
      const rows = db.select().from(schema.execApprovals).all();
      const decided = rows.filter((r) => r.decision !== null);
      const blocked = decided.filter((r) => r.decision === "deny").length;
      const allowed = decided.filter(
        (r) => r.decision === "allow-once" || r.decision === "allow-always",
      ).length;
      const pendingDb = rows.filter((r) => r.decision === null).length;
      // Include live pending approvals not yet in DB
      const livePending = this.pending.size;
      return {
        total: rows.length + livePending - pendingDb, // avoid double-counting DB pending
        blocked,
        allowed,
        pending: livePending,
      };
    } catch (err) {
      logger.error({ err }, "Failed to compute exec approval stats");
      return { total: 0, blocked: 0, allowed: 0, pending: 0 };
    }
  }

  /**
   * Clean up all pending timers on shutdown.
   */
  destroy(): void {
    for (const [, pending] of this.pending) {
      clearTimeout(pending.timer);
    }
    this.pending.clear();
  }
}

export function createExecApprovalService(
  client: OpenClawClient,
  io: TypedSocketServer,
  timeoutMs?: number,
): ExecApprovalService {
  if (instance) {
    instance.destroy();
  }
  instance = new ExecApprovalService(client, io, timeoutMs);
  return instance;
}

export function getExecApprovalService(): ExecApprovalService | null {
  return instance;
}
