import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { connectBrowser } from "../src/auth/browser-pairing.mjs";
import { STDIO_OAUTH_CLIENT_ID } from "../src/protocol/constants.mjs";
import { createLoopbackCallback } from "../src/auth/loopback-callback.mjs";
import { discoverOAuth } from "../src/auth/oauth-discovery.mjs";
import { jsonResponse, oauthMetadata, testConfig } from "./v081-helpers.mjs";

test("browser pairing uses pre-registered native PKCE and stores only the completed credential", async () => {
  const config = testConfig();
  const responses = [...oauthMetadata(config), jsonResponse({
    access_token: "swa_" + "a".repeat(64),
    expires_in: 600,
    refresh_token: "swr_" + "r".repeat(64),
    scope: "mcp offline_access", token_type: "Bearer",
    token_type: "Bearer"
  })];
  const fetches = [];
  const fetchImpl = async (url, options) => {
    fetches.push({ url: String(url), options });
    return responses.shift();
  };
  let authorizationURL;
  let saved;
  const result = await connectBrowser(config, { name: "Test secure store", save: async (value) => { saved = value; } }, {
    createCallback: async ({ issuer, state }) => ({
      close() {},
      redirectUri: "http://127.0.0.1:49152/swarm-mcp/callback",
      waitForCode: async () => {
        assert.equal(issuer, config.baseUrl);
        assert.equal(state.length >= 32, true);
        return "c".repeat(64);
      }
    }),
    fetchImpl,
    openBrowser: async (url) => { authorizationURL = new URL(url); return true; }
  });
  assert.equal(result.secureStore, "Test secure store");
  assert.equal(authorizationURL.searchParams.get("client_id"), STDIO_OAUTH_CLIENT_ID);
  assert.equal(authorizationURL.searchParams.get("redirect_uri"), "http://127.0.0.1:49152/swarm-mcp/callback");
  assert.equal(authorizationURL.searchParams.get("code_challenge_method"), "S256");
  assert.equal(authorizationURL.searchParams.has("code_verifier"), false);
  assert.equal(saved.resource, `${config.baseUrl}/mcp`);
  assert.match(saved.installationRef, /^swi_[a-f0-9]{32}$/);
  const tokenForm = new URLSearchParams(fetches[2].options.body);
  assert.equal(tokenForm.get("client_id"), STDIO_OAUTH_CLIENT_ID);
  assert.equal(tokenForm.get("resource"), `${config.baseUrl}/mcp`);
  assert.equal(createHash("sha256").update(tokenForm.get("code_verifier")).digest("base64url"), authorizationURL.searchParams.get("code_challenge"));
});

for (const [name, target, mutate] of [
  ["resource", "protected", (value) => { value.resource = "https://other.example/mcp"; }],
  ["issuer", "authorization", (value) => { value.issuer = "https://other.example"; }],
  ["issuer response", "authorization", (value) => { value.authorization_response_iss_parameter_supported = false; }]
]) {
  test(`OAuth discovery rejects ${name} drift`, async () => {
    const config = testConfig();
    const valid = oauthMetadata(config);
    const first = await valid[0].json();
    const second = await valid[1].json();
    mutate(target === "protected" ? first : second);
    const queue = [jsonResponse(first), jsonResponse(second)];
    await assert.rejects(discoverOAuth(config, async () => queue.shift()), /metadata/);
  });
}

test("loopback callback requires exact host, state, issuer, path, and query", async () => {
  const state = "s".repeat(43);
  const issuer = "https://api.example";
  const invalid = await createLoopbackCallback({ issuer, state, timeoutMs: 20_000 });
  const bad = new URL(invalid.redirectUri);
  bad.search = new URLSearchParams({ code: "c".repeat(64), iss: "https://other.example", state }).toString();
  const response = await fetch(bad);
  assert.equal(response.status, 400);
  const callback = new URL(invalid.redirectUri);
  callback.search = new URLSearchParams({ code: "c".repeat(64), iss: issuer, state }).toString();
  const accepted = await fetch(callback);
  assert.equal(accepted.status, 200);
  assert.equal(await invalid.waitForCode(), "c".repeat(64));
  assert.equal(accepted.headers.get("cache-control"), "no-store");
});

test("browser-open failure returns the non-secret authorization URL for manual opening", async () => {
  const config = testConfig();
  const responses = [...oauthMetadata(config), jsonResponse({
    access_token: "swa_" + "a".repeat(64), expires_in: 600,
    refresh_token: "swr_" + "r".repeat(64), scope: "mcp offline_access", token_type: "Bearer"
  })];
  let manualURL = "";
  await connectBrowser(config, { name: "Store", save: async () => {} }, {
    createCallback: async () => ({ close() {}, redirectUri: "http://127.0.0.1:49152/swarm-mcp/callback", waitForCode: async () => "c".repeat(64) }),
    fetchImpl: async () => responses.shift(),
    onManualURL: (value) => { manualURL = value; },
    openBrowser: async () => false
  });
  assert.match(manualURL, /^https:\/\/api\.example\/oauth\/authorize\?/);
  assert.doesNotMatch(manualURL, /swa_|swr_|code_verifier/);
});
