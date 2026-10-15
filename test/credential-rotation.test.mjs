import assert from "node:assert/strict";
import { fork } from "node:child_process";
import { mkdtemp, readFile, writeFile, unlink, rm, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { once } from "node:events";
import test from "node:test";
import { withCredentialLock } from "../src/auth/credential-lock.mjs";
import { createSecureCredentialStore } from "../src/auth/secure-store.mjs";
import { TokenManager } from "../src/auth/token-manager.mjs";
import { fakeSecureStore, jsonResponse, testConfig, testCredential } from "./v081-helpers.mjs";

const now = Date.parse("2026-08-25T12:00:00.000Z");
const expired = (config) => testCredential(config, { expiresAt: "2026-08-25T12:00:01.000Z" });
const replacement = () => jsonResponse({ access_token: "swa_" + "b".repeat(64), refresh_token: "swr_" + "s".repeat(64),
  expires_in: 600, scope: "mcp offline_access", token_type: "Bearer" });
const manager = (config, store, fetchImpl) => new TokenManager({ config, store, fetchImpl, now: () => now });
const deferred = () => { let resolve; const promise = new Promise((r) => { resolve = r; }); return { promise, resolve }; };

test("separate managers reload generations and a late 401 does not rotate the replacement", async () => {
  const config = testConfig();
  const fake = fakeSecureStore(config, testCredential(config));
  let requests = 0;
  const fetchImpl = async () => { requests += 1; return replacement(); };
  const a = manager(config, fake.store, fetchImpl);
  const b = manager(config, fake.create(), fetchImpl);
  const old = await a.accessToken();
  await b.accessToken();
  const next = await a.accessToken({ forceRefresh: true, rejectedToken: old });
  assert.equal(await b.accessToken({ forceRefresh: true, rejectedToken: old }) === next, true);
  assert.equal(requests, 1);
  await fake.store.remove();
  await assert.rejects(b.accessToken(), /not connected/);
});

for (const slot of ["current", "pending", "intent-promotion", "pending-cleanup", "intent-cleanup"]) {
  test(`known committed refresh survives ${slot} failure without consumed-proof retry`, async () => {
    const config = testConfig();
    let fail = true;
    let requests = 0;
    const applies = (account, value, remove = false) => slot === "current" ? account === config.credentialAccount
      : slot === "pending" ? account.endsWith("-pending") && !remove
        : slot === "intent-promotion" ? account.endsWith("-rotation") && value?.includes('"replace"')
          : slot === "pending-cleanup" ? account.endsWith("-pending") && remove && requests > 0
            : account.endsWith("-rotation") && remove;
    const fake = fakeSecureStore(config, expired(config), {
      save: async (account, value) => { if (fail && applies(account, value)) throw new Error("swr_fake-secret-in-store-error"); },
      remove: async (account) => { if (fail && applies(account, null, true)) throw new Error("swa_fake-secret-in-store-error"); }
    });
    const a = manager(config, fake.store, async () => { requests += 1; return replacement(); });
    await assert.rejects(a.accessToken(), (error) => !/swa_|swr_/.test(error.message) && !error.cause && /recovery/.test(error.message));
    if (slot === "pending") await assert.rejects(fake.create().load(), /outcome is unknown/);
    fail = false;
    const recovering = slot === "pending" ? a : manager(config, fake.create(), async () => { throw new Error("must not repeat refresh"); });
    assert.equal((await recovering.accessToken()).startsWith("swa_b"), true);
    assert.equal(requests, 1);
    assert.equal(fake.records.size, 1);
  });
}

test("disconnect fences an in-memory replacement and permits an explicit reconnect", async () => {
  const config = testConfig();
  let fail = true;
  let requests = 0;
  const fake = fakeSecureStore(config, expired(config), { save: async (account) => {
    if (fail && account.endsWith("-pending")) throw new Error("synthetic failure");
  } });
  const a = manager(config, fake.store, async () => { requests += 1; return replacement(); });
  await assert.rejects(a.accessToken(), /recovery/);
  await fake.create().remove();
  fail = false;
  const reconnected = testCredential(config, { installationRef: "swi_" + "2".repeat(32), accessToken: "swa_" + "c".repeat(64) });
  await fake.create().connect((owned) => owned.save(reconnected));
  assert.equal(await a.accessToken() === reconnected.accessToken, true);
  assert.equal(requests, 1);
});

test("unfinished disconnect resumes removal and malformed state is explicitly removable", async () => {
  const config = testConfig();
  let fail = true;
  const fake = fakeSecureStore(config, testCredential(config), { remove: async (account) => {
    if (fail && account === config.credentialAccount) throw new Error("synthetic failure");
  } });
  await assert.rejects(fake.store.remove(), /recovery/);
  fail = false;
  assert.equal(await fake.create().load(), null);
  fake.records.set(config.credentialAccount, "invalid synthetic credential");
  fake.records.set(`${config.credentialAccount}-rotation`, "invalid synthetic intent");
  await fake.create().remove();
  assert.equal(fake.records.size, 0);
});

test("unconfirmed refresh never retries the proof and distinguishes revoked access", async () => {
  for (const revoked of [true, false]) {
    const config = testConfig();
    const fake = fakeSecureStore(config, expired(config));
    let calls = 0;
    const a = manager(config, fake.store, async () => {
      calls += 1;
      if (revoked) return jsonResponse({ error: "invalid_grant", error_description: "swr_do-not-log" }, 400);
      throw new Error("swa_do-not-log");
    });
    await assert.rejects(a.accessToken(), revoked ? /no longer active/ : /outcome could not be verified/);
    await assert.rejects(a.accessToken(), /outcome is unknown/);
    await assert.rejects(fake.create().load(), /outcome is unknown/);
    assert.equal(calls, 1);
  }
});

test("failure to persist refresh intent prevents dispatch and leaves the current credential intact", async () => {
  const config = testConfig();
  let fail = true;
  let calls = 0;
  const fake = fakeSecureStore(config, expired(config), { save: async (account) => {
    if (fail && account.endsWith("-rotation")) throw new Error("synthetic failure");
  } });
  const a = manager(config, fake.store, async () => { calls += 1; return replacement(); });
  await assert.rejects(a.accessToken(), /recovery/);
  assert.equal(calls, 0);
  assert.equal(fake.records.size, 1);
  fail = false;
  await a.accessToken();
  assert.equal(calls, 1);
});

test("cancellation after receiving the replacement persists it before releasing ownership", async () => {
  const config = testConfig();
  const entered = deferred();
  const released = deferred();
  const controller = new AbortController();
  let calls = 0;
  const fake = fakeSecureStore(config, expired(config), { save: async (account) => {
    if (account.endsWith("-pending")) { entered.resolve(); await released.promise; }
  } });
  const a = manager(config, fake.store, async () => {
    calls += 1;
    return replacement();
  });
  const operation = a.accessToken({ signal: controller.signal });
  const cancelled = assert.rejects(operation, /cancelled/);
  await entered.promise;
  controller.abort(new Error("swr_private-abort-reason"));
  await assert.rejects(fake.create().load({ waitMs: 60 }), /wait timed out/);
  released.resolve();
  await cancelled;
  assert.equal((await fake.create().load()).accessToken.startsWith("swa_b"), true);
  assert.equal(calls, 1);
});

test("cancelling an unknown provider reply releases ownership without retrying its proof", async () => {
  const config = testConfig(), controller = new AbortController();
  const fake = fakeSecureStore(config, expired(config)), entered = deferred(), reply = deferred();
  let calls = 0;
  const a = manager(config, fake.store, async () => { calls++; entered.resolve(); return reply.promise; });
  const operation = a.accessToken({ signal: controller.signal });
  const rejected = assert.rejects(operation, /outcome could not be verified/);
  await entered.promise;
  controller.abort();
  await rejected;
  await assert.rejects(fake.create().load(), /outcome is unknown/);
  reply.resolve(replacement());
  await fake.create().remove();
  assert.equal(calls, 1);
});

test("different validated origin/profile owners do not block each other", async () => {
  const config = testConfig();
  const fake = fakeSecureStore(config);
  const entered = deferred();
  const released = deferred();
  const holding = withCredentialLock(config.credentialAccount, async () => { entered.resolve(); await released.promise; }, { directory: fake.lockDirectory });
  await entered.promise;
  const { resolveRuntimeConfig } = await import("../src/config/runtime.mjs");
  for (const env of [
    { SWARM_API_BASE_URL: "https://api.example", SWARM_MCP_PROFILE: "other" },
    { SWARM_API_BASE_URL: "https://other.example", SWARM_MCP_PROFILE: "test" }
  ]) {
    await withCredentialLock(resolveRuntimeConfig(env).credentialAccount, () => {}, { directory: fake.lockDirectory, waitMs: 1000 });
  }
  released.resolve();
  await holding;
});

test("profile ownership cannot be redirected and saved transactions cannot escape their owner", async () => {
  const config = testConfig();
  assert.throws(() => createSecureCredentialStore({ ...config, credentialAccount: "profile-" + "0".repeat(32) }), /does not match/);
  assert.throws(() => manager(config, { load: async () => null }, async () => {}), /coordinated/);
  const fake = fakeSecureStore(config);
  let stale;
  await fake.store.transaction((tx) => { stale = tx; });
  await assert.rejects(stale.replace(testCredential(config)), /ownership/);
  assert.equal(fake.records.size, 0);
});

test("stored replacement cannot add an unsupported OAuth scope", async () => {
  const config = testConfig(), fake = fakeSecureStore(config);
  const credential = { ...testCredential(config), scopeKeys: ["mcp", "offline_access", "unsupported_authority"] };
  await assert.rejects(fake.store.save(credential), /recovery/);
  assert.equal(fake.records.size, 0);
});

test("bounded waits and cancellation cannot release a live process's ownership", async () => {
  const config = testConfig();
  const fake = fakeSecureStore(config);
  const entered = deferred();
  const released = deferred();
  const held = withCredentialLock(config.credentialAccount, async (lease) => {
    entered.resolve();
    await released.promise;
    lease.assertOwned();
  }, { directory: fake.lockDirectory });
  await entered.promise;
  const options = { directory: fake.lockDirectory, waitMs: 60 };
  let enteredContender = false;
  const operation = () => { enteredContender = true; };
  await assert.rejects(withCredentialLock(config.credentialAccount, operation, options), /wait timed out/);
  const controller = new AbortController();
  const cancelled = withCredentialLock(config.credentialAccount, operation, { ...options, waitMs: 5000, signal: controller.signal });
  controller.abort(new Error("swr_private-abort-reason"));
  await assert.rejects(cancelled, (error) => /cancelled/.test(error.message) && !error.message.includes("swr_"));
  await assert.rejects(withCredentialLock(config.credentialAccount, operation, options), /wait timed out/);
  assert.equal(enteredContender, false);
  released.resolve();
  await held;
  await withCredentialLock(config.credentialAccount, operation, options);
  assert.equal(enteredContender, true);
});

const fixture = fileURLToPath(new URL("./fixtures/credential-worker.mjs", import.meta.url));

async function childFixture(t) {
  const root = await mkdtemp(join(tmpdir(), "swarm-mcp-synthetic-processes-"));
  await writeFile(join(root, "provider-generation"), "1");
  const children = [];
  const events = [];
  const waiters = [];
  let nextID = 0;
  t.after(async () => {
    for (const child of children) {
      if (child.exitCode === null && child.signalCode === null) { const closed = once(child, "close"); child.kill("SIGKILL"); await closed; }
    }
    await rm(root, { recursive: true, force: true });
  });
  const wait = (child, event, id) => {
    const matches = (item) => item.child === child && item.message.event === event && (id === undefined || item.message.id === id);
    const existing = events.find(matches);
    if (existing) return Promise.resolve(existing.message);
    return new Promise((resolve, reject) => {
      const waiter = { matches, resolve: (value) => { clearTimeout(timer); resolve(value); } };
      const timer = setTimeout(() => { waiters.splice(waiters.indexOf(waiter), 1); reject(new Error(`Synthetic child did not reach ${event}`)); }, 8000);
      waiters.push(waiter);
    });
  };
  const spawn = async (profile = "isolated") => {
    const child = fork(fixture, ["worker", root, profile], { stdio: ["ignore", "pipe", "pipe", "ipc"] });
    children.push(child);
    let diagnostics = "";
    child.stdout.on("data", (chunk) => { diagnostics += chunk; });
    child.stderr.on("data", (chunk) => { diagnostics += chunk; });
    child.on("message", (message) => {
      const item = { child, message };
      events.push(item);
      for (let i = waiters.length - 1; i >= 0; i -= 1) if (waiters[i].matches(item)) {
        const [waiter] = waiters.splice(i, 1); waiter.resolve(message);
      }
    });
    child.on("close", () => { assert.equal(/swa_|swr_/.test(diagnostics), false, "child diagnostics must remain secret-free"); });
    await wait(child, "ready");
    return child;
  };
  const start = (child, action, options = {}) => { const id = ++nextID; child.send({ id, action, ...options }); return id; };
  const run = async (child, action, options) => { const id = start(child, action, options); return wait(child, "result", id); };
  const kill = async (child) => { const closed = once(child, "close"); child.kill("SIGKILL"); await closed; };
  return { root, spawn, wait, start, run, kill, events };
}

test("independent processes serialize delayed refresh replies and share the durable generation", { timeout: 15000 }, async (t) => {
  const f = await childFixture(t);
  const a = await f.spawn();
  const b = await f.spawn();
  assert.equal((await f.run(a, "seed")).result, true);
  const refreshA = f.start(a, "access", { pauseProvider: true });
  await f.wait(a, "provider-committed", refreshA);
  const refreshB = f.start(b, "access");
  await f.wait(b, "started", refreshB);
  const account = (await f.wait(a, "ready")).account;
  await assert.rejects(withCredentialLock(account, () => { throw new Error("must not acquire"); }, { directory: join(f.root, "locks"), waitMs: 60 }), /wait timed out/);
  a.send({ release: "provider" });
  assert.equal((await f.wait(a, "result", refreshA)).result, "2");
  assert.equal((await f.wait(b, "result", refreshB)).result, "2");
  assert.equal(f.events.filter((item) => item.message.event === "provider-committed").length, 1);
  assert.equal(f.events.some((item) => item.message.event === "consumed-proof"), false);
  const files = await readdir(join(f.root, "locks"));
  for (const name of files) assert.equal((await readFile(join(f.root, "locks", name))).length, 0);
});

test("a second process recovers pending rotation after secure current-slot persistence fails", { timeout: 15000 }, async (t) => {
  const f = await childFixture(t);
  const a = await f.spawn();
  const b = await f.spawn();
  await f.run(a, "seed");
  const { account } = await f.wait(a, "ready");
  await writeFile(join(f.root, `fail-${account}`), "synthetic failure");
  assert.match((await f.run(a, "access")).error, /recovery/);
  await unlink(join(f.root, `fail-${account}`));
  assert.equal((await f.run(b, "access")).result, "2");
  assert.equal(f.events.filter((item) => item.message.event === "provider-committed").length, 1);
});

test("simultaneous process connects hold ownership through authorization and cannot replace each other", { timeout: 15000 }, async (t) => {
  const f = await childFixture(t);
  const a = await f.spawn();
  const b = await f.spawn();
  const connectA = f.start(a, "connect", { pauseConnect: true });
  await f.wait(a, "connect-owned", connectA);
  const connectB = f.start(b, "connect");
  await f.wait(b, "started", connectB);
  const { account } = await f.wait(a, "ready");
  await assert.rejects(withCredentialLock(account, () => {}, { directory: join(f.root, "locks"), waitMs: 60 }), /wait timed out/);
  a.send({ release: "connect" });
  assert.equal((await f.wait(a, "result", connectA)).result, true);
  assert.match((await f.wait(b, "result", connectB)).error, /already connected.*disconnect/);
  assert.equal((await f.run(b, "load")).result, "9");
});

for (const phase of ["provider", "pending"]) {
  test(`process death at ${phase} phase cannot resubmit the consumed proof`, { timeout: 15000 }, async (t) => {
    const f = await childFixture(t);
    const a = await f.spawn();
    const b = await f.spawn();
    await f.run(a, "seed");
    const id = f.start(a, "access", phase === "provider" ? { pauseProvider: true } : { pausePending: true });
    await f.wait(a, phase === "provider" ? "provider-committed" : "pending-durable", id);
    await f.kill(a);
    const result = await f.run(b, "access");
    if (phase === "pending") assert.equal(result.result, "2");
    else assert.match(result.error, /outcome is unknown/);
    assert.equal(f.events.filter((item) => item.message.event === "provider-committed").length, 1);
    assert.equal(f.events.some((item) => item.message.event === "consumed-proof"), false);
    assert.equal((await f.run(b, "disconnect")).result, true);
    assert.equal((await f.run(b, "connect")).result, true);
    assert.equal((await f.run(b, "access")).result, "9");
  });
}

test("disconnect waits for a delayed refresh, then cached clients see removal and reconnect", { timeout: 15000 }, async (t) => {
  const f = await childFixture(t);
  const a = await f.spawn();
  const b = await f.spawn();
  await f.run(a, "seed");
  const refresh = f.start(a, "access", { pauseProvider: true });
  await f.wait(a, "provider-committed", refresh);
  const disconnect = f.start(b, "disconnect");
  await f.wait(b, "started", disconnect);
  a.send({ release: "provider" });
  assert.equal((await f.wait(a, "result", refresh)).result, "2");
  assert.equal((await f.wait(b, "result", disconnect)).result, true);
  assert.match((await f.run(a, "access")).error, /not connected/);
  assert.equal((await f.run(b, "connect")).result, true);
  assert.match((await f.run(a, "connect")).error, /already connected.*disconnect/);
  assert.equal((await f.run(a, "access")).result, "9");
});

test("a delayed provider reply from a dead owner cannot overwrite another process's reconnect", { timeout: 15000, skip: process.platform === "win32" }, async (t) => {
  const f = await childFixture(t);
  const a = await f.spawn();
  const b = await f.spawn();
  await f.run(a, "seed");
  const id = f.start(a, "access", { pauseProvider: true });
  await f.wait(a, "provider-committed", id);
  const { account } = await f.wait(a, "ready");
  const broker = Number(await readFile(join(f.root, `owner-${account}-rotation`), "utf8"));
  process.kill(broker, "SIGKILL");
  assert.equal((await f.run(b, "disconnect")).result, true);
  assert.equal((await f.run(b, "connect")).result, true);
  a.send({ release: "provider" });
  assert.match((await f.wait(a, "result", id)).error, /recovery/);
  assert.equal((await f.run(b, "load")).result, "9");
  assert.equal((await f.run(a, "access")).result, "9");
  assert.equal(f.events.some((item) => item.message.event === "consumed-proof"), false);
});

test("a killed Unix broker cannot unlock its outstanding secure-store writer", { timeout: 15000, skip: process.platform === "win32" }, async (t) => {
  const root = await mkdtemp(join(tmpdir(), "swarm-mcp-synthetic-owner-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const config = testConfig();
  await writeFile(join(root, "pause-command"), "synthetic barrier");
  await writeFile(join(root, "close-inherited-lock"), "simulate a utility closing inherited descriptors");
  const lockOptions = { directory: join(root, "locks"), waitMs: 5000 };
  const writing = withCredentialLock(config.credentialAccount, (lease) => lease.runCommand(process.execPath,
    [fixture, "command", root, "test", config.credentialAccount, "save"], { input: "synthetic-only" }), lockOptions);
  // Attach rejection handling before intentionally killing the broker.
  const failed = assert.rejects(writing, /ownership/);
  let owner;
  const deadline = Date.now() + 5000;
  while (!owner) {
    owner = await readFile(join(root, "command-owner"), "utf8").catch(() => null);
    if (Date.now() > deadline) throw new Error("Synthetic writer did not reach barrier");
    if (!owner) await new Promise((resolve) => setTimeout(resolve, 10));
  }
  process.kill(Number(owner), "SIGKILL");
  await assert.rejects(withCredentialLock(config.credentialAccount, () => {}, { ...lockOptions, waitMs: 60 }), /wait timed out/);
  await writeFile(join(root, "release-command"), "synthetic barrier released");
  await failed;
  await withCredentialLock(config.credentialAccount, async () => {
    assert.equal(await readFile(join(root, `${config.credentialAccount}.fake-secret`), "utf8"), "synthetic-only");
  }, lockOptions);
});
