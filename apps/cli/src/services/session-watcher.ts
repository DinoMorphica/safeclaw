import { EventEmitter } from "node:events";
import fs from "node:fs";
import path from "node:path";
import { logger } from "../lib/logger.js";
import { OPENCLAW_DIR } from "../lib/paths.js";
import type { ActivityType } from "@safeclaw/shared";

// Max content preview size (10KB)
const MAX_CONTENT_PREVIEW = 10 * 1024;

// --- JSONL entry types ---

interface JournalEntry {
  type: string;
  id: string;
  parentId: string | null;
  timestamp: string;
  message?: {
    role: string;
    content?: ContentItem[];
    timestamp?: number;
  };
  customType?: string;
  data?: Record<string, unknown>;
}

interface ContentItem {
  type: string;
  text?: string;
  id?: string;
  name?: string;
  arguments?: Record<string, unknown>;
  thinking?: string;
  toolCallId?: string;
}

// --- Parsed activity emitted from the watcher ---

export interface SessionFileActivity {
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
}

// --- Typed emitter ---

export declare interface SessionWatcher {
  on(event: "activity", listener: (activity: SessionFileActivity) => void): this;
  emit(event: "activity", activity: SessionFileActivity): boolean;
}

// --- Watcher implementation ---

interface WatchedFile {
  path: string;
  position: number;
  watcher: fs.FSWatcher | null;
  sessionId: string;
  agentName: string;
}

export class SessionWatcher extends EventEmitter {
  private watchedFiles = new Map<string, WatchedFile>();
  private agentsDirWatcher: fs.FSWatcher | null = null;
  private scanInterval: ReturnType<typeof setInterval> | null = null;
  private destroyed = false;

  // Track current runId (user message id) per session file
  private currentRunIds = new Map<string, string>();

  // Track processed tool call IDs to avoid duplicates
  private processedToolCalls = new Set<string>();

  // Map toolCallId → pending tool call info for matching with results
  private pendingToolCalls = new Map<
    string,
    { activityType: ActivityType; toolName: string; targetPath: string | null; detail: string; sessionId: string; runId: string | null; timestamp: string }
  >();

  // Cache read content by "runId:targetPath" so writes can reference what was read
  private recentReadContent = new Map<string, string>();

  start(): void {
    if (this.destroyed) return;

    const agentsDir = path.join(OPENCLAW_DIR, "agents");
    if (!fs.existsSync(agentsDir)) {
      logger.debug("OpenClaw agents directory not found, will retry");
    }

    // Initial scan
    this.scanForSessions();

    // Periodic scan for new sessions (every 10 seconds)
    this.scanInterval = setInterval(() => {
      if (!this.destroyed) this.scanForSessions();
    }, 10000);

    // Watch agents directory for new agent dirs
    try {
      if (fs.existsSync(agentsDir)) {
        this.agentsDirWatcher = fs.watch(agentsDir, { recursive: true }, () => {
          if (!this.destroyed) this.scanForSessions();
        });
      }
    } catch {
      // Recursive watch may not be supported on all platforms
    }

    logger.info("Session file watcher started");
  }

  stop(): void {
    this.destroyed = true;

    if (this.scanInterval) {
      clearInterval(this.scanInterval);
      this.scanInterval = null;
    }

    if (this.agentsDirWatcher) {
      this.agentsDirWatcher.close();
      this.agentsDirWatcher = null;
    }

    for (const watched of this.watchedFiles.values()) {
      if (watched.watcher) {
        watched.watcher.close();
      }
    }
    this.watchedFiles.clear();

    logger.info("Session file watcher stopped");
  }

  private scanForSessions(): void {
    const agentsDir = path.join(OPENCLAW_DIR, "agents");
    if (!fs.existsSync(agentsDir)) return;

    try {
      const agentNames = fs.readdirSync(agentsDir).filter((name) => {
        const stat = fs.statSync(path.join(agentsDir, name));
        return stat.isDirectory();
      });

      for (const agentName of agentNames) {
        this.discoverSessionFiles(agentName);
      }
    } catch (err) {
      logger.debug({ err }, "Failed to scan agents directory");
    }
  }

  private discoverSessionFiles(agentName: string): void {
    const sessionsDir = path.join(OPENCLAW_DIR, "agents", agentName, "sessions");
    if (!fs.existsSync(sessionsDir)) return;

    // Read sessions.json to find active sessions
    const sessionsJsonPath = path.join(sessionsDir, "sessions.json");
    if (fs.existsSync(sessionsJsonPath)) {
      try {
        const raw = fs.readFileSync(sessionsJsonPath, "utf-8");
        const sessionsData = JSON.parse(raw) as Record<string, unknown>;
        const sessions = (sessionsData.sessions ?? []) as Array<{ id: string; file?: string }>;

        for (const session of sessions) {
          const jsonlFile = session.file
            ? path.join(sessionsDir, session.file)
            : path.join(sessionsDir, `${session.id}.jsonl`);
          this.watchSessionFile(jsonlFile, session.id, agentName);
        }
      } catch (err) {
        logger.debug({ err, agentName }, "Failed to read sessions.json");
      }
    }

    // Also scan for any .jsonl files not listed in sessions.json
    try {
      const files = fs.readdirSync(sessionsDir).filter((f) => f.endsWith(".jsonl"));
      for (const file of files) {
        const filePath = path.join(sessionsDir, file);
        const sessionId = path.basename(file, ".jsonl");
        this.watchSessionFile(filePath, sessionId, agentName);
      }
    } catch {
      // Ignore read errors
    }
  }

  private watchSessionFile(filePath: string, sessionId: string, agentName: string): void {
    if (this.watchedFiles.has(filePath)) return;
    if (!fs.existsSync(filePath)) return;

    const stat = fs.statSync(filePath);
    const watched: WatchedFile = {
      path: filePath,
      position: stat.size, // Start from current end (don't replay history)
      watcher: null,
      sessionId,
      agentName,
    };

    try {
      watched.watcher = fs.watch(filePath, () => {
        if (!this.destroyed) {
          this.readNewEntries(watched);
        }
      });
    } catch (err) {
      logger.debug({ err, filePath }, "Failed to watch session file");
      return;
    }

    this.watchedFiles.set(filePath, watched);
    logger.info({ sessionId, agentName }, "Watching session JSONL file");
  }

  private readNewEntries(watched: WatchedFile): void {
    try {
      const stat = fs.statSync(watched.path);
      if (stat.size <= watched.position) return;

      const fd = fs.openSync(watched.path, "r");
      const bufferSize = stat.size - watched.position;
      const buffer = Buffer.alloc(bufferSize);
      fs.readSync(fd, buffer, 0, bufferSize, watched.position);
      fs.closeSync(fd);

      watched.position = stat.size;

      const text = buffer.toString("utf-8");
      const lines = text.split("\n").filter((l) => l.trim());

      for (const line of lines) {
        try {
          const entry = JSON.parse(line) as JournalEntry;
          this.processEntry(entry, watched.sessionId);
        } catch {
          // Skip malformed lines
        }
      }
    } catch (err) {
      logger.debug({ err, path: watched.path }, "Failed to read new JSONL entries");
    }
  }

  private processEntry(entry: JournalEntry, openclawSessionId: string): void {
    if (entry.type !== "message" || !entry.message) return;

    const { role, content } = entry.message;
    const fileKey = openclawSessionId;

    // User messages mark the start of a new interaction run
    if (role === "user") {
      // Clear cached read content from previous interaction
      const previousRunId = this.currentRunIds.get(fileKey);
      if (previousRunId) {
        for (const key of this.recentReadContent.keys()) {
          if (key.startsWith(`${previousRunId}:`)) {
            this.recentReadContent.delete(key);
          }
        }
      }
      this.currentRunIds.set(fileKey, entry.id);
      return;
    }

    const currentRunId = this.currentRunIds.get(fileKey) ?? null;

    // Assistant messages may contain tool calls
    if (role === "assistant" && Array.isArray(content)) {
      for (const item of content) {
        if (item.type === "toolCall" && item.id && item.name) {
          if (this.processedToolCalls.has(item.id)) continue;
          this.processedToolCalls.add(item.id);

          const args = (item.arguments ?? {}) as Record<string, unknown>;
          const { activityType, detail, targetPath } = this.mapToolToActivity(
            item.name,
            args,
          );

          // Store pending tool call for content matching
          const timestamp = entry.timestamp || new Date().toISOString();
          this.pendingToolCalls.set(item.id, {
            activityType,
            toolName: item.name,
            targetPath,
            detail,
            sessionId: openclawSessionId,
            runId: currentRunId,
            timestamp,
          });

          // Emit the tool call activity immediately (without content)
          const activity: SessionFileActivity = {
            openclawSessionId,
            activityType,
            detail,
            rawPayload: JSON.stringify(entry),
            toolName: item.name,
            targetPath,
            timestamp,
            runId: currentRunId,
            contentPreview: null,
            readContentPreview: null,
          };
          this.emit("activity", activity);
        }
      }
      return;
    }

    // Tool results contain the actual content (file content, command output)
    if (role === "toolResult" && Array.isArray(content)) {
      const toolCallId = (entry.message as Record<string, unknown>).toolCallId as string | undefined;
      if (!toolCallId) return;

      const pending = this.pendingToolCalls.get(toolCallId);
      if (!pending) return;
      this.pendingToolCalls.delete(toolCallId);

      // Extract text content from tool result
      let contentPreview: string | null = null;
      const textParts: string[] = [];
      for (const item of content) {
        if (item.type === "text" && item.text) {
          textParts.push(item.text);
        }
      }
      if (textParts.length > 0) {
        const fullContent = textParts.join("\n");
        contentPreview = fullContent.length > MAX_CONTENT_PREVIEW
          ? fullContent.slice(0, MAX_CONTENT_PREVIEW) + "...[truncated]"
          : fullContent;
      }

      // Emit a content update activity (enriches the tool call with content)
      if (contentPreview) {
        // For file reads: cache the content so subsequent writes can reference it
        if (pending.activityType === "file_read" && pending.targetPath && pending.runId) {
          this.recentReadContent.set(`${pending.runId}:${pending.targetPath}`, contentPreview);
        }

        // For file writes: look up cached read content for the same file in this run
        let readContentPreview: string | null = null;
        if (pending.activityType === "file_write" && pending.targetPath && pending.runId) {
          readContentPreview = this.recentReadContent.get(`${pending.runId}:${pending.targetPath}`) ?? null;
        }

        const activity: SessionFileActivity = {
          openclawSessionId: pending.sessionId,
          activityType: pending.activityType,
          detail: `${pending.detail} [result]`,
          rawPayload: JSON.stringify(entry),
          toolName: pending.toolName,
          targetPath: pending.targetPath,
          timestamp: entry.timestamp || new Date().toISOString(),
          runId: pending.runId,
          contentPreview,
          readContentPreview,
        };
        this.emit("activity", activity);
      }

      return;
    }
  }

  private mapToolToActivity(
    toolName: string,
    args: Record<string, unknown>,
  ): { activityType: ActivityType; detail: string; targetPath: string | null } {
    const lower = toolName.toLowerCase();

    if (lower === "read" || lower === "attach") {
      const targetPath = (args.path ?? args.file_path ?? args.url) as string | null;
      return {
        activityType: "file_read",
        detail: `Read ${targetPath ?? "unknown file"}`,
        targetPath,
      };
    }

    if (lower === "write" || lower === "edit" || lower === "create" || lower === "patch" || lower === "apply_patch" || lower === "notebook_edit") {
      const targetPath = (args.path ?? args.file_path ?? args.file ?? args.notebook_path) as string | null;
      const verb = lower === "edit" ? "Edit" : lower === "apply_patch" ? "Patch" : lower === "notebook_edit" ? "Edit notebook" : "Write";
      return {
        activityType: "file_write",
        detail: `${verb} ${targetPath ?? "unknown file"}`,
        targetPath,
      };
    }

    if (lower === "exec" || lower === "bash" || lower === "shell" || lower === "command" || lower === "terminal") {
      const cmd = (args.command ?? args.cmd ?? "") as string;
      return {
        activityType: "shell_command",
        detail: cmd || `Shell: ${toolName}`,
        targetPath: null,
      };
    }

    if (lower === "browser" || lower === "browse" || lower === "fetch" || lower === "web" || lower === "http" || lower === "url") {
      const targetPath = (args.url ?? args.uri) as string | null;
      return {
        activityType: "web_browse",
        detail: `Browse ${targetPath ?? "unknown URL"}`,
        targetPath,
      };
    }

    if (lower === "message" || lower === "send" || lower === "whatsapp" || lower === "sms" || lower === "notify") {
      const to = (args.to ?? args.target ?? args.recipient) as string | null;
      return {
        activityType: "message",
        detail: `${toolName} send${to ? ` to ${to}` : ""}`,
        targetPath: to,
      };
    }

    // Glob, grep, and other search tools
    if (lower === "glob" || lower === "grep" || lower === "search" || lower === "find") {
      const pattern = (args.pattern ?? args.query ?? "") as string;
      return {
        activityType: "file_read",
        detail: `${toolName}: ${pattern}`,
        targetPath: null,
      };
    }

    return {
      activityType: "tool_call",
      detail: `Tool: ${toolName}`,
      targetPath: null,
    };
  }
}
