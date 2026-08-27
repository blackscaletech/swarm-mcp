import { runCommand } from "./command-runner.mjs";

export async function openBrowser(url, options = {}) {
  const platform = options.platform || process.platform;
  const runner = options.runner || runCommand;
  const invocation = platform === "darwin"
    ? ["open", [url]]
    : platform === "win32"
      ? ["rundll32.exe", ["url.dll,FileProtocolHandler", url]]
      : platform === "linux"
        ? ["xdg-open", [url]]
        : null;
  if (!invocation) return false;
  try {
    await runner(invocation[0], invocation[1], { timeoutMs: 15_000, maxOutputBytes: 8 * 1024 });
    return true;
  } catch {
    return false;
  }
}
