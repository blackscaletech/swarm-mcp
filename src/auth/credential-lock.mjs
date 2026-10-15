import { spawn } from "node:child_process";
import { mkdir, lstat } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { CommandFailure } from "./command-runner.mjs";
import { UNIX_LOCK_SCRIPT, WINDOWS_LOCK_SCRIPT } from "./lock-scripts.mjs";

const LOCK_ERROR = "Swarm credential ownership is unavailable. Retry later; no local access was changed.";
const CANCEL_ERROR = "Swarm credential operation was cancelled.";

export async function withCredentialLock(account, operation, { signal, waitMs = 30_000, directory } = {}) {
  if (signal?.aborted) throw new Error(CANCEL_ERROR);
  if (!/^profile-[a-f0-9]{32}$/.test(account) || !Number.isInteger(waitMs) || waitMs < 1 || waitMs > 120_000) {
    throw new Error(LOCK_ERROR);
  }
  let child;
  try {
    if (process.platform === "win32") {
      child = spawn("powershell.exe", ["-NoLogo", "-NoProfile", "-NonInteractive", "-Command", WINDOWS_LOCK_SCRIPT],
        { windowsHide: true, stdio: ["pipe", "pipe", "pipe"] });
      child.stdin.write(`${account}\n`);
    } else {
      const root = directory || join(homedir(), ".swarm-mcp-locks");
      await mkdir(root, { mode: 0o700, recursive: true });
      const stat = await lstat(root);
      if (!stat.isDirectory() || stat.isSymbolicLink() || stat.uid !== process.getuid() || (stat.mode & 0o077)) throw new Error();
      child = spawn("/usr/bin/perl", ["-e", UNIX_LOCK_SCRIPT, join(root, `${account}.lock`)],
        { stdio: ["pipe", "pipe", "pipe"] });
    }
  } catch {
    throw new Error(LOCK_ERROR);
  }
  let active = true;
  let pending;
  let buffer = "";
  const controller = new AbortController();
  const closed = new Promise((resolve) => child.once("close", () => { active = false; resolve(); }));
  const fail = () => {
    active = false;
    controller.abort();
    pending?.reject(new Error(LOCK_ERROR));
    pending = null;
  };
  child.on("error", fail);
  child.stdin.on("error", fail);
  child.once("exit", fail);
  child.once("close", fail);
  child.stderr.on("data", () => {});
  child.stdout.setEncoding("utf8");
  child.stdout.on("data", (chunk) => {
    buffer += chunk;
    if (buffer.length > 96 * 1024) { fail(); child.kill("SIGKILL"); return; }
    const newline = buffer.indexOf("\n");
    if (newline < 0) return;
    const line = buffer.slice(0, newline);
    buffer = buffer.slice(newline + 1);
    const waiter = pending;
    pending = null;
    try { waiter?.resolve(JSON.parse(line)); } catch { waiter?.reject(new Error(LOCK_ERROR)); fail(); }
  });
  const receive = () => new Promise((resolve, reject) => { pending = { resolve, reject }; });
  const ready = receive();
  let acquired = false;
  const cancel = () => {
    controller.abort();
    if (!acquired) { pending?.reject(new Error(CANCEL_ERROR)); child.kill("SIGKILL"); }
  };
  signal?.addEventListener("abort", cancel, { once: true });
  if (signal?.aborted) cancel();
  const timer = setTimeout(() => {
    pending?.reject(new Error("Swarm credential ownership wait timed out. Retry later."));
    child.kill("SIGKILL");
  }, waitMs);
  const assertOwned = () => { if (!active || !acquired) throw new Error(LOCK_ERROR); };
  try {
    if (!(await ready).ready) throw new Error(LOCK_ERROR);
    acquired = true;
    clearTimeout(timer);
    assertOwned();
    if (controller.signal.aborted) throw new Error(CANCEL_ERROR);
    return await operation({
      signal: controller.signal,
      assertOwned,
      async runCommand(command, args, options = {}) {
        assertOwned();
        if (pending) throw new Error(LOCK_ERROR);
        const response = receive();
        const watchdog = setTimeout(() => { fail(); child.kill("SIGKILL"); }, 12_000);
        child.stdin.write(`${JSON.stringify({ command, args, input: options.input })}\n`);
        let result;
        try { result = await response; } finally { clearTimeout(watchdog); }
        assertOwned();
        if (result.failed || result.unavailable || result.code !== 0) {
          throw new CommandFailure("Secure credential store rejected the request", { code: result.code, unavailable: Boolean(result.unavailable) });
        }
        return { stdout: result.stdout };
      }
    });
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", cancel);
    // Never unlink lock files or release on a timer while a writer is outstanding.
    child.stdin.end();
    const shutdown = setTimeout(() => child.kill("SIGKILL"), 15_000);
    try { await closed; } finally { clearTimeout(shutdown); }
  }
}
