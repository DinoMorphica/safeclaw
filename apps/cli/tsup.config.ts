import { defineConfig } from "tsup";
import pkg from "./package.json" with { type: "json" };

export default defineConfig({
  entry: ["src/main.ts"],
  format: ["esm"],
  target: "node20",
  outDir: "dist",
  clean: true,
  sourcemap: true,
  define: {
    "process.env.SAFECLAW_VERSION": JSON.stringify(pkg.version),
  },
  noExternal: ["@safeclaw/shared"],
  external: [
    "@fastify/cors",
    "@fastify/static",
    "better-sqlite3",
    "commander",
    "drizzle-orm",
    "fastify",
    "open",
    "picocolors",
    "pino",
    "pino-pretty",
    "socket.io",
    "ws",
    "zod",
  ],
});
