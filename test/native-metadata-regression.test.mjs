import assert from "node:assert/strict";
import test from "node:test";
import { PACKAGE_VERSION } from "../src/package-info.mjs";
import { NATIVE_PROTOCOL_VERSION } from "../src/protocol/constants.mjs";
import { RemoteMCPClient, nativeRequest } from "../src/swarm-api/remote-mcp-client.mjs";

const trustedMetadata = () => ({
  "io.modelcontextprotocol/protocolVersion": NATIVE_PROTOCOL_VERSION,
  "io.modelcontextprotocol/clientCapabilities": {},
  "io.modelcontextprotocol/clientInfo": { name: "@blackscaletech/swarm-mcp", version: PACKAGE_VERSION }
});

test("native bridge supplies mandatory metadata without claiming upstream capabilities or identity", () => {
  for (const method of ["initialize", "ping", "tools/list", "tools/call", "resources/list", "resources/read"]) {
    const message = { jsonrpc: "2.0", id: 1, method, params: { _meta: {
      "io.modelcontextprotocol/protocolVersion": "2025-11-25",
      "io.modelcontextprotocol/clientCapabilities": { "io.modelcontextprotocol/ui": {} },
      "io.modelcontextprotocol/clientInfo": { name: "ChatGPT", version: "untrusted" },
      authority: "must not forward"
    } } };
    const original = structuredClone(message);
    const native = nativeRequest(message);
    assert.deepEqual(native.params._meta, trustedMetadata());
    assert.deepEqual(message, original, "caller input must not be mutated");
  }
});

test("stateless discovery remains metadata-free and does not forward caller authority", () => {
  const message = { id: 0, method: "server/discover", params: { _meta: { authority: "untrusted" } } };
  assert.deepEqual(nativeRequest(message), { jsonrpc: "2.0", id: 0, method: "server/discover", params: {} });
  assert.deepEqual(message.params._meta, { authority: "untrusted" });
});

test("metadata does not change legacy initialize payload or explicit checkpoint retry inputs", () => {
  const initialize = { protocolVersion: "2025-11-25", capabilities: {}, clientInfo: { name: "legacy client", version: "1" } };
  assert.deepEqual(nativeRequest({ id: 1, method: "initialize", params: initialize }).params, { ...initialize, _meta: trustedMetadata() });
  const arguments_ = { idempotency_key: "exact-explicit-retry", checkpoint_kind_key: "checkpoint.kind.output", body_text: "Durable evidence" };
  for (const id of [1, 2, 3]) {
    const native = nativeRequest({ id, method: "tools/call", params: { name: "swarm_publish_agent_checkpoint", arguments: arguments_ } },
      "sp_default", new Set(["swarm_publish_agent_checkpoint"]));
    assert.deepEqual(native.params.arguments, { ...arguments_, space_id: "sp_default" });
    assert.deepEqual(native.params._meta, trustedMetadata());
  }
  assert.equal("space_id" in arguments_, false);
});

test("authenticated refresh retry retains trusted metadata and the rejected-token fence", async () => {
  const sent = [], refreshOptions = [];
  const tokenManager = { async accessToken(options = {}) {
    refreshOptions.push(options);
    return options.forceRefresh ? "synthetic-replacement-access" : "synthetic-initial-access";
  } };
  const client = new RemoteMCPClient({ config: { baseUrl: "http://127.0.0.1", defaultSpaceId: "", timeoutMs: 1000 }, tokenManager,
    fetchImpl: async (_url, options) => {
      sent.push(JSON.parse(options.body));
      return new Response(JSON.stringify(sent.length === 1 ? { error: "unauthorized" } : { jsonrpc: "2.0", id: 7, result: { tools: [] } }),
        { status: sent.length === 1 ? 401 : 200, headers: { "Content-Type": "application/json" } });
    } });
  const result = await client.request({ id: 7, method: "tools/list", params: { _meta: { authority: "untrusted" } } });
  assert.deepEqual(result.result, { tools: [] });
  assert.deepEqual(sent.map(message => message.params._meta), [trustedMetadata(), trustedMetadata()]);
  assert.deepEqual(refreshOptions, [{}, { forceRefresh: true, rejectedToken: "synthetic-initial-access" }]);
});

test("lost mutation reply is not automatically retried and its explicit key is not replaced", async () => {
  const sent = [];
  const client = new RemoteMCPClient({ config: { baseUrl: "http://127.0.0.1", defaultSpaceId: "", timeoutMs: 1000 },
    tokenManager: { accessToken: async () => "synthetic-access" }, fetchImpl: async (_url, options) => {
      sent.push(JSON.parse(options.body));
      throw new Error("synthetic committed reply lost");
    } });
  const message = { id: 1, method: "tools/call", params: { name: "swarm_publish_agent_checkpoint", arguments: { idempotency_key: "exact-retry" } } };
  await assert.rejects(client.request(message), /Swarm could not be reached/);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].params.arguments.idempotency_key, "exact-retry");
  assert.deepEqual(sent[0].params._meta, trustedMetadata());
});
