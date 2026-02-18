import { EventEmitter } from "node:events";
import crypto from "node:crypto";
import fs from "node:fs";
import { WebSocket } from "ws";
import { readOpenClawConfig } from "./openclaw-config.js";
import { OPENCLAW_DEVICE_JSON, OPENCLAW_DEVICE_AUTH_JSON } from "./paths.js";
import { logger } from "./logger.js";
import type { OpenClawConnectionStatus, ActivityType } from "@safeclaw/shared";

// --- Protocol message types ---

interface GatewayRequest {
  type: "req";
  id: string;
  method: string;
  params: Record<string, unknown>;
}

interface GatewayResponse {
  type: "res";
  id: string;
  ok: boolean;
  payload?: Record<string, unknown>;
  error?: {
    code: string;
    message: string;
  };
}

interface GatewayEvent {
  type: "event";
  event: string;
  seq?: number;
  stateVersion?: number;
  payload?: Record<string, unknown>;
}

type GatewayMessage = GatewayRequest | GatewayResponse | GatewayEvent;

// --- Parsed activity (emitted to monitor) ---

export interface ParsedActivity {
  openclawSessionId: string;
  activityType: ActivityType;
  detail: string;
  rawPayload: string;
  toolName: string | null;
  targetPath: string | null;
  timestamp: string;
  runId: string | null;
}

export interface ExecApprovalRequest {
  id: string;
  command: string;
  cwd: string;
  security: string;
  sessionKey: string;
}

export interface OpenClawAllowlistEntry {
  id: string;
  pattern: string;
  lastUsedAt?: number;
  lastUsedCommand?: string;
  lastResolvedPath?: string;
}

export interface ExecApprovalsFile {
  version: number;
  defaults?: Record<string, unknown>;
  agents?: Record<
    string,
    {
      allowlist?: OpenClawAllowlistEntry[];
      [key: string]: unknown;
    }
  >;
  [key: string]: unknown;
}

export interface ExecApprovalsGetResult {
  file: ExecApprovalsFile;
  hash: string;
}

// --- Typed EventEmitter ---

// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
export declare interface OpenClawClient {
  on(event: "activity", listener: (parsed: ParsedActivity) => void): this;
  on(event: "sessionStart", listener: (sessionId: string, model?: string) => void): this;
  on(event: "sessionEnd", listener: (sessionId: string) => void): this;
  on(event: "statusChange", listener: (status: OpenClawConnectionStatus) => void): this;
  on(event: "execApproval", listener: (request: ExecApprovalRequest) => void): this;
  emit(event: "activity", parsed: ParsedActivity): boolean;
  emit(event: "sessionStart", sessionId: string, model?: string): boolean;
  emit(event: "sessionEnd", sessionId: string): boolean;
  emit(event: "statusChange", status: OpenClawConnectionStatus): boolean;
  emit(event: "execApproval", request: ExecApprovalRequest): boolean;
}

// --- Device identity & auth helpers ---

interface DeviceIdentity {
  deviceId: string;
  publicKeyPem: string;
  privateKeyPem: string;
}

function readDeviceIdentity(): DeviceIdentity | null {
  try {
    const raw = fs.readFileSync(OPENCLAW_DEVICE_JSON, "utf-8");
    const data = JSON.parse(raw) as {
      deviceId?: string;
      publicKeyPem?: string;
      privateKeyPem?: string;
    };
    if (!data.deviceId || !data.publicKeyPem || !data.privateKeyPem) return null;
    return {
      deviceId: data.deviceId,
      publicKeyPem: data.publicKeyPem,
      privateKeyPem: data.privateKeyPem,
    };
  } catch {
    return null;
  }
}

function _readDeviceAuthToken(): string | null {
  try {
    const raw = fs.readFileSync(OPENCLAW_DEVICE_AUTH_JSON, "utf-8");
    const data = JSON.parse(raw) as {
      tokens?: Record<string, { token?: string }>;
    };
    return data.tokens?.operator?.token ?? null;
  } catch {
    return null;
  }
}

function base64UrlEncode(buf: Buffer): string {
  return buf.toString("base64url");
}

function publicKeyPemToRawBase64Url(pem: string): string {
  const key = crypto.createPublicKey(pem);
  // Export as raw (32-byte Ed25519 public key via JWK)
  const jwk = key.export({ format: "jwk" }) as { x?: string };
  if (!jwk.x) throw new Error("Failed to extract raw public key");
  // JWK x is base64url-encoded already
  return jwk.x;
}

function buildDeviceAuthPayload(params: {
  deviceId: string;
  clientId: string;
  clientMode: string;
  role: string;
  scopes: string[];
  signedAtMs: number;
  token: string | null;
}): string {
  return [
    "v1",
    params.deviceId,
    params.clientId,
    params.clientMode,
    params.role,
    params.scopes.join(","),
    String(params.signedAtMs),
    params.token ?? "",
  ].join("|");
}

function signDevicePayload(privateKeyPem: string, payload: string): string {
  const key = crypto.createPrivateKey(privateKeyPem);
  const sig = crypto.sign(null, Buffer.from(payload, "utf-8"), key);
  return base64UrlEncode(sig);
}

// --- Client ---

// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
export class OpenClawClient extends EventEmitter {
  private ws: WebSocket | null = null;
  private status: OpenClawConnectionStatus = "disconnected";
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 20;
  private baseReconnectDelay = 2000;
  private destroyed = false;
  private pendingRequests = new Map<
    string,
    { resolve: (res: GatewayResponse) => void; timer: ReturnType<typeof setTimeout> }
  >();
  private activeSessions = new Set<string>();

  connect(): void {
    if (this.destroyed) return;

    const config = readOpenClawConfig();
    if (!config?.gateway) {
      this.setStatus("not_configured");
      return;
    }

    const port = config.gateway.port ?? 18789;

    // Read device identity (Ed25519 keypair) from OpenClaw's identity store
    const identity = readDeviceIdentity();
    if (!identity) {
      logger.warn("OpenClaw device identity not found at ~/.openclaw/identity/device.json");
      this.setStatus("not_configured");
      return;
    }

    // Read gateway auth token from config (this is the gateway connection token)
    const gatewayToken = config.gateway.auth?.token ?? null;
    if (!gatewayToken) {
      logger.warn("OpenClaw gateway auth token not found in config");
      this.setStatus("not_configured");
      return;
    }

    this.setStatus("connecting");

    try {
      const url = `ws://127.0.0.1:${port}`;
      this.ws = new WebSocket(url);

      this.ws.on("open", () => {
        logger.info(`WebSocket open to OpenClaw gateway on port ${port}`);
        // Don't set connected yet — wait for challenge then hello-ok
      });

      this.ws.on("message", (data) => {
        try {
          const msg = JSON.parse(String(data)) as GatewayMessage;
          this.handleMessage(msg, identity, gatewayToken);
        } catch (err) {
          logger.warn({ err }, "Failed to parse OpenClaw gateway message");
        }
      });

      this.ws.on("close", (code, reason) => {
        logger.info({ code, reason: reason.toString() }, "OpenClaw gateway connection closed");
        this.cleanupPendingRequests();
        this.setStatus("disconnected");
        this.scheduleReconnect();
      });

      this.ws.on("error", (err) => {
        logger.debug({ err: err.message }, "OpenClaw WebSocket error");
      });
    } catch (err) {
      logger.error({ err }, "Failed to create OpenClaw WebSocket connection");
      this.setStatus("disconnected");
      this.scheduleReconnect();
    }
  }

  // --- Message dispatcher ---

  private handleMessage(msg: GatewayMessage, identity: DeviceIdentity, gatewayToken: string): void {
    switch (msg.type) {
      case "event":
        this.handleEvent(msg as GatewayEvent, identity, gatewayToken);
        break;
      case "res":
        this.handleResponse(msg as GatewayResponse);
        break;
      case "req":
        // Gateway-initiated requests (rare) — ignore for now
        break;
    }
  }

  // --- Event handler ---

  private handleEvent(evt: GatewayEvent, identity: DeviceIdentity, gatewayToken: string): void {
    switch (evt.event) {
      case "connect.challenge":
        this.sendConnectRequest(identity, gatewayToken, evt.payload);
        break;

      case "tick":
        // Keepalive — no action needed, connection stays alive
        break;

      case "agent":
        this.handleAgentEvent(evt);
        break;

      case "chat":
        this.handleChatEvent(evt);
        break;

      case "presence":
        // Presence deltas — not actionable for monitoring
        break;

      case "exec.approval.requested":
        this.handleExecApproval(evt);
        break;

      case "shutdown":
        logger.info("OpenClaw gateway shutting down");
        break;

      default:
        logger.debug({ event: evt.event }, "Unhandled OpenClaw event type");
    }
  }

  // --- Connect handshake ---

  private async sendConnectRequest(
    identity: DeviceIdentity,
    gatewayToken: string,
    _challengePayload?: Record<string, unknown>,
  ): Promise<void> {
    try {
      const clientId = "gateway-client";
      const clientMode = "backend";
      const role = "operator";
      const scopes = ["operator.read", "operator.approvals"];
      const signedAtMs = Date.now();

      // Build and sign the device auth payload
      const payload = buildDeviceAuthPayload({
        deviceId: identity.deviceId,
        clientId,
        clientMode,
        role,
        scopes,
        signedAtMs,
        token: gatewayToken,
      });
      const signature = signDevicePayload(identity.privateKeyPem, payload);
      const publicKey = publicKeyPemToRawBase64Url(identity.publicKeyPem);

      const res = await this.sendRequest("connect", {
        minProtocol: 3,
        maxProtocol: 3,
        client: {
          id: clientId,
          version: "1.0.0",
          platform: process.platform,
          mode: clientMode,
        },
        role,
        scopes,
        caps: [],
        device: {
          id: identity.deviceId,
          publicKey,
          signature,
          signedAt: signedAtMs,
        },
        auth: { token: gatewayToken },
        locale: "en-US",
        userAgent: "safeclaw-monitor/1.0.0",
      });

      if (res.ok && res.payload?.type === "hello-ok") {
        this.reconnectAttempts = 0;
        this.setStatus("connected");
        logger.info("Successfully connected to OpenClaw gateway (hello-ok)");
      } else {
        logger.error({ error: res.error }, "OpenClaw connect handshake rejected");
        this.ws?.close();
      }
    } catch (err) {
      logger.error({ err }, "OpenClaw connect handshake failed");
      this.ws?.close();
    }
  }

  // --- Agent event parsing ---

  private handleAgentEvent(evt: GatewayEvent): void {
    const payload = evt.payload ?? {};
    const sessionKey = (payload.sessionKey as string) ?? "unknown";
    const stream = payload.stream as string | undefined;
    const data = (payload.data ?? {}) as Record<string, unknown>;
    const ts = payload.ts as number | undefined;
    const timestamp = ts ? new Date(ts).toISOString() : new Date().toISOString();

    // Track session lifecycle via lifecycle stream
    if (stream === "lifecycle") {
      const phase = data.phase as string;
      if (phase === "start") {
        if (!this.activeSessions.has(sessionKey)) {
          this.activeSessions.add(sessionKey);
          this.emit("sessionStart", sessionKey);
        }
      } else if (phase === "end" || phase === "error") {
        if (this.activeSessions.has(sessionKey)) {
          this.activeSessions.delete(sessionKey);
          this.emit("sessionEnd", sessionKey);
        }
      }
      return;
    }

    // Parse tool invocations
    if (stream === "tool") {
      const toolName = (data.name ?? data.toolName ?? "unknown") as string;
      const phase = data.phase as string | undefined;
      const args = (data.args ?? {}) as Record<string, unknown>;
      const metaRaw = data.meta;
      const meta: Record<string, unknown> =
        typeof metaRaw === "object" && metaRaw !== null
          ? (metaRaw as Record<string, unknown>)
          : typeof metaRaw === "string"
            ? { description: metaRaw }
            : {};

      const parsed = this.parseToolActivity(
        sessionKey,
        toolName,
        phase ?? "start",
        args,
        meta,
        JSON.stringify(evt),
        timestamp,
      );
      if (parsed) {
        this.emit("activity", parsed);
      }
      return;
    }

    // Skip assistant output - it's just text responses, not security-relevant tool invocations
    // We only want to track actual tool usage (file ops, shell commands, messages, web browsing)
    if (stream === "assistant") {
      return; // Don't emit assistant text as activities
    }

    // Compaction events — log but don't emit as activities
    if (stream === "compaction") {
      logger.debug({ sessionKey }, "OpenClaw context compaction event");
    }
  }

  // --- Chat event parsing (WhatsApp, etc.) ---

  private handleChatEvent(evt: GatewayEvent): void {
    const payload = evt.payload ?? {};
    const sessionKey = (payload.sessionKey as string) ?? "unknown";
    const state = payload.state as string | undefined;
    const status = payload.status as string | undefined;
    const message = payload.message as Record<string, unknown> | undefined;
    const ts = payload.ts as number | undefined;
    const timestamp = ts ? new Date(ts).toISOString() : new Date().toISOString();
    const runId = (payload.runId as string) ?? null;

    // Extract channel from sessionKey (e.g. "whatsapp:dm:+1234" or "agent:main:main")
    let channel = "unknown";
    const parts = sessionKey.split(":");
    if (parts.length >= 1) {
      channel = parts[0]; // "whatsapp", "slack", "telegram", "agent", etc.
    }

    // Determine target from sessionKey
    let targetPath: string | null = null;
    if (parts.length >= 3) {
      targetPath = parts.slice(2).join(":"); // e.g., "+1234" from "whatsapp:dm:+1234"
    }

    // Chat events can have either "state" (delta/final) or "status" (started/ok/error)
    const eventState = state ?? status;

    // Skip intermediate deltas - only capture final messages or status changes
    if (eventState === "delta") {
      return;
    }

    // Extract message role and content if available
    const _role = message?.role as string | undefined;
    const content = message?.content as unknown[];
    let messageText = "";
    if (Array.isArray(content)) {
      messageText = content
        .filter((item: unknown) => (item as Record<string, unknown>)?.type === "text")
        .map((item: unknown) => (item as Record<string, unknown>)?.text)
        .join(" ")
        .slice(0, 100); // Truncate for detail display
    }

    const detail =
      eventState === "final"
        ? `${channel} message: ${messageText || "(sent)"}`
        : eventState === "started"
          ? `${channel} message sent`
          : eventState === "ok"
            ? `${channel} message delivered`
            : eventState === "error"
              ? `${channel} message failed`
              : `${channel} message (${eventState ?? "unknown"})`;

    const activity: ParsedActivity = {
      openclawSessionId: sessionKey,
      activityType: "message",
      detail,
      rawPayload: JSON.stringify(evt),
      toolName: channel,
      targetPath,
      timestamp,
      runId,
    };
    this.emit("activity", activity);

    // Track session lifecycle for non-agent chat messages
    if (channel !== "agent" && eventState === "started" && !this.activeSessions.has(sessionKey)) {
      this.activeSessions.add(sessionKey);
      this.emit("sessionStart", sessionKey);
    }
  }

  // --- Exec approval event handling ---

  private handleExecApproval(evt: GatewayEvent): void {
    const payload = evt.payload ?? {};
    const request = (payload.request ?? {}) as Record<string, unknown>;
    const sessionKey = (request.sessionKey as string) ?? "unknown";

    const approval: ExecApprovalRequest = {
      id: (payload.id as string) ?? "unknown",
      command: (request.command as string) ?? "",
      cwd: (request.cwd as string) ?? "",
      security: (request.security as string) ?? "normal",
      sessionKey,
    };

    logger.info(
      { command: approval.command, security: approval.security },
      "Exec approval requested by OpenClaw agent",
    );

    this.emit("execApproval", approval);

    // Also emit as a shell_command activity for the monitoring feed
    const activity: ParsedActivity = {
      openclawSessionId: sessionKey,
      activityType: "shell_command",
      detail: `[APPROVAL] ${approval.command}`,
      rawPayload: JSON.stringify(evt),
      toolName: "exec",
      targetPath: null,
      timestamp: new Date().toISOString(),
      runId: null,
    };
    this.emit("activity", activity);
  }

  // --- Tool → Activity type mapping ---

  private parseToolActivity(
    sessionId: string,
    toolName: string,
    phase: string,
    args: Record<string, unknown>,
    meta: Record<string, unknown>,
    rawPayload: string,
    timestamp: string,
  ): ParsedActivity | null {
    let activityType: ActivityType = "tool_call";
    let detail: string = `Tool: ${toolName} (${phase})`; // eslint-disable-line no-useless-assignment
    let targetPath: string | null = null;

    const lowerTool = toolName.toLowerCase();

    if (lowerTool === "read" || lowerTool === "attach") {
      activityType = "file_read";
      targetPath = (args.path ?? args.file_path ?? args.url) as string | null;
      detail = `Read ${targetPath ?? "unknown file"}`;
    } else if (
      lowerTool === "write" ||
      lowerTool === "edit" ||
      lowerTool === "create" ||
      lowerTool === "patch" ||
      lowerTool === "apply_patch"
    ) {
      activityType = "file_write";
      targetPath = (args.path ?? args.file_path ?? args.file) as string | null;
      detail = `${lowerTool === "edit" ? "Edit" : lowerTool === "apply_patch" ? "Patch" : "Write"} ${targetPath ?? "unknown file"}`;
    } else if (
      lowerTool === "exec" ||
      lowerTool === "bash" ||
      lowerTool === "shell" ||
      lowerTool === "command" ||
      lowerTool === "terminal"
    ) {
      activityType = "shell_command";
      const cmd = (args.command ?? args.cmd ?? "") as string;
      detail = cmd || `Shell: ${toolName}`;
      targetPath = null;
    } else if (
      lowerTool === "browser" ||
      lowerTool === "browse" ||
      lowerTool === "fetch" ||
      lowerTool === "web" ||
      lowerTool === "http" ||
      lowerTool === "url"
    ) {
      activityType = "web_browse";
      targetPath = (args.url ?? args.uri) as string | null;
      const action = (args.action ?? "") as string;
      detail = action
        ? `Browse: ${action}${targetPath ? ` ${targetPath}` : ""}`
        : `Browse ${targetPath ?? "unknown URL"}`;
    } else if (
      lowerTool === "message" ||
      lowerTool === "send" ||
      lowerTool === "whatsapp" ||
      lowerTool === "sms" ||
      lowerTool === "notify"
    ) {
      activityType = "message";
      const to = (args.to ?? args.target ?? args.recipient) as string | null;
      const provider = (args.provider ?? "") as string;
      const action = (args.action ?? "send") as string;
      detail = `${provider || toolName} ${action}${to ? ` to ${to}` : ""}`;
      targetPath = to;
    } else {
      // Keep as tool_call for unrecognized tools (canvas, nodes, cron, gateway, process, etc.)
      const desc = (meta.description ?? "") as string;
      const action = (args.action ?? "") as string;
      detail = desc
        ? `${toolName}: ${desc}`
        : action
          ? `${toolName}: ${action}`
          : `Tool: ${toolName}`;
    }

    return {
      openclawSessionId: sessionId,
      activityType,
      detail,
      rawPayload,
      toolName,
      targetPath,
      timestamp,
      runId: null,
    };
  }

  // --- Request/response ---

  private sendRequest(method: string, params: Record<string, unknown>): Promise<GatewayResponse> {
    return new Promise((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        return reject(new Error("WebSocket not open"));
      }

      const id = crypto.randomUUID();
      const msg: GatewayRequest = { type: "req", id, method, params };

      const timer = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`Request ${method} timed out`));
      }, 10000);

      this.pendingRequests.set(id, { resolve, timer });
      this.ws.send(JSON.stringify(msg));
    });
  }

  private handleResponse(res: GatewayResponse): void {
    const pending = this.pendingRequests.get(res.id);
    if (pending) {
      clearTimeout(pending.timer);
      this.pendingRequests.delete(res.id);
      pending.resolve(res);
    }
  }

  private cleanupPendingRequests(): void {
    for (const [id, pending] of this.pendingRequests) {
      clearTimeout(pending.timer);
      this.pendingRequests.delete(id);
    }
  }

  // --- Reconnection ---

  private scheduleReconnect(): void {
    if (this.destroyed) return;
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      logger.warn("Max reconnect attempts reached for OpenClaw gateway");
      return;
    }

    const delay = Math.min(this.baseReconnectDelay * Math.pow(1.5, this.reconnectAttempts), 30000);
    this.reconnectAttempts++;
    logger.info(
      `Reconnecting to OpenClaw in ${Math.round(delay)}ms (attempt ${this.reconnectAttempts})`,
    );

    this.reconnectTimer = setTimeout(() => this.connect(), delay);
  }

  // --- Status ---

  private setStatus(status: OpenClawConnectionStatus): void {
    if (this.status !== status) {
      this.status = status;
      this.emit("statusChange", status);
    }
  }

  getStatus(): OpenClawConnectionStatus {
    return this.status;
  }

  // --- Exec approval resolution ---

  async resolveExecApproval(
    approvalId: string,
    decision: "allow-once" | "allow-always" | "deny",
  ): Promise<boolean> {
    try {
      const res = await this.sendRequest("exec.approval.resolve", {
        id: approvalId,
        decision,
      });
      if (res.ok) {
        logger.info({ approvalId, decision }, "Exec approval resolved");
        return true;
      }
      logger.error({ approvalId, decision, error: res.error }, "Exec approval resolution rejected");
      return false;
    } catch (err) {
      logger.error({ err, approvalId, decision }, "Failed to resolve exec approval");
      return false;
    }
  }

  // --- Exec approvals file management (via gateway) ---

  async getExecApprovals(): Promise<ExecApprovalsGetResult | null> {
    try {
      const res = await this.sendRequest("exec.approvals.get", {});
      if (res.ok && res.payload) {
        return {
          file: res.payload.file as ExecApprovalsFile,
          hash: res.payload.hash as string,
        };
      }
      logger.error({ error: res.error }, "Failed to get exec approvals from gateway");
      return null;
    } catch (err) {
      logger.error({ err }, "Failed to get exec approvals from gateway");
      return null;
    }
  }

  async setExecApprovals(file: ExecApprovalsFile, baseHash: string): Promise<boolean> {
    try {
      const res = await this.sendRequest("exec.approvals.set", {
        file,
        baseHash,
      });
      if (res.ok) {
        logger.info("Successfully updated exec approvals via gateway");
        return true;
      }
      logger.error({ error: res.error }, "Failed to set exec approvals on gateway");
      return false;
    } catch (err) {
      logger.error({ err }, "Failed to set exec approvals on gateway");
      return false;
    }
  }

  // --- Lifecycle ---

  reconnect(): void {
    this.reconnectAttempts = 0;
    this.disconnect();
    this.connect();
  }

  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.cleanupPendingRequests();
    if (this.ws) {
      this.ws.removeAllListeners();
      this.ws.close();
      this.ws = null;
    }
    this.setStatus("disconnected");
  }

  destroy(): void {
    this.destroyed = true;
    this.disconnect();
    this.removeAllListeners();
  }
}
