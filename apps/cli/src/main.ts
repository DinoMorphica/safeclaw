import { startCommand } from "./commands/start.js";
import { resetCommand } from "./commands/reset.js";
import { statusCommand } from "./commands/status.js";

const HELP_TEXT = `
Usage: safeclaw <command>

Commands:
  start     Launch the SafeClaw dashboard server
  reset     Reset database and configuration
  status    Show current SafeClaw status
  help      Show this help message

Examples:
  npx safeclaw start
  safeclaw status
`;

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  switch (command) {
    case "start":
      await startCommand();
      break;
    case "reset":
      await resetCommand();
      break;
    case "status":
      await statusCommand();
      break;
    case "help":
    case "--help":
    case "-h":
    case undefined:
      console.log(HELP_TEXT);
      break;
    default:
      console.error(`Unknown command: ${command}`);
      console.log(HELP_TEXT);
      process.exit(1);
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
