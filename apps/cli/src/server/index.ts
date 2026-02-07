import Fastify from "fastify";
import fastifyStatic from "@fastify/static";
import fastifyCors from "@fastify/cors";
import fs from "node:fs";
import { getPublicDir } from "../lib/paths.js";
import { setupSocketIO } from "./socket.js";
import { registerRoutes } from "./routes.js";
import { logger } from "../lib/logger.js";
import { createOpenClawMonitor } from "../services/openclaw-monitor.js";

export async function createAppServer(port: number) {
  const app = Fastify({
    logger: false,
  });

  await app.register(fastifyCors, { origin: "*" });

  await registerRoutes(app);

  const publicDir = getPublicDir();
  if (
    fs.existsSync(publicDir) &&
    fs.readdirSync(publicDir).filter((f) => f !== ".gitkeep").length > 0
  ) {
    await app.register(fastifyStatic, {
      root: publicDir,
      prefix: "/",
      wildcard: true,
    });

    app.setNotFoundHandler(async (request, reply) => {
      if (
        request.url.startsWith("/api/") ||
        request.url.startsWith("/socket.io/")
      ) {
        return reply.status(404).send({ error: "Not found" });
      }
      return reply.sendFile("index.html");
    });
  } else {
    logger.warn(
      "No frontend build found in public/. Run 'pnpm build:web' first.",
    );
  }

  await app.ready();
  const httpServer = app.server;

  const io = setupSocketIO(httpServer);

  const monitor = createOpenClawMonitor(io);
  monitor.start();

  return { app, io, httpServer, monitor };
}
