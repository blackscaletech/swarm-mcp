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

test("native request defaults only server-advertised Space arguments and adds trusted metadata", () => {
  const spaceScopedTools = new Set(["swarm_read_context"]);
  const request = nativeRequest({
    jsonrpc: "2.0", id: 1, method: "tools/call",
    params: { _meta: { unsafe: "ignored" }, name: "swarm_read_context", arguments: { limit: 10 } }
  }, "sp_default", spaceScopedTools);
  assert.equal(request.params.arguments.space_id, "sp_default");
  assert.equal("unsafe" in request.params._meta, false);
  assert.equal(request.params._meta["io.modelcontextprotocol/clientInfo"].name, "@blackscaletech/swarm-mcp");
  const explicit = nativeRequest({
    jsonrpc: "2.0", id: 2, method: "tools/call",
    params: { name: "swarm_read_context", arguments: { space_id: "sp_explicit" } }
  }, "sp_default", spaceScopedTools);
  assert.equal(explicit.params.arguments.space_id, "sp_explicit");
  const undiscovered = nativeRequest({
    id: 3, method: "tools/call",
    params: { name: "swarm_read_context", arguments: { limit: 10 } }
  }, "sp_default");
  assert.equal("space_id" in undiscovered.params.arguments, false);
});

test("remote defaults follow dynamic schemas without adding Space arguments to resource-ID calls", async () => {
  const sent = [];
  const tools = [
    { name: "future_space_action", inputSchema: { properties: { space_id: { type: "string" } } } },
    { name: "swarm_update_schedule", inputSchema: { properties: { policy_id: { type: "string" } }, additionalProperties: false } },
    { name: "swarm_disable_schedule", inputSchema: { properties: { policy_id: { type: "string" } }, additionalProperties: false } },
    { name: "future_nonstring_action", inputSchema: { properties: { space_id: { type: "integer" } } } }
  ];
  const client = new RemoteMCPClient({
    config: testConfig({ defaultSpaceId: "sp_default" }),
    tokenManager: { accessToken: async () => "swa_" + "a".repeat(64) },
    fetchImpl: async (_url, options) => {
      const message = JSON.parse(options.body);
      sent.push(message);
      return jsonResponse({ jsonrpc: "2.0", id: message.id, result: message.method === "tools/list" ? { tools } : {} });
    }
  });
  await client.request({ id: 1, method: "tools/list", params: {} });
  const args = { limit: 1 };
  await client.request({ id: 2, method: "tools/call", params: { name: "future_space_action", arguments: args } });
  assert.equal(sent.at(-1).params.arguments.space_id, "sp_default");
  assert.deepEqual(args, { limit: 1 });
  await client.request({ id: 3, method: "tools/call", params: { name: "future_space_action", arguments: { space_id: "sp_explicit" } } });
  assert.equal(sent.at(-1).params.arguments.space_id, "sp_explicit");
  for (const name of ["swarm_update_schedule", "swarm_disable_schedule", "future_nonstring_action", "undiscovered_action"]) {
    const arguments_ = { policy_id: "sch_example", idempotency_key: "review-default-space" };
    await client.request({ id: name, method: "tools/call", params: { name, arguments: arguments_ } });
    assert.deepEqual(sent.at(-1).params.arguments, arguments_);
  }
  assert.equal(sent.length, 7, "schema handling must not add network requests");
});

test("remote default schemas accumulate pages and replace stale discovery without trusting errors", async () => {
  let result;
  const sent = [];
  const client = new RemoteMCPClient({
    config: testConfig({ defaultSpaceId: "sp_default" }),
    tokenManager: { accessToken: async () => "swa_" + "a".repeat(64) },
    fetchImpl: async (_url, options) => {
      const message = JSON.parse(options.body);
      sent.push(message);
      return jsonResponse({ jsonrpc: "2.0", id: message.id, ...result });
    }
  });
  const descriptor = (name) => ({ name, inputSchema: { properties: { space_id: { type: "string" } } } });
  result = { result: { tools: [descriptor("first_space_action")] } };
  await client.request({ id: 1, method: "tools/list", params: {} });
  result = { result: { tools: [descriptor("second_space_action")] } };
  await client.request({ id: 2, method: "tools/list", params: { cursor: "next-page" } });
  result = { result: {} };
  for (const name of ["first_space_action", "second_space_action"]) {
    await client.request({ id: name, method: "tools/call", params: { name, arguments: {} } });
    assert.equal(sent.at(-1).params.arguments.space_id, "sp_default");
  }
  result = { error: { code: -32603, message: "Catalog unavailable" } };
  await client.request({ id: 3, method: "tools/list", params: {} });
  assert.ok(client.spaceScopedTools.has("first_space_action"));
  result = { result: { tools: [] } };
  await client.request({ id: 4, method: "tools/list", params: {} });
  result = { result: {} };
  await client.request({ id: 5, method: "tools/call", params: { name: "first_space_action", arguments: {} } });
  assert.equal("space_id" in sent.at(-1).params.arguments, false);
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
