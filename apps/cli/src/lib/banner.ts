const VERSION = "0.1.0";

export function printBanner(port: number): void {
  const banner = `
   _____       ___       ________
  / ___/____ _/ __/__   / ____/ /___ __      __
  \\__ \\/ __ \`/ /_/ _ \\ / /   / / __ \`| | /| / /
 ___/ / /_/ / __/  __// /___/ / /_/ /| |/ |/ /
/____/\\__,_/_/  \\___/ \\____/_/\\__,_/ |__/|__/

SafeClaw v${VERSION} - AI Agent Security Dashboard
${"─".repeat(48)}
Dashboard:  http://localhost:${port}
Data dir:   ~/.safeclaw/
`;
  console.log(banner);
}
