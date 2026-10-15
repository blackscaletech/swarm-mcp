import { readFile, writeFile, unlink, access } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { closeSync } from "node:fs";
import { createCredential } from "../../src/auth/credential.mjs";
import { createSecureCredentialStore } from "../../src/auth/secure-store.mjs";
import { TokenManager } from "../../src/auth/token-manager.mjs";
import { resolveRuntimeConfig } from "../../src/config/runtime.mjs";

// Synthetic credentials only. This fixture never invokes a platform store.
const [mode, root, profile = "isolated", account, action] = process.argv.slice(2);
const config = resolveRuntimeConfig({ SWARM_API_BASE_URL: "https://api.example", SWARM_MCP_PROFILE: profile });
const stamp = "2026-08-25T12:00:00.000Z";
const token = (prefix, generation) => prefix + String(generation).repeat(64);
const synthetic = (generation, expiresAt = "2026-08-25T12:00:01.000Z") => createCredential({
  accessToken: token("swa_", generation), refreshToken: token("swr_", generation),
  clientId: "https://swarm.services/clients/swarm-mcp", installationRef: "swi_" + "1".repeat(32),
  createdAt: stamp, updatedAt: stamp, expiresAt, issuer: config.baseUrl, profile: config.profile,
  resource: config.baseUrl + "/mcp", tokenEndpoint: config.baseUrl + "/oauth/token", scopeKeys: ["mcp", "offline_access"]
}, config);
const exists = async (path) => access(path).then(() => true, () => false);

if (mode === "command") {
  const broker = execFileSync("ps", ["-o", "ppid=", "-p", String(process.ppid)], { encoding: "utf8" }).trim();
  await writeFile(join(root, `owner-${account}`), broker);
  const path = join(root, `${account}.fake-secret`);
  if (action === "load") {
    process.stdout.write(await readFile(path, "utf8").catch((error) => { if (error.code === "ENOENT") return ""; throw error; }));
  } else if (action === "remove") {
    await unlink(path).catch((error) => { if (error.code !== "ENOENT") throw error; });
  } else if (action === "save") {
    let input = "";
    for await (const chunk of process.stdin) input += chunk;
    if (await exists(join(root, `fail-${account}`))) process.exit(1);
    if (await exists(join(root, "close-inherited-lock"))) closeSync(3);
    if (await exists(join(root, "pause-command"))) {
      await writeFile(join(root, "command-owner"), broker);
      const deadline = Date.now() + 5000;
      while (!await exists(join(root, "release-command"))) {
        if (Date.now() > deadline) process.exit(1);
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
    }
    await writeFile(path, input, { mode: 0o600 });
  }
} else {
  const gates = new Map();
  let job;
  const gate = (name) => new Promise((resolve) => { gates.set(name, resolve); });
  const notify = (event, fields = {}) => process.send({ event, ...fields });
  const adapterFactory = (scoped, runner) => ({
    name: "Synthetic child-process secure store",
    async load() { return (await runner(process.execPath, [fileURLToPath(import.meta.url), "command", root, profile, scoped.credentialAccount, "load"])).stdout || null; },
    async save(value) {
      await runner(process.execPath, [fileURLToPath(import.meta.url), "command", root, profile, scoped.credentialAccount, "save"], { input: value });
      if (job?.pausePending && scoped.credentialAccount.endsWith("-pending")) {
        const released = gate("pending");
        notify("pending-durable", { id: job.id });
        await released;
      }
    },
    async remove() { await runner(process.execPath, [fileURLToPath(import.meta.url), "command", root, profile, scoped.credentialAccount, "remove"]); return true; }
  });
  const store = createSecureCredentialStore(config, { adapterFactory, lockDirectory: join(root, "locks") });
  const manager = new TokenManager({ config, store, now: () => Date.parse(stamp), fetchImpl: async (_url, options) => {
    const generation = Number(await readFile(join(root, "provider-generation"), "utf8"));
    if (new URLSearchParams(options.body).get("refresh_token") !== token("swr_", generation)) {
      notify("consumed-proof", { id: job.id });
      return new Response(JSON.stringify({ error: "invalid_grant" }), { status: 400 });
    }
    await writeFile(join(root, "provider-generation"), String(generation + 1));
    const released = job.pauseProvider ? gate("provider") : Promise.resolve();
    notify("provider-committed", { id: job.id, generation: generation + 1 });
    await released;
    return new Response(JSON.stringify({ access_token: token("swa_", generation + 1), refresh_token: token("swr_", generation + 1),
      expires_in: 600, scope: "mcp offline_access", token_type: "Bearer" }), { headers: { "Content-Type": "application/json" } });
  } });
  process.on("message", async (message) => {
    if (message.release) { gates.get(message.release)?.(); return; }
    job = message;
    notify("started", { id: message.id });
    try {
      let result;
      if (message.action === "seed") { await store.save(synthetic(1)); result = true; }
      else if (message.action === "disconnect") result = await store.remove();
      else if (message.action === "connect") result = await store.connect(async (owned) => {
        if (message.pauseConnect) { const released = gate("connect"); notify("connect-owned", { id: message.id }); await released; }
        await owned.save(synthetic(9, "2026-08-25T12:10:00.000Z")); return true;
      });
      else if (message.action === "load") { const value = await store.load(); result = value ? value.accessToken.slice(4, 5) : null; }
      else result = (await manager.accessToken(message.options)).slice(4, 5);
      notify("result", { id: message.id, result });
    } catch (error) { notify("result", { id: message.id, error: error.message }); }
    job = null;
  });
  notify("ready", { account: config.credentialAccount });
}
