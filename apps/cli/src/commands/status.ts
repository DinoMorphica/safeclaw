import fs from "node:fs";
import Database from "better-sqlite3";
import { DB_PATH, CONFIG_PATH, SAFECLAW_DIR } from "../lib/paths.js";
import { readConfig } from "../lib/config.js";

export async function statusCommand(): Promise<void> {
  const exists = fs.existsSync(SAFECLAW_DIR);

  if (!exists) {
    console.log("SafeClaw is not initialized. Run 'safeclaw start' first.");
    return;
  }

  const config = readConfig();
  let logCount = 0;

  if (fs.existsSync(DB_PATH)) {
    try {
      const sqlite = new Database(DB_PATH, { readonly: true });
      const row = sqlite
        .prepare("SELECT COUNT(*) as count FROM command_logs")
        .get() as { count: number };
      logCount = row.count;
      sqlite.close();
    } catch {
      logCount = -1;
    }
  }

  console.log("SafeClaw Status");
  console.log("─".repeat(30));
  console.log(`  Data dir:   ${SAFECLAW_DIR}`);
  console.log(`  Database:   ${fs.existsSync(DB_PATH) ? "exists" : "not found"}`);
  console.log(`  Config:     ${fs.existsSync(CONFIG_PATH) ? "exists" : "not found"}`);
  console.log(`  Port:       ${config.port}`);
  console.log(`  Premium:    ${config.premium ? "Yes" : "No"}`);
  console.log(
    `  Logs saved: ${logCount >= 0 ? logCount.toLocaleString() : "error reading"}`,
  );
}
