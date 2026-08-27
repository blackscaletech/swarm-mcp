import assert from "node:assert/strict";
import test from "node:test";
import { TokenManager } from "../src/auth/token-manager.mjs";
import { RemoteMCPClient, nativeRequest } from "../src/swarm-api/remote-mcp-client.mjs";
import { jsonResponse, testConfig, testCredential } from "./v081-helpers.mjs";

test("concurrent expiry refresh collapses to one rotating-token request and one store write", async () => {
  const config = testConfig();
  const credential = testCredential(config, { expiresAt: "2026-08-25T12:00:01.000Z" });
  let calls = 0;
  let saved = 0;
  const manager = new TokenManager({
    config,
    now: () => Date.parse("2026-08-25T12:00:00.000Z"),
    store: { load: async () => credential, save: async () => { saved += 1; } },
    fetchImpl: async () => {
      calls += 1;
      await new Promise((resolve) => setTimeout(resolve, 5));
      return jsonResponse({
        access_token: "swa_" + "b".repeat(64), expires_in: 600,
        refresh_token: "swr_" + "s".repeat(64), scope: "mcp offline_access", token_type: "Bearer"
      });
    }
  });
  const tokens = await Promise.all(Array.from({ length: 20 }, () => manager.accessToken()));
  assert.equal(new Set(tokens).size, 1);
  assert.equal(tokens[0], "swa_" + "b".repeat(64));
  assert.equal(calls, 1);
  assert.equal(saved, 1);
});

test("refresh fails closed when the server does not rotate the refresh credential", async () => {
  const config = testConfig();
  const credential = testCredential(config, { expiresAt: "2026-08-25T12:00:01.000Z" });
  const manager = new TokenManager({
    config,
    now: () => Date.parse("2026-08-25T12:00:00.000Z"),
    store: { load: async () => credential, save: async () => { throw new Error("must not save"); } },
    fetchImpl: async () => jsonResponse({
      access_token: "swa_" + "b".repeat(64), expires_in: 600,
      refresh_token: credential.refreshToken, scope: "mcp offline_access", token_type: "Bearer"
    })
  });
  await assert.rejects(manager.accessToken(), /connect.*again/i);
});

test("remote MCP retries one unauthorized request after refresh without leaking tokens", async () => {
  const config = testConfig();
  const tokens = [];
  let refreshes = 0;
  const tokenManager = {
    async accessToken({ forceRefresh = false } = {}) {
      if (forceRefresh) refreshes += 1;
      return forceRefresh ? "swa_" + "b".repeat(64) : "swa_" + "a".repeat(64);
    }
  };
  const client = new RemoteMCPClient({
    config,
    tokenManager,
    fetchImpl: async (_url, options) => {
      tokens.push(options.headers.Authorization);
      return tokens.length === 1
        ? jsonResponse({ error: "authentication required" }, 401)
        : jsonResponse({ jsonrpc: "2.0", id: 7, result: { tools: [] } });
    }
  });
  assert.deepEqual(await client.request({ jsonrpc: "2.0", id: 7, method: "tools/list", params: {} }), {
    jsonrpc: "2.0", id: 7, result: { tools: [] }
  });
  assert.equal(refreshes, 1);
  assert.equal(tokens.length, 2);
});

test("native request adds only trusted client metadata and an optional explicit default Space", () => {
  const request = nativeRequest({
    jsonrpc: "2.0", id: 1, method: "tools/call",
    params: { _meta: { unsafe: "ignored" }, name: "swarm_read_context", arguments: { limit: 10 } }
  }, "sp_default");
  assert.equal(request.params.arguments.space_id, "sp_default");
  assert.equal("unsafe" in request.params._meta, false);
  assert.equal(request.params._meta["io.modelcontextprotocol/clientInfo"].name, "@blackscaletech/swarm-mcp");
  const explicit = nativeRequest({
    jsonrpc: "2.0", id: 2, method: "tools/call",
    params: { name: "swarm_read_context", arguments: { space_id: "sp_explicit" } }
  }, "sp_default");
  assert.equal(explicit.params.arguments.space_id, "sp_explicit");
});

test("remote MCP rejects header-shaped tool names before network dispatch", async () => {
  let requests = 0;
  const client = new RemoteMCPClient({
    config: testConfig(),
    tokenManager: { accessToken: async () => "swa_" + "a".repeat(64) },
    fetchImpl: async () => { requests += 1; return jsonResponse({}); }
  });
  await assert.rejects(client.request({
    jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "unsafe\r\nheader", arguments: {} }
  }), /tool name/);
  assert.equal(requests, 0);
});
