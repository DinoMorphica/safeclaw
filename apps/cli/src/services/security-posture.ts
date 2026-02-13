import type {
  SecurityPosture,
  SecurityLayer,
  SecurityCheck,
  SecurityLayerStatus,
} from "@safeclaw/shared";
import fs from "node:fs";
import { readOpenClawConfig } from "../lib/openclaw-config.js";
import { OPENCLAW_DEVICE_JSON } from "../lib/paths.js";
import { deriveAccessState } from "./access-control.js";
import { getOpenClawMonitor } from "./openclaw-monitor.js";
import { getDb, schema } from "../db/index.js";
import { eq, ne, and, sql } from "drizzle-orm";

function buildLayer(
  id: string,
  name: string,
  checks: SecurityCheck[],
): SecurityLayer {
  const passedCount = checks.filter((c) => c.passed).length;
  const totalCount = checks.length;
  let status: SecurityLayerStatus;
  if (passedCount === totalCount) {
    status = "configured";
  } else if (passedCount === 0) {
    status = "unconfigured";
  } else {
    status = "partial";
  }
  return { id, name, status, checks, passedCount, totalCount };
}

function checkSandboxLayer(): SecurityLayer {
  const config = readOpenClawConfig();
  const sandbox = config?.agents?.defaults?.sandbox;
  const mode = sandbox?.mode;
  const workspaceAccess = sandbox?.workspaceAccess;
  const dockerNetwork = sandbox?.docker?.network;

  const checks: SecurityCheck[] = [
    {
      id: "sandbox-mode",
      label: "Sandbox mode enabled",
      passed: mode === "all" || mode === "non-main",
      detail: mode
        ? `Sandbox mode is "${mode}"`
        : "Sandbox mode is not configured",
      severity: "critical",
    },
    {
      id: "sandbox-workspace",
      label: "Workspace access restricted",
      passed: workspaceAccess === "ro" || workspaceAccess === "none",
      detail: workspaceAccess
        ? `Workspace access is "${workspaceAccess}"`
        : "Workspace access not configured (defaults to rw)",
      severity: "warning",
    },
    {
      id: "sandbox-network",
      label: "Docker network isolated",
      passed: dockerNetwork != null && dockerNetwork !== "host",
      detail: dockerNetwork
        ? `Docker network set to "${dockerNetwork}"`
        : "Docker network not configured",
      severity: "info",
    },
  ];

  return buildLayer("sandbox", "Sandbox Isolation", checks);
}

function checkFilesystemLayer(): SecurityLayer {
  const accessState = deriveAccessState();
  const fsToggle = accessState.toggles.find((t) => t.category === "filesystem");
  const config = readOpenClawConfig();
  const workspace = config?.agents?.defaults?.workspace;
  const workspaceAccess = config?.agents?.defaults?.sandbox?.workspaceAccess;

  const checks: SecurityCheck[] = [
    {
      id: "fs-toggle",
      label: "Filesystem access controlled",
      passed: fsToggle != null && !fsToggle.enabled,
      detail: fsToggle?.enabled === false
        ? "Filesystem tool group is disabled"
        : "Filesystem tool group is enabled (agent has file access)",
      severity: "warning",
    },
    {
      id: "fs-workspace",
      label: "Workspace path configured",
      passed: workspace != null && workspace.length > 0,
      detail: workspace
        ? `Workspace: ${workspace}`
        : "No explicit workspace path configured",
      severity: "info",
    },
    {
      id: "fs-workspace-restriction",
      label: "Workspace access restricted",
      passed: workspaceAccess === "ro" || workspaceAccess === "none",
      detail: workspaceAccess
        ? `Workspace access level: "${workspaceAccess}"`
        : "Workspace access not restricted (defaults to rw)",
      severity: "warning",
    },
  ];

  return buildLayer("filesystem", "Filesystem Access", checks);
}

function checkNetworkLayer(): SecurityLayer {
  const accessState = deriveAccessState();
  const netToggle = accessState.toggles.find((t) => t.category === "network");
  const config = readOpenClawConfig();
  const browserEnabled = config?.browser?.enabled;
  const sandbox = config?.agents?.defaults?.sandbox;
  const dockerNetwork = sandbox?.docker?.network;
  const sandboxMode = sandbox?.mode;

  const checks: SecurityCheck[] = [
    {
      id: "net-toggle",
      label: "Network access controlled",
      passed: netToggle != null && !netToggle.enabled,
      detail: netToggle?.enabled === false
        ? "Network tool group is disabled"
        : "Network tool group is enabled",
      severity: "warning",
    },
    {
      id: "net-browser",
      label: "Browser disabled",
      passed: browserEnabled === false,
      detail: browserEnabled === false
        ? "Browser is disabled"
        : "Browser is enabled (agent can browse web)",
      severity: "info",
    },
    {
      id: "net-docker-isolation",
      label: "Network isolated in sandbox",
      passed:
        (sandboxMode === "all" || sandboxMode === "non-main") &&
        dockerNetwork != null &&
        dockerNetwork !== "host",
      detail:
        sandboxMode === "all" || sandboxMode === "non-main"
          ? dockerNetwork && dockerNetwork !== "host"
            ? `Sandboxed with isolated network "${dockerNetwork}"`
            : "Sandboxed but no network isolation configured"
          : "Not sandboxed — no network isolation",
      severity: "critical",
    },
  ];

  return buildLayer("network", "Network & Egress Control", checks);
}

async function checkCommandExecLayer(): Promise<SecurityLayer> {
  const accessState = deriveAccessState();
  const sysToggle = accessState.toggles.find(
    (t) => t.category === "system_commands",
  );
  const config = readOpenClawConfig();
  const execSecurity = config?.tools?.exec?.security;

  const db = getDb();
  const patternRows = await db.select().from(schema.restrictedPatterns);
  const patternCount = patternRows.length;
  const patternTexts = patternRows.map((r) => r.pattern.toLowerCase());

  const criticalPatterns = ["sudo", "rm -rf", "chmod", "curl"];
  const hasCritical = criticalPatterns.some((cp) =>
    patternTexts.some((pt) => pt.includes(cp)),
  );

  const checks: SecurityCheck[] = [
    {
      id: "exec-toggle",
      label: "System commands controlled",
      passed: sysToggle != null && !sysToggle.enabled,
      detail: sysToggle?.enabled === false
        ? "System commands tool group is disabled"
        : "System commands tool group is enabled",
      severity: "warning",
    },
    {
      id: "exec-security-mode",
      label: "Exec security mode restrictive",
      passed: execSecurity === "deny" || execSecurity === "allowlist",
      detail: execSecurity
        ? `Exec security mode: "${execSecurity}"`
        : "Exec security mode not configured",
      severity: "critical",
    },
    {
      id: "exec-patterns",
      label: "Restricted patterns configured",
      passed: patternCount > 0,
      detail: patternCount > 0
        ? `${patternCount} restricted pattern(s) in blocklist`
        : "No restricted patterns — all commands pass through",
      severity: "warning",
    },
    {
      id: "exec-critical-patterns",
      label: "Critical command patterns blocked",
      passed: hasCritical,
      detail: hasCritical
        ? "Critical patterns (sudo, rm -rf, chmod, curl|bash) present"
        : "No critical patterns found — consider adding sudo, rm -rf, chmod",
      severity: "critical",
    },
  ];

  return buildLayer("exec", "Command Execution Controls", checks);
}

function checkMcpLayer(): SecurityLayer {
  const accessState = deriveAccessState();
  const mcpToggle = accessState.toggles.find(
    (t) => t.category === "mcp_servers",
  );
  const servers = accessState.mcpServers;
  const config = readOpenClawConfig();
  const denyList = config?.tools?.deny ?? [];
  const mcpDenyEntries = denyList.filter((d) => d.startsWith("mcp__"));

  const totalServers = servers.length;
  const enabledServers = servers.filter((s) => s.effectivelyEnabled).length;
  const disabledServers = totalServers - enabledServers;

  const checks: SecurityCheck[] = [
    {
      id: "mcp-toggle",
      label: "MCP servers controlled",
      passed: mcpToggle != null && accessState.openclawConfigAvailable,
      detail: !accessState.openclawConfigAvailable
        ? "OpenClaw config unavailable"
        : mcpToggle?.enabled
          ? "MCP servers toggle is enabled"
          : "MCP servers toggle is disabled (all servers blocked)",
      severity: "info",
    },
    {
      id: "mcp-server-review",
      label: "Servers individually reviewed",
      passed: totalServers === 0 || disabledServers > 0 || mcpDenyEntries.length > 0,
      detail:
        totalServers === 0
          ? "No MCP servers configured"
          : disabledServers > 0
            ? `${disabledServers}/${totalServers} server(s) disabled`
            : "All servers enabled — consider reviewing each server",
      severity: "warning",
    },
    {
      id: "mcp-tools-deny",
      label: "MCP tools in deny list",
      passed: mcpDenyEntries.length > 0,
      detail:
        mcpDenyEntries.length > 0
          ? `${mcpDenyEntries.length} MCP tool deny entr(ies) configured`
          : "No MCP-specific deny entries",
      severity: "info",
    },
  ];

  return buildLayer("mcp", "MCP Server Security", checks);
}

async function checkSecretLayer(): Promise<SecurityLayer> {
  const db = getDb();

  const secretActivities = await db
    .select()
    .from(schema.agentActivities)
    .where(
      and(
        eq(schema.agentActivities.resolved, 0),
        sql`${schema.agentActivities.threatFindings} LIKE '%TC-SEC%'`,
      ),
    );

  const sfaActivities = await db
    .select()
    .from(schema.agentActivities)
    .where(
      and(
        eq(schema.agentActivities.resolved, 0),
        sql`${schema.agentActivities.threatFindings} LIKE '%TC-SFA%'`,
      ),
    );

  const checks: SecurityCheck[] = [
    {
      id: "secret-scanner",
      label: "Secret scanner active",
      passed: true,
      detail: "Built-in secret scanner is always active",
      severity: "info",
    },
    {
      id: "secret-exposure",
      label: "No unresolved secret exposures",
      passed: secretActivities.length === 0,
      detail:
        secretActivities.length === 0
          ? "No unresolved secret exposure threats"
          : `${secretActivities.length} unresolved secret exposure threat(s)`,
      severity: "critical",
    },
    {
      id: "secret-file-access",
      label: "No unresolved sensitive file access",
      passed: sfaActivities.length === 0,
      detail:
        sfaActivities.length === 0
          ? "No unresolved sensitive file access threats"
          : `${sfaActivities.length} unresolved sensitive file access threat(s)`,
      severity: "warning",
    },
  ];

  return buildLayer("secrets", "Secret & Credential Protection", checks);
}

async function checkThreatMonitoringLayer(): Promise<SecurityLayer> {
  const monitor = getOpenClawMonitor();
  const connectionStatus = monitor?.getStatus() ?? "not_configured";
  const config = readOpenClawConfig();

  const db = getDb();
  const activeSessions = await db
    .select({ count: sql<number>`count(*)` })
    .from(schema.openclawSessions)
    .where(eq(schema.openclawSessions.status, "ACTIVE"));

  const totalThreats = await db
    .select({ count: sql<number>`count(*)` })
    .from(schema.agentActivities)
    .where(ne(schema.agentActivities.threatLevel, "NONE"));

  const resolvedThreats = await db
    .select({ count: sql<number>`count(*)` })
    .from(schema.agentActivities)
    .where(
      and(
        ne(schema.agentActivities.threatLevel, "NONE"),
        eq(schema.agentActivities.resolved, 1),
      ),
    );

  const total = totalThreats[0]?.count ?? 0;
  const resolved = resolvedThreats[0]?.count ?? 0;
  const resolutionRate = total > 0 ? Math.round((resolved / total) * 100) : 100;

  const checks: SecurityCheck[] = [
    {
      id: "monitor-connection",
      label: "OpenClaw connected",
      passed: connectionStatus === "connected",
      detail:
        connectionStatus === "connected"
          ? "Connected to OpenClaw gateway"
          : config
            ? `Connection status: ${connectionStatus}`
            : "OpenClaw config not found",
      severity: "critical",
    },
    {
      id: "monitor-sessions",
      label: "Session tracking active",
      passed: (activeSessions[0]?.count ?? 0) > 0 || connectionStatus === "connected",
      detail:
        (activeSessions[0]?.count ?? 0) > 0
          ? `${activeSessions[0].count} active session(s)`
          : connectionStatus === "connected"
            ? "Connected, no active sessions"
            : "No active sessions (disconnected)",
      severity: "info",
    },
    {
      id: "monitor-resolution",
      label: "Threats being resolved",
      passed: resolutionRate >= 50 || total === 0,
      detail:
        total === 0
          ? "No threats detected yet"
          : `${resolved}/${total} threats resolved (${resolutionRate}%)`,
      severity: "warning",
    },
  ];

  return buildLayer("monitoring", "Threat Monitoring", checks);
}

async function checkHumanInLoopLayer(): Promise<SecurityLayer> {
  const monitor = getOpenClawMonitor();

  const db = getDb();
  const patternRows = await db.select().from(schema.restrictedPatterns);
  const patternCount = patternRows.length;

  const totalApprovals = await db
    .select({ count: sql<number>`count(*)` })
    .from(schema.execApprovals);

  const timedOut = await db
    .select({ count: sql<number>`count(*)` })
    .from(schema.execApprovals)
    .where(eq(schema.execApprovals.decidedBy, "auto-deny"));

  const total = totalApprovals[0]?.count ?? 0;
  const timedOutCount = timedOut[0]?.count ?? 0;
  const timeoutRate = total > 0 ? Math.round((timedOutCount / total) * 100) : 0;

  const checks: SecurityCheck[] = [
    {
      id: "hitl-active",
      label: "Exec approval system active",
      passed: monitor != null,
      detail: monitor
        ? "Exec approval system is running"
        : "Exec approval system not initialized",
      severity: "critical",
    },
    {
      id: "hitl-timeout-rate",
      label: "Approval timeout rate acceptable",
      passed: timeoutRate < 20 || total === 0,
      detail:
        total === 0
          ? "No approval requests yet"
          : `${timedOutCount}/${total} approvals timed out (${timeoutRate}%)`,
      severity: "warning",
    },
    {
      id: "hitl-patterns",
      label: "Restricted patterns configured",
      passed: patternCount > 0,
      detail:
        patternCount > 0
          ? `${patternCount} restricted pattern(s) for interception`
          : "No restricted patterns — nothing to intercept",
      severity: "warning",
    },
  ];

  return buildLayer("human-in-loop", "Human-in-the-Loop Controls", checks);
}

async function checkEgressProxyLayer(): Promise<SecurityLayer> {
  const proxyConfigured = !!(
    process.env.HTTP_PROXY ||
    process.env.HTTPS_PROXY ||
    process.env.http_proxy ||
    process.env.https_proxy
  );

  const noProxy =
    process.env.NO_PROXY || process.env.no_proxy || "";
  const proxyBypassed = noProxy.trim() === "*";

  const db = getDb();
  const exfilActivities = await db
    .select({ count: sql<number>`count(*)` })
    .from(schema.agentActivities)
    .where(
      and(
        eq(schema.agentActivities.resolved, 0),
        sql`${schema.agentActivities.threatFindings} LIKE '%TC-EXF%'`,
      ),
    );

  const netActivities = await db
    .select({ count: sql<number>`count(*)` })
    .from(schema.agentActivities)
    .where(
      and(
        eq(schema.agentActivities.resolved, 0),
        sql`${schema.agentActivities.threatFindings} LIKE '%TC-NET%'`,
      ),
    );

  const exfilCount = exfilActivities[0]?.count ?? 0;
  const netCount = netActivities[0]?.count ?? 0;

  const checks: SecurityCheck[] = [
    {
      id: "egress-proxy-configured",
      label: "Egress proxy configured",
      passed: proxyConfigured,
      detail: proxyConfigured
        ? "HTTP/HTTPS proxy environment variables are set"
        : "No proxy configured — agent traffic is not filtered",
      severity: "warning",
    },
    {
      id: "egress-no-proxy-safe",
      label: "Proxy not globally bypassed",
      passed: !proxyBypassed,
      detail: proxyBypassed
        ? "NO_PROXY is set to '*' — all proxy filtering is bypassed"
        : noProxy
          ? `NO_PROXY exceptions: ${noProxy}`
          : "No NO_PROXY exceptions set",
      severity: "critical",
    },
    {
      id: "egress-exfiltration-clean",
      label: "No unresolved exfiltration threats",
      passed: exfilCount === 0,
      detail:
        exfilCount === 0
          ? "No unresolved data exfiltration threats"
          : `${exfilCount} unresolved exfiltration threat(s)`,
      severity: "critical",
    },
    {
      id: "egress-network-threats-clean",
      label: "No unresolved network threats",
      passed: netCount === 0,
      detail:
        netCount === 0
          ? "No unresolved network threats"
          : `${netCount} unresolved network threat(s)`,
      severity: "warning",
    },
  ];

  return buildLayer("egress-proxy", "Egress Proxy & Domain Filtering", checks);
}

function checkGatewaySecurityLayer(): SecurityLayer {
  const config = readOpenClawConfig();
  const deviceExists = fs.existsSync(OPENCLAW_DEVICE_JSON);

  const authMode = (config as Record<string, unknown> | null)?.gateway
    ? ((config as Record<string, unknown>).gateway as Record<string, unknown>)
        ?.auth
      ? (
          ((config as Record<string, unknown>).gateway as Record<string, unknown>)
            .auth as Record<string, unknown>
        )?.mode
      : undefined
    : undefined;

  const gwBind = (config as Record<string, unknown> | null)?.gateway
    ? ((config as Record<string, unknown>).gateway as Record<string, unknown>)
        ?.bind
    : undefined;
  const bindLocal =
    gwBind === undefined ||
    gwBind === null ||
    gwBind === "127.0.0.1" ||
    gwBind === "localhost";

  const channels = config?.channels as
    | Record<string, unknown>
    | undefined;
  const whatsapp = channels?.whatsapp as
    | Record<string, unknown>
    | undefined;
  const allowFrom = whatsapp?.allowFrom as unknown[] | undefined;
  const channelRestricted =
    !whatsapp || (Array.isArray(allowFrom) && allowFrom.length > 0);

  const checks: SecurityCheck[] = [
    {
      id: "gw-device-identity",
      label: "Device identity configured",
      passed: deviceExists,
      detail: deviceExists
        ? "Ed25519 device identity file exists"
        : "No device identity found — gateway authentication unavailable",
      severity: "critical",
    },
    {
      id: "gw-auth-mode",
      label: "Gateway authentication enabled",
      passed: authMode != null && authMode !== "",
      detail: authMode
        ? `Gateway auth mode: "${authMode}"`
        : "Gateway auth mode not configured",
      severity: "critical",
    },
    {
      id: "gw-bind-local",
      label: "Gateway bound to localhost",
      passed: bindLocal,
      detail: bindLocal
        ? `Gateway bind: ${gwBind ?? "default (localhost)"}`
        : `Gateway bound to ${gwBind} — accessible from network`,
      severity: "warning",
    },
    {
      id: "gw-channel-restricted",
      label: "External channels restricted",
      passed: channelRestricted,
      detail: channelRestricted
        ? whatsapp
          ? `WhatsApp allowFrom has ${allowFrom?.length ?? 0} entry/entries`
          : "No external channels configured"
        : "WhatsApp is open to all senders — restrict with allowFrom",
      severity: "info",
    },
  ];

  return buildLayer("gateway", "Gateway & Inbound Security", checks);
}

async function checkSupplyChainLayer(): Promise<SecurityLayer> {
  const db = getDb();
  const supplyThreats = await db
    .select({ count: sql<number>`count(*)` })
    .from(schema.agentActivities)
    .where(
      and(
        eq(schema.agentActivities.resolved, 0),
        sql`${schema.agentActivities.threatFindings} LIKE '%TC-SUP%'`,
      ),
    );

  const patternRows = await db.select().from(schema.restrictedPatterns);
  const patternTexts = patternRows.map((r) => r.pattern.toLowerCase());
  const supplyKeywords = ["npm install", "pip install", "brew install", "curl"];
  const hasSupplyPattern = supplyKeywords.some((kw) =>
    patternTexts.some((pt) => pt.includes(kw)),
  );

  const config = readOpenClawConfig();
  const execSecurity = config?.tools?.exec?.security;

  const supplyCount = supplyThreats[0]?.count ?? 0;

  const checks: SecurityCheck[] = [
    {
      id: "supply-chain-threats-clean",
      label: "No unresolved supply chain threats",
      passed: supplyCount === 0,
      detail:
        supplyCount === 0
          ? "No unresolved supply chain threats"
          : `${supplyCount} unresolved supply chain threat(s)`,
      severity: "critical",
    },
    {
      id: "supply-exec-restricted",
      label: "Package install commands restricted",
      passed: hasSupplyPattern,
      detail: hasSupplyPattern
        ? "Restricted patterns cover package install commands"
        : "No restricted patterns for npm install, pip install, curl, etc.",
      severity: "warning",
    },
    {
      id: "supply-exec-mode",
      label: "Exec security prevents blind installs",
      passed: execSecurity === "deny" || execSecurity === "allowlist",
      detail: execSecurity
        ? `Exec security mode: "${execSecurity}"`
        : "Exec security mode not configured",
      severity: "warning",
    },
  ];

  return buildLayer("supply-chain", "Supply Chain Protection", checks);
}

async function checkInputOutputLayer(): Promise<SecurityLayer> {
  const db = getDb();
  const injectionThreats = await db
    .select({ count: sql<number>`count(*)` })
    .from(schema.agentActivities)
    .where(
      and(
        eq(schema.agentActivities.resolved, 0),
        sql`${schema.agentActivities.threatFindings} LIKE '%TC-INJ%'`,
      ),
    );

  const mcpPoisoning = await db
    .select({ count: sql<number>`count(*)` })
    .from(schema.agentActivities)
    .where(
      and(
        eq(schema.agentActivities.resolved, 0),
        sql`${schema.agentActivities.threatFindings} LIKE '%TC-MCP%'`,
      ),
    );

  const injCount = injectionThreats[0]?.count ?? 0;
  const mcpCount = mcpPoisoning[0]?.count ?? 0;

  const checks: SecurityCheck[] = [
    {
      id: "io-injection-clean",
      label: "No unresolved prompt injection threats",
      passed: injCount === 0,
      detail:
        injCount === 0
          ? "No unresolved prompt injection threats"
          : `${injCount} unresolved prompt injection threat(s)`,
      severity: "critical",
    },
    {
      id: "io-mcp-poisoning-clean",
      label: "No unresolved MCP poisoning threats",
      passed: mcpCount === 0,
      detail:
        mcpCount === 0
          ? "No unresolved MCP tool poisoning threats"
          : `${mcpCount} unresolved MCP tool poisoning threat(s)`,
      severity: "critical",
    },
    {
      id: "io-content-scanner-active",
      label: "Content threat scanner active",
      passed: true,
      detail: "Built-in 10-category threat classifier is always active",
      severity: "info",
    },
    {
      id: "io-skill-scanner-available",
      label: "Skill definition scanner available",
      passed: true,
      detail: "Built-in SK-* skill scanner is available for MCP auditing",
      severity: "info",
    },
  ];

  return buildLayer("input-output", "Input/Output Validation", checks);
}

export async function computeSecurityPosture(): Promise<SecurityPosture> {
  const [
    execLayer,
    egressLayer,
    secretLayer,
    supplyChainLayer,
    inputOutputLayer,
    monitoringLayer,
    humanLayer,
  ] = await Promise.all([
    checkCommandExecLayer(),
    checkEgressProxyLayer(),
    checkSecretLayer(),
    checkSupplyChainLayer(),
    checkInputOutputLayer(),
    checkThreatMonitoringLayer(),
    checkHumanInLoopLayer(),
  ]);

  const layers: SecurityLayer[] = [
    checkSandboxLayer(),
    checkFilesystemLayer(),
    checkNetworkLayer(),
    egressLayer,
    execLayer,
    checkMcpLayer(),
    checkGatewaySecurityLayer(),
    secretLayer,
    supplyChainLayer,
    inputOutputLayer,
    monitoringLayer,
    humanLayer,
  ];

  const totalChecks = layers.reduce((sum, l) => sum + l.totalCount, 0);
  const passedChecks = layers.reduce((sum, l) => sum + l.passedCount, 0);
  const overallScore =
    totalChecks > 0 ? Math.round((passedChecks / totalChecks) * 100) : 0;

  return {
    layers,
    overallScore,
    configuredLayers: layers.filter((l) => l.status === "configured").length,
    partialLayers: layers.filter((l) => l.status === "partial").length,
    unconfiguredLayers: layers.filter((l) => l.status === "unconfigured").length,
    totalLayers: layers.length,
    checkedAt: new Date().toISOString(),
  };
}
