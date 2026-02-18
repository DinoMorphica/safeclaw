import fs from "node:fs";
import readline from "node:readline/promises";
import { DB_PATH } from "../lib/paths.js";
import { resetConfig } from "../lib/config.js";
import pc from "picocolors";

export interface ResetOptions {
  force: boolean;
}

export async function resetCommand(options: ResetOptions): Promise<void> {
  if (!options.force) {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    const answer = await rl.question(
      pc.yellow("This will delete the database and reset config to defaults.\n") +
        "Are you sure? (y/N) ",
    );
    rl.close();

    if (answer.toLowerCase() !== "y" && answer.toLowerCase() !== "yes") {
      console.log("Reset cancelled.");
      return;
    }
  }

  console.log(pc.bold("Resetting SafeClaw..."));

  if (fs.existsSync(DB_PATH)) {
    fs.unlinkSync(DB_PATH);
    const walPath = DB_PATH + "-wal";
    const shmPath = DB_PATH + "-shm";
    if (fs.existsSync(walPath)) fs.unlinkSync(walPath);
    if (fs.existsSync(shmPath)) fs.unlinkSync(shmPath);
    console.log(pc.green("  Database deleted."));
  } else {
    console.log(pc.dim("  No database found, skipping."));
  }

  resetConfig();
  console.log(pc.green("  Config reset to defaults."));
  console.log(pc.bold("\nDone.") + " Run " + pc.cyan("safeclaw start") + " to start fresh.");
}
