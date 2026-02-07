import { defineConfig } from "drizzle-kit";
import path from "node:path";
import os from "node:os";

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "sqlite",
  dbCredentials: {
    url: path.join(os.homedir(), ".safeclaw", "safeclaw.db"),
  },
});
