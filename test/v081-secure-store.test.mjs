import assert from "node:assert/strict";
import test from "node:test";
import { CommandFailure } from "../src/auth/command-runner.mjs";
import { createSecureCredentialStore } from "../src/auth/secure-store.mjs";
import { WINDOWS_LOAD_SCRIPT, WINDOWS_REMOVE_SCRIPT, WINDOWS_SAVE_SCRIPT } from "../src/auth/stores/windows-scripts.mjs";
import { fakeSecureStore, testConfig, testCredential } from "./v081-helpers.mjs";

for (const platform of ["darwin", "linux", "win32"]) {
  test(`${platform} secure store keeps credential material out of process arguments`, async () => {
    const config = testConfig();
    const credential = testCredential(config);
    const calls = [];
    const records = new Map();
    const runner = async (command, args, options = {}) => {
      calls.push({ command, args, input: options.input });
      const account = platform === "win32" ? options.input.split("\n")[0]
        : platform === "darwin" && options.input ? options.input.split(/\s+/)[2]
          : platform === "darwin" ? args[2] : args.at(-1);
      if (isLoad(platform, args)) return { stdout: records.get(account) || "" };
      if (platform === "darwin" && options.input) records.set(account, options.input.trim().split(/\s+/).at(-1));
      else if (platform !== "darwin" && options.input && (platform !== "win32" || args.at(-1) === WINDOWS_SAVE_SCRIPT)) records.set(account, platform === "win32" ? options.input.split("\n").slice(1).join("\n") : options.input);
      else records.delete(account);
      return { stdout: "" };
    };
    const store = createSecureCredentialStore(config, { platform, runner, lockDirectory: fakeSecureStore(config).lockDirectory });
    await store.save(credential);
    assert.deepEqual(await store.load(), credential);
    await store.remove();
    assert.equal(calls.some((call) => call.args.some((arg) => arg.includes(credential.accessToken) || arg.includes(credential.refreshToken))), false);
    const save = calls.find((call) => inputContainsCredential(platform, call.input, credential.refreshToken));
    assert.ok(save, "credential must be delivered to the platform store over stdin");
    assert.equal(save.args.some((arg) => arg.includes(credential.refreshToken)), false);
    if (platform === "win32") assert.equal(save.args.some((arg) => arg.includes("Swarm MCP:profile-")), false);
  });
}

function inputContainsCredential(platform, input, token) {
  if (typeof input !== "string") return false;
  if (platform !== "darwin") return input.includes(token);
  const encoded = input.trim().split(/\s+/).at(-1) || "";
  return Buffer.from(encoded, "base64").toString("utf8").includes(token);
}

test("missing platform secure stores fail closed", async () => {
  const config = testConfig();
  const runner = async () => { throw new CommandFailure("missing", { unavailable: true }); };
  for (const platform of ["darwin", "linux", "win32"]) {
    const store = createSecureCredentialStore(config, { platform, runner, lockDirectory: fakeSecureStore(config).lockDirectory });
    await assert.rejects(store.load(), /unavailable/);
  }
  assert.throws(() => createSecureCredentialStore(config, { platform: "aix" }), /remote MCP URL/);
});

test("Windows credential scripts consume all variable input from stdin", () => {
  for (const script of [WINDOWS_LOAD_SCRIPT, WINDOWS_SAVE_SCRIPT, WINDOWS_REMOVE_SCRIPT]) {
    assert.doesNotMatch(script, /\$args\b/i);
    assert.match(script, /Console\]::In\.ReadLine\(\)/);
  }
  assert.doesNotMatch(WINDOWS_SAVE_SCRIPT, /ExecutionPolicy|Bypass/i);
});

test("missing macOS and Linux records return no credential", async () => {
  const config = testConfig();
  const mac = createSecureCredentialStore(config, {
    platform: "darwin",
    lockDirectory: fakeSecureStore(config).lockDirectory,
    runner: async () => { throw new CommandFailure("missing", { code: 44 }); }
  });
  const linux = createSecureCredentialStore(config, {
    platform: "linux",
    lockDirectory: fakeSecureStore(config).lockDirectory,
    runner: async () => { throw new CommandFailure("missing", { code: 1 }); }
  });
  assert.equal(await mac.load(), null);
  assert.equal(await linux.load(), null);
});

function isLoad(platform, args) {
  return platform === "darwin"
    ? args[0] === "find-generic-password"
    : platform === "linux"
      ? args[0] === "lookup"
      : args.at(-1) === WINDOWS_LOAD_SCRIPT;
}
