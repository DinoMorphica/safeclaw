import pc from "picocolors";
import { VERSION } from "./version.js";

export function printBanner(port: number): void {
  // Each line split into [Safe, Claw] portions
  const lines: [string, string][] = [
    ["   _____       ___       ", "________"],
    ["  / ___/____ _/ __/__   ", "/ ____/ /___ __      __"],
    ["  \\__ \\/ __ `/ /_/ _ \\ ", "/ /   / / __ `| | /| / /"],
    [" ___/ / /_/ / __/  __/", "/ /___/ / /_/ /| |/ |/ /"],
    ["/____/\\__,_/_/  \\___/ ", "\\____/_/\\__,_/ |__/|__/"],
  ];

  console.log();
  for (const [safe, claw] of lines) {
    console.log(pc.bold(pc.white(safe)) + pc.red(claw));
  }
  console.log();
  console.log(
    pc.bold(pc.white("Safe")) +
      pc.bold(pc.red("Claw")) +
      pc.dim(` v${VERSION}`) +
      " - AI Agent Security Dashboard",
  );
  console.log(pc.dim("─".repeat(48)));
  console.log(`${pc.dim("Dashboard:")}  ${pc.cyan(`http://localhost:${port}`)}`);
  console.log(`${pc.dim("Data dir:")}   ~/.safeclaw/`);
  console.log();
}
