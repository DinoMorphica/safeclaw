export interface ParsedActivity {
  toolName: string;
  phase: "start" | "update" | "result" | "unknown";
  toolCallId: string;
  runId: string; // Interaction/run identifier
  args: Record<string, unknown>;
  meta: string | Record<string, unknown>;
  result?: unknown;
  isError: boolean;
  sensitiveFields: {
    path?: string;
    command?: string;
    url?: string;
    recipient?: string;
  };
}

function extractSensitiveFields(
  args: Record<string, unknown>,
  toolName: string,
): ParsedActivity["sensitiveFields"] {
  const sensitive: ParsedActivity["sensitiveFields"] = {};

  const lowerTool = toolName.toLowerCase();

  // File operations
  if (
    lowerTool.includes("file") ||
    lowerTool.includes("read") ||
    lowerTool.includes("write") ||
    lowerTool.includes("edit")
  ) {
    sensitive.path = (args.path ?? args.file_path ?? args.file) as
      | string
      | undefined;
  }

  // Shell/exec operations
  if (
    lowerTool.includes("exec") ||
    lowerTool.includes("shell") ||
    lowerTool.includes("bash") ||
    lowerTool.includes("command")
  ) {
    sensitive.command = (args.command ?? args.cmd) as string | undefined;
  }

  // Web/browser operations
  if (
    lowerTool.includes("browser") ||
    lowerTool.includes("browse") ||
    lowerTool.includes("web") ||
    lowerTool.includes("fetch") ||
    lowerTool.includes("http")
  ) {
    sensitive.url = (args.url ?? args.uri) as string | undefined;
  }

  // Message operations
  if (
    lowerTool.includes("message") ||
    lowerTool.includes("send") ||
    lowerTool.includes("whatsapp") ||
    lowerTool.includes("sms")
  ) {
    sensitive.recipient = (args.to ?? args.recipient ?? args.target) as
      | string
      | undefined;
  }

  return sensitive;
}

function defaultParsedActivity(): ParsedActivity {
  return {
    toolName: "unknown",
    phase: "unknown",
    toolCallId: "",
    runId: "",
    args: {},
    meta: "",
    result: undefined,
    isError: false,
    sensitiveFields: {},
  };
}

export function parseRawPayload(rawPayload: string): ParsedActivity {
  try {
    const event = JSON.parse(rawPayload) as {
      type?: string;
      event?: string;
      payload?: {
        runId?: string;
        data?: {
          name?: string;
          phase?: string;
          toolCallId?: string;
          args?: Record<string, unknown>;
          meta?: string | Record<string, unknown>;
          result?: unknown;
          isError?: boolean;
        };
      };
    };

    const payload = event?.payload ?? {};
    const data = payload.data ?? {};

    // Extract fields
    const toolName = (data.name ?? "unknown") as string;
    const phase = (data.phase ?? "unknown") as ParsedActivity["phase"];
    const args = (data.args ?? {}) as Record<string, unknown>;
    const toolCallId = (data.toolCallId ?? "") as string;
    const runId = (payload.runId ?? "") as string;
    const meta = data.meta ?? "";
    const result = data.result;
    const isError = data.isError ?? false;

    // Extract sensitive fields based on tool type
    const sensitiveFields = extractSensitiveFields(args, toolName);

    return {
      toolName,
      phase,
      toolCallId,
      runId,
      args,
      meta,
      result,
      isError,
      sensitiveFields,
    };
  } catch (error) {
    // If parsing fails, return default
    return defaultParsedActivity();
  }
}
