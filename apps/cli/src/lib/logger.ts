import pino from "pino";
import { DEBUG_LOG_PATH, LOGS_DIR } from "./paths.js";
import fs from "node:fs";

if (!fs.existsSync(LOGS_DIR)) {
  fs.mkdirSync(LOGS_DIR, { recursive: true });
}

export const logger = pino({
  level: "debug",
  transport: {
    targets: [
      {
        target: "pino-pretty",
        options: { colorize: true },
        level: "info",
      },
      {
        target: "pino/file",
        options: { destination: DEBUG_LOG_PATH },
        level: "debug",
      },
    ],
  },
});
