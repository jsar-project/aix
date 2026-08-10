import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

export function writeHtmlOutput(outputPath: string, html: string) {
  if (fs.existsSync(outputPath) && fs.statSync(outputPath).isDirectory()) {
    throw new Error("--html-out must point to a file path");
  }
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, html);
}

export function installSignalHandlers(shutdown: () => void) {
  const handleSignal = () => {
    shutdown();
    process.exit(0);
  };
  process.once("SIGINT", handleSignal);
  process.once("SIGTERM", handleSignal);
}

export function openInBrowser(url: string) {
  const command =
    process.platform === "darwin"
      ? { file: "open", args: [url] }
      : process.platform === "win32"
        ? { file: "cmd", args: ["/c", "start", "", url] }
        : { file: "xdg-open", args: [url] };

  const child = spawn(command.file, command.args, {
    stdio: "ignore",
    detached: true,
  });
  child.on("error", () => {
    process.stderr.write(`warning: unable to open browser automatically, visit ${url}\n`);
  });
  child.unref();
}

export function formatError(error: unknown): string {
  return error instanceof Error ? error.stack || error.message : String(error);
}

export function sanitizeAppId(value: string): string {
  const normalized = value.trim().toLowerCase().replace(/[^a-z0-9._-]+/g, "-");
  return normalized.length > 0 ? normalized : "aix-preview";
}
