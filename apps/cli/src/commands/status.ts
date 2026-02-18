import fs from "node:fs";
import Database from "better-sqlite3";
import { DB_PATH, CONFIG_PATH, SAFECLAW_DIR, OPENCLAW_CONFIG_PATH } from "../lib/paths.js";
import { readConfig } from "../lib/config.js";
import { VERSION } from "../lib/version.js";
import pc from "picocolors";

export interface StatusOptions {
  json: boolean;
}

export async function statusCommand(options: StatusOptions): Promise<void> {
  const exists = fs.existsSync(SAFECLAW_DIR);

  if (!exists) {
    if (options.json) {
      console.log(JSON.stringify({ initialized: false }, null, 2));
    } else {
      console.log(
        pc.yellow("SafeClaw is not initialized.") + " Run " + pc.cyan("safeclaw start") + " first.",
      );
    }
    return;
  }

  const config = readConfig();
  let logCount = 0;
  let activityCount = 0;
  const dbExists = fs.existsSync(DB_PATH);

  if (dbExists) {
    try {
      const sqlite = new Database(DB_PATH, { readonly: true });
      const cmdRow = sqlite.prepare("SELECT COUNT(*) as count FROM command_logs").get() as {
        count: number;
      };
      logCount = cmdRow.count;
      const actRow = sqlite.prepare("SELECT COUNT(*) as count FROM agent_activities").get() as {
        count: number;
      };
      activityCount = actRow.count;
      sqlite.close();
    } catch {
      logCount = -1;
      activityCount = -1;
    }
  }

  const openclawConfigExists = fs.existsSync(OPENCLAW_CONFIG_PATH);

  if (options.json) {
    const data = {
      version: VERSION,
      initialized: true,
      dataDir: SAFECLAW_DIR,
      database: dbExists ? "exists" : "not_found",
      config: fs.existsSync(CONFIG_PATH) ? "exists" : "not_found",
      port: config.port,
      autoOpenBrowser: config.autoOpenBrowser,
      premium: config.premium,
      commandLogs: logCount,
      agentActivities: activityCount,
      openclawConfigured: openclawConfigExists,
    };
    console.log(JSON.stringify(data, null, 2));
    return;
  }

  console.log(pc.bold("\nSafeClaw Status") + pc.dim(` v${VERSION}`));
  console.log(pc.dim("─".repeat(40)));
  console.log(`  ${pc.dim("Data dir:")}   ${SAFECLAW_DIR}`);
  console.log(`  ${pc.dim("Database:")}   ${dbExists ? pc.green("exists") : pc.red("not found")}`);
  console.log(
    `  ${pc.dim("Config:")}     ${fs.existsSync(CONFIG_PATH) ? pc.green("exists") : pc.red("not found")}`,
  );
  console.log(`  ${pc.dim("Port:")}       ${config.port}`);
  console.log(`  ${pc.dim("Auto-open:")}  ${config.autoOpenBrowser ? "Yes" : "No"}`);
  console.log(`  ${pc.dim("Premium:")}    ${config.premium ? "Yes" : "No"}`);
  console.log(
    `  ${pc.dim("Cmd logs:")}   ${logCount >= 0 ? logCount.toLocaleString() : pc.red("error reading")}`,
  );
  console.log(
    `  ${pc.dim("Activities:")} ${activityCount >= 0 ? activityCount.toLocaleString() : pc.red("error reading")}`,
  );
  console.log(
    `  ${pc.dim("OpenClaw:")}   ${openclawConfigExists ? pc.green("configured") : pc.yellow("not found")}`,
  );
  console.log();
}
