import assert from "node:assert/strict";
import test from "node:test";
import { CommandFailure } from "../src/auth/command-runner.mjs";
import { createSecureCredentialStore } from "../src/auth/secure-store.mjs";
import { serializeCredential } from "../src/auth/credential.mjs";
import { WINDOWS_LOAD_SCRIPT, WINDOWS_REMOVE_SCRIPT, WINDOWS_SAVE_SCRIPT } from "../src/auth/stores/windows-scripts.mjs";
import { testConfig, testCredential } from "./v081-helpers.mjs";

for (const platform of ["darwin", "linux", "win32"]) {
  test(`${platform} secure store keeps credential material out of process arguments`, async () => {
    const config = testConfig();
    const credential = testCredential(config);
    const serialized = serializeCredential(credential, config);
    const calls = [];
    const runner = async (command, args, options = {}) => {
      calls.push({ command, args, input: options.input });
      if (isLoad(platform, args)) return { stdout: platform === "darwin" ? Buffer.from(serialized).toString("base64") : serialized };
      return { stdout: "" };
    };
    const store = createSecureCredentialStore(config, { platform, runner });
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
    const store = createSecureCredentialStore(config, { platform, runner });
    await assert.rejects(store.load(), /not available/);
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
    runner: async () => { throw new CommandFailure("missing", { code: 44 }); }
  });
  const linux = createSecureCredentialStore(config, {
    platform: "linux",
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
      : args.some((arg) => arg.includes("CredReadW"));
}
