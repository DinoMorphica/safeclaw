import fs from "node:fs";
import { DB_PATH } from "../lib/paths.js";
import { resetConfig } from "../lib/config.js";

export async function resetCommand(): Promise<void> {
  console.log("Resetting SafeClaw...");

  if (fs.existsSync(DB_PATH)) {
    fs.unlinkSync(DB_PATH);
    const walPath = DB_PATH + "-wal";
    const shmPath = DB_PATH + "-shm";
    if (fs.existsSync(walPath)) fs.unlinkSync(walPath);
    if (fs.existsSync(shmPath)) fs.unlinkSync(shmPath);
    console.log("  Database deleted.");
  }

  resetConfig();
  console.log("  Config reset to defaults.");
  console.log("Done. Run 'safeclaw start' to start fresh.");
}
