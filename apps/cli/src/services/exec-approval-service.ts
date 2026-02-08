import { logger } from "../lib/logger.js";
import type {
  OpenClawClient,
  ExecApprovalRequest,
} from "../lib/openclaw-client.js";
import type { TypedSocketServer } from "../server/socket.js";
import type {
  ExecApprovalEntry,
  ExecDecision,
} from "@safeclaw/shared";

const DEFAULT_TIMEOUT_MS = 30_000; // 30 seconds

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
function matchesPattern(command: string, pattern: string): boolean {
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&");
  const regexStr = "^" + escaped.replace(/\*/g, ".*") + "$";
  return new RegExp(regexStr, "i").test(command);
}

export class ExecApprovalService {
  private client: OpenClawClient;
  private io: TypedSocketServer;
  private pending = new Map<string, PendingApproval>();
  private history: ExecApprovalEntry[] = [];
  private timeoutMs: number;
  /** Restricted command patterns — commands matching these need user approval */
  private restrictedPatterns: string[] = [];

  constructor(
    client: OpenClawClient,
    io: TypedSocketServer,
    timeoutMs = DEFAULT_TIMEOUT_MS,
  ) {
    this.client = client;
    this.io = io;
    this.timeoutMs = timeoutMs;
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
      // Not restricted → auto-approve immediately
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
        decidedBy: "auto-deny", // reuse field: "auto-deny" here means "auto-decision"
        decidedAt: now.toISOString(),
      };

      // Don't add auto-approved commands to history to reduce noise
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
    this.addToHistory(entry);

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
    this.addToHistory(entry);

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
      logger.info({ pattern: trimmed }, "Added restricted command pattern");
    }
    this.broadcastPatterns();
    return [...this.restrictedPatterns];
  }

  removeRestrictedPattern(pattern: string): string[] {
    this.restrictedPatterns = this.restrictedPatterns.filter(
      (p) => p !== pattern,
    );
    logger.info({ pattern }, "Removed restricted command pattern");
    this.broadcastPatterns();
    return [...this.restrictedPatterns];
  }

  broadcastPatterns(): void {
    this.io.emit("safeclaw:allowlistState", {
      patterns: this.restrictedPatterns.map((p) => ({ pattern: p })),
    });
  }

  // --- History management ---

  private addToHistory(entry: ExecApprovalEntry): void {
    this.history.unshift(entry);
    if (this.history.length > 200) {
      this.history = this.history.slice(0, 200);
    }
  }

  // --- Query methods ---

  getPendingApprovals(): ExecApprovalEntry[] {
    return Array.from(this.pending.values()).map((p) => p.entry);
  }

  getHistory(limit = 50): ExecApprovalEntry[] {
    return this.history.slice(0, limit);
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
