import assert from "node:assert/strict";
import test from "node:test";
import { SwarmMCPServer } from "../src/protocol/server.mjs";
import { listResources, readResource } from "../src/resources/catalog.mjs";
import { RemoteMCPClient } from "../src/swarm-api/remote-mcp-client.mjs";
import { jsonResponse, testConfig } from "./v081-helpers.mjs";

async function initializedServer(remoteClient) {
  const server = new SwarmMCPServer({ config: testConfig(), remoteClient, secureStoreName: "Test store" });
  await server.handle({ jsonrpc: "2.0", id: 1, method: "initialize" });
  return server;
}

test("local resource URIs take precedence across catalog pages without losing remote metadata", async () => {
  const remote = { uri: "ui://swarm/spaces-v1.html", name: "swarm-spaces", _meta: { ui: { csp: {} } } };
  const server = await initializedServer({ request: async (message) => ({
    jsonrpc: "2.0", id: message.id, result: {
      resources: [...listResources().map((resource) => ({ ...resource, name: "remote collision" })), remote],
      nextCursor: "next-page", _meta: { cacheScope: "private" }
    }
  }) });
  for (const params of [{}, { cursor: "next-page" }]) {
    const response = await server.handle({ jsonrpc: "2.0", id: 2, method: "resources/list", params });
    assert.deepEqual(response.result.resources, params.cursor ? [remote] : [...listResources(), remote]);
    assert.equal(response.result.nextCursor, "next-page");
    assert.deepEqual(response.result._meta, { cacheScope: "private" });
  }
});

test("resource authorization errors are returned unchanged without a local-only discovery fallback", async () => {
  for (const code of [-32003, -32601]) {
    const server = await initializedServer({ request: async (message) => ({
      jsonrpc: "2.0", id: message.id, error: { code, message: "Resource access denied" }
    }) });
    for (const method of ["resources/list", "resources/read"]) {
      const response = await server.handle({ jsonrpc: "2.0", id: 2, method, params: { uri: "ui://swarm/spaces-v1.html" } });
      assert.deepEqual(response, { jsonrpc: "2.0", id: 2, error: { code, message: "Resource access denied" } });
    }
  }
});

test("malformed remote catalogs fail with a fixed error instead of exposing their payload", async () => {
  for (const result of [undefined, null, {}, { resources: null }, { resources: {} }, { resources: "private diagnostic" }]) {
    const server = await initializedServer({ request: async (message) => ({ jsonrpc: "2.0", id: message.id, result }) });
    const response = await server.handle({ jsonrpc: "2.0", id: 2, method: "resources/list" });
    assert.deepEqual(response.error, { code: -32603, message: "Swarm returned an invalid resource catalog" });
  }
});

test("empty remote catalogs preserve all local guidance", async () => {
  const server = await initializedServer({ request: async (message) => ({
    jsonrpc: "2.0", id: message.id, result: { resources: [] }
  }) });
  const response = await server.handle({ jsonrpc: "2.0", id: 2, method: "resources/list" });
  assert.deepEqual(response.result.resources, listResources());
});

test("invalid resource URIs are rejected and every local guidance read stays offline", async () => {
  let calls = 0;
  const server = await initializedServer({ request: async () => { calls += 1; throw new Error("remote unavailable"); } });
  for (const uri of [undefined, null, "", {}, [], 42, "x".repeat(2049)]) {
    const response = await server.handle({ jsonrpc: "2.0", id: 2, method: "resources/read", params: { uri } });
    assert.deepEqual(response.error, { code: -32602, message: "Invalid Swarm resource" });
  }
  for (const { uri } of listResources()) {
    const response = await server.handle({ jsonrpc: "2.0", id: 3, method: "resources/read", params: { uri } });
    assert.deepEqual(response.result, readResource(uri, testConfig(), "Test store"));
  }
  assert.equal(calls, 0);
});

test("remote resource identifiers only reach authenticated canonical MCP requests", async () => {
  const config = testConfig();
  const calls = [];
  const remoteClient = new RemoteMCPClient({
    config, tokenManager: { accessToken: async () => "synthetic-access" },
    fetchImpl: async (url, options) => {
      const request = JSON.parse(options.body);
      calls.push({ url, options, request });
      const uri = request.params.uri;
      return jsonResponse({ jsonrpc: "2.0", id: request.id, result: {
        contents: [{ uri, mimeType: "text/html;profile=mcp-app", text: "<html>Untrusted view</html>", _meta: { ui: { csp: {} } } }]
      } });
    }
  });
  const server = await initializedServer(remoteClient);
  for (const uri of ["ui://swarm/spaces-v1.html", "file:///private/swarm-mcp-synthetic", "http://127.0.0.1:9/synthetic", "x".repeat(2048)]) {
    const response = await server.handle({ jsonrpc: "2.0", id: 2, method: "resources/read", params: { uri } });
    assert.deepEqual(response.result, { contents: [{
      uri, mimeType: "text/html;profile=mcp-app", text: "<html>Untrusted view</html>", _meta: { ui: { csp: {} } }
    }] });
    const call = calls.at(-1);
    assert.equal(call.url, `${config.baseUrl}/mcp`);
    assert.equal(call.options.method, "POST");
    assert.equal(call.options.redirect, "error");
    assert.equal(call.options.headers.Authorization, "Bearer synthetic-access");
    assert.equal(call.options.headers["Mcp-Method"], "resources/read");
    assert.equal(call.request.params.uri, uri);
  }
  assert.equal(calls.length, 4);
});
