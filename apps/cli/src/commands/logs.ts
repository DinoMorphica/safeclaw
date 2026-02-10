import fs from "node:fs";
import pc from "picocolors";
import { DEBUG_LOG_PATH } from "../lib/paths.js";

export interface LogsOptions {
  lines: string;
  follow: boolean;
  clear: boolean;
}

export async function logsCommand(options: LogsOptions): Promise<void> {
  if (options.clear) {
    await clearLogs();
    return;
  }

  if (!fs.existsSync(DEBUG_LOG_PATH)) {
    console.log(
      pc.yellow("No log file found.") +
        " Run " +
        pc.cyan("safeclaw start") +
        " to generate logs.",
    );
    return;
  }

  if (options.follow) {
    await followLogs();
  } else {
    await tailLogs(parseInt(options.lines, 10) || 50);
  }
}

async function tailLogs(lineCount: number): Promise<void> {
  const content = fs.readFileSync(DEBUG_LOG_PATH, "utf-8");
  const lines = content.split("\n").filter(Boolean);
  const tail = lines.slice(-lineCount);

  if (tail.length === 0) {
    console.log(pc.dim("Log file is empty."));
    return;
  }

  console.log(
    pc.dim(`Showing last ${tail.length} lines from ${DEBUG_LOG_PATH}\n`),
  );
  for (const line of tail) {
    process.stdout.write(line + "\n");
  }
}

async function followLogs(): Promise<void> {
  console.log(pc.dim(`Following ${DEBUG_LOG_PATH} (Ctrl+C to stop)\n`));

  if (fs.existsSync(DEBUG_LOG_PATH)) {
    const content = fs.readFileSync(DEBUG_LOG_PATH, "utf-8");
    const lines = content.split("\n").filter(Boolean);
    const tail = lines.slice(-20);
    for (const line of tail) {
      process.stdout.write(line + "\n");
    }
  }

  let position = fs.existsSync(DEBUG_LOG_PATH)
    ? fs.statSync(DEBUG_LOG_PATH).size
    : 0;

  const watcher = fs.watch(DEBUG_LOG_PATH, () => {
    try {
      const stat = fs.statSync(DEBUG_LOG_PATH);
      if (stat.size > position) {
        const fd = fs.openSync(DEBUG_LOG_PATH, "r");
        const buffer = Buffer.alloc(stat.size - position);
        fs.readSync(fd, buffer, 0, buffer.length, position);
        fs.closeSync(fd);
        process.stdout.write(buffer.toString("utf-8"));
        position = stat.size;
      } else if (stat.size < position) {
        position = 0;
      }
    } catch {
      // File may have been deleted during watch
    }
  });

  process.on("SIGINT", () => {
    watcher.close();
    console.log(pc.dim("\nStopped following logs."));
    process.exit(0);
  });

  // Keep process alive
  await new Promise(() => {});
}

async function clearLogs(): Promise<void> {
  if (!fs.existsSync(DEBUG_LOG_PATH)) {
    console.log(pc.dim("No log file to clear."));
    return;
  }

  fs.writeFileSync(DEBUG_LOG_PATH, "");
  console.log(pc.green("Log file cleared."));
}
