import assert from "node:assert/strict";
import test from "node:test";
import { parseCredential, serializeCredential } from "../src/auth/credential.mjs";
import { credentialAccount, resolveRuntimeConfig } from "../src/config/runtime.mjs";
import { testConfig, testCredential } from "./v081-helpers.mjs";

test("runtime configuration contains no bearer-token input", () => {
  const config = resolveRuntimeConfig({ SWARM_API_TOKEN: "ignored", SWARM_MCP_PROFILE: "work" });
  assert.equal(config.baseUrl, "https://api.swarm.services");
  assert.equal(config.profile, "work");
  assert.equal("token" in config, false);
  assert.equal("SWARM_API_TOKEN" in config, false);
});

test("runtime configuration rejects unsafe origins and profile names", () => {
  for (const value of ["http://api.example", "file:///tmp/swarm", "https://user:pass@api.example", "https://api.example/path"]) {
    assert.throws(() => resolveRuntimeConfig({ SWARM_API_BASE_URL: value }), /SWARM_API_BASE_URL/);
  }
  assert.equal(resolveRuntimeConfig({ SWARM_API_BASE_URL: "http://127.0.0.1:8080" }).baseUrl, "http://127.0.0.1:8080");
  assert.throws(() => resolveRuntimeConfig({ SWARM_MCP_PROFILE: "../unsafe" }), /SWARM_MCP_PROFILE/);
});

test("credential account is deterministic and origin/profile isolated", () => {
  const first = credentialAccount("https://api.example", "default");
  assert.equal(first, credentialAccount("https://api.example", "default"));
  assert.notEqual(first, credentialAccount("https://api.example", "other"));
  assert.notEqual(first, credentialAccount("https://preview.example", "default"));
  assert.match(first, /^profile-[a-f0-9]{32}$/);
});

test("secure credential serialization is exact and profile bound", () => {
  const config = testConfig();
  const credential = testCredential(config);
  assert.deepEqual(parseCredential(serializeCredential(credential, config), config), credential);
  assert.throws(() => parseCredential(JSON.stringify({ ...credential, profile: "other" }), config), /does not match/);
  assert.throws(() => parseCredential(JSON.stringify({ ...credential, resource: "https://other.example/mcp" }), config), /does not match/);
  assert.throws(() => parseCredential(JSON.stringify({ ...credential, clientId: "https://client.example/id" }), config), /does not match/);
  assert.throws(() => parseCredential(JSON.stringify({ ...credential, tokenEndpoint: `${config.baseUrl}/other` }), config), /does not match/);
});
