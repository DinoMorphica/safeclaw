import { createAppServer } from "../server/index.js";
import { pushSchema } from "../db/migrate.js";
import { readConfig, ensureDataDir } from "../lib/config.js";
import { printBanner } from "../lib/banner.js";
import { logger, setVerbose } from "../lib/logger.js";
import pc from "picocolors";
import open from "open";

export interface StartOptions {
  port?: string;
  open: boolean;
  verbose: boolean;
}

export async function startCommand(options: StartOptions): Promise<void> {
  if (options.verbose) {
    setVerbose(true);
    logger.debug("Verbose logging enabled");
  }

  ensureDataDir();
  const config = readConfig();

  const port = options.port ? parseInt(options.port, 10) : config.port;

  if (isNaN(port) || port < 1024 || port > 65535) {
    process.stderr.write(
      pc.red(`Invalid port: ${options.port}. Must be between 1024 and 65535.\n`),
    );
    process.exit(1);
  }

  pushSchema();
  printBanner(port);

  try {
    const { app, monitor } = await createAppServer(port);
    await app.listen({ port, host: "0.0.0.0" });
    logger.info(`Server listening on http://localhost:${port}`);

    const shouldOpen = options.open && config.autoOpenBrowser;
    if (shouldOpen) {
      await open(`http://localhost:${port}`);
    }

    const shutdown = async () => {
      logger.info("Shutting down SafeClaw...");
      monitor.stop();
      await app.close();
      process.exit(0);
    };

    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
  } catch (err: unknown) {
    const error = err as NodeJS.ErrnoException;
    if (error.code === "EADDRINUSE") {
      process.stderr.write(
        pc.red(`\nPort ${port} is already in use.\n`) +
          pc.dim(`Try: safeclaw start --port ${port + 1}\n`) +
          pc.dim(`Or stop the process using port ${port} first.\n`),
      );
      process.exit(1);
    }
    if (error.code === "EACCES") {
      process.stderr.write(
        pc.red(`\nPermission denied for port ${port}.\n`) +
          pc.dim(`Ports below 1024 require elevated privileges.\n`) +
          pc.dim(`Try: safeclaw start --port 54335\n`),
      );
      process.exit(1);
    }
    throw err;
  }
}
