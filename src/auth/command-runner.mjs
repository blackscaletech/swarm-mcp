import { spawn } from "node:child_process";

const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_OUTPUT_LIMIT = 32 * 1024;

export class CommandFailure extends Error {
  constructor(message, { code, unavailable = false } = {}) {
    super(message);
    this.name = "CommandFailure";
    this.code = code;
    this.unavailable = unavailable;
  }
}

export function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { windowsHide: true, stdio: ["pipe", "pipe", "pipe"] });
    const timeoutMs = options.timeoutMs || DEFAULT_TIMEOUT_MS;
    const maxOutputBytes = options.maxOutputBytes || DEFAULT_OUTPUT_LIMIT;
    let stdout = Buffer.alloc(0);
    let stderrBytes = 0;
    let settled = false;
    const fail = (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(error);
    };
    const append = (current, chunk) => {
      if (current.length + chunk.length > maxOutputBytes) {
        child.kill();
        fail(new CommandFailure("Secure credential store returned too much data"));
        return current;
      }
      return Buffer.concat([current, chunk]);
    };
    child.stdout.on("data", (chunk) => { stdout = append(stdout, chunk); });
    child.stderr.on("data", (chunk) => {
      stderrBytes += chunk.length;
      if (stderrBytes > maxOutputBytes) {
        child.kill();
        fail(new CommandFailure("Secure credential store returned too much diagnostic data"));
      }
    });
    child.on("error", (error) => fail(new CommandFailure("Secure credential store is unavailable", { unavailable: error.code === "ENOENT" })));
    child.on("close", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (code !== 0) {
        reject(new CommandFailure("Secure credential store rejected the request", { code }));
        return;
      }
      resolve({ stdout: stdout.toString("utf8") });
    });
    const timer = setTimeout(() => {
      child.kill();
      fail(new CommandFailure("Secure credential store timed out"));
    }, timeoutMs);
    if (options.input !== undefined) child.stdin.end(String(options.input));
    else child.stdin.end();
  });
}
