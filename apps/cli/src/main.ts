import { Command } from "commander";
import { VERSION } from "./lib/version.js";
import { startCommand } from "./commands/start.js";
import { resetCommand } from "./commands/reset.js";
import { statusCommand } from "./commands/status.js";
import { doctorCommand } from "./commands/doctor.js";
import { configListCommand, configGetCommand, configSetCommand } from "./commands/config.js";
import { logsCommand } from "./commands/logs.js";
import pc from "picocolors";

const program = new Command();

program
  .name("safeclaw")
  .description("Security management dashboard for AI agents")
  .version(VERSION, "-V, --version");

program
  .command("start")
  .description("Launch the SafeClaw dashboard server")
  .option("-p, --port <port>", "override server port")
  .option("--no-open", "skip auto-opening browser")
  .option("--verbose", "enable debug logging to console", false)
  .action(async (options) => {
    await startCommand(options);
  });

program
  .command("reset")
  .description("Reset database and configuration to defaults")
  .option("--force", "skip confirmation prompt", false)
  .action(async (options) => {
    await resetCommand(options);
  });

program
  .command("status")
  .description("Show current SafeClaw status")
  .option("--json", "output as JSON for scripting", false)
  .action(async (options) => {
    await statusCommand(options);
  });

program
  .command("doctor")
  .description("Check system health and prerequisites")
  .action(async () => {
    await doctorCommand();
  });

const configCmd = program.command("config").description("Manage SafeClaw configuration");

configCmd
  .command("list")
  .description("Show all configuration values")
  .action(async () => {
    await configListCommand();
  });

configCmd
  .command("get")
  .description("Get a configuration value")
  .argument("<key>", "configuration key")
  .action(async (key: string) => {
    await configGetCommand(key);
  });

configCmd
  .command("set")
  .description("Set a configuration value")
  .argument("<key>", "configuration key")
  .argument("<value>", "new value")
  .action(async (key: string, value: string) => {
    await configSetCommand(key, value);
  });

program
  .command("logs")
  .description("View SafeClaw debug logs")
  .option("-n, --lines <count>", "number of lines to show", "50")
  .option("-f, --follow", "follow log output in real-time", false)
  .option("--clear", "clear the log file", false)
  .action(async (options) => {
    await logsCommand(options);
  });

program.parseAsync(process.argv).catch((err: unknown) => {
  const error = err instanceof Error ? err : new Error(String(err));
  process.stderr.write(pc.red(`Fatal error: ${error.message}\n`));
  process.exit(1);
});
