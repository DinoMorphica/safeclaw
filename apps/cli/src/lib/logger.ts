import pino from "pino";
import { DEBUG_LOG_PATH, LOGS_DIR } from "./paths.js";
import fs from "node:fs";

if (!fs.existsSync(LOGS_DIR)) {
  fs.mkdirSync(LOGS_DIR, { recursive: true });
}

function createLogger(consoleLevel: string = "info"): pino.Logger {
  return pino({
    level: "debug",
    transport: {
      targets: [
        {
          target: "pino-pretty",
          options: { colorize: true },
          level: consoleLevel,
        },
        {
          target: "pino/file",
          options: { destination: DEBUG_LOG_PATH },
          level: "debug",
        },
      ],
    },
  });
}

export let logger = createLogger("info");

export function setVerbose(verbose: boolean): void {
  if (verbose) {
    logger = createLogger("debug");
  }
}
