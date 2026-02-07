import { createAppServer } from "../server/index.js";
import { pushSchema } from "../db/migrate.js";
import { readConfig, ensureDataDir } from "../lib/config.js";
import { printBanner } from "../lib/banner.js";
import { logger } from "../lib/logger.js";
import open from "open";

export async function startCommand(): Promise<void> {
  ensureDataDir();
  const config = readConfig();

  pushSchema();

  printBanner(config.port);

  const { app, monitor } = await createAppServer(config.port);

  await app.listen({ port: config.port, host: "0.0.0.0" });
  logger.info(`Server listening on http://localhost:${config.port}`);

  if (config.autoOpenBrowser) {
    await open(`http://localhost:${config.port}`);
  }

  const shutdown = async () => {
    logger.info("Shutting down SafeClaw...");
    monitor.stop();
    await app.close();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}
