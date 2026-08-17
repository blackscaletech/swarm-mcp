import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { MAX_HTTP_RESPONSE_BYTES } from "../src/constants.mjs";
import { SwarmAPIClient, SwarmAPIError } from "../src/http-client.mjs";
import { makeServer } from "./helpers.mjs";

test("oversized and unknown tool inputs are rejected before API calls", async () => {
  let calls = 0;
  const server = makeServer({ request: async () => { calls += 1; return {}; } });
  await server.handle({ jsonrpc: "2.0", id: 1, method: "initialize" });
  await server.handle({ jsonrpc: "2.0", id: 2, method: "tools/list" });

  const oversized = await call(server, "swarm_launch_run", {
    goal_summary: "x".repeat(4097),
    idempotency_key: "idem_oversized"
  });
  const unknown = await call(server, "swarm_launch_run", {
    goal_summary: "bounded",
    hidden_authority: true,
    idempotency_key: "idem_unknown"
  });

  assert.equal(oversized.result.isError, true);
  assert.equal(unknown.result.isError, true);
  assert.equal(calls, 0);
});

test("invalid JSON-RPC and malformed tool calls never dispatch", async () => {
  let calls = 0;
  const server = makeServer({ request: async () => { calls += 1; return {}; } });
  assert.equal((await server.handle({ id: 1, method: "initialize" })).error.code, -32600);
  await server.handle({ jsonrpc: "2.0", id: 2, method: "initialize" });
  const invalid = await server.handle({
    jsonrpc: "2.0",
    id: 3,
    method: "tools/call",
    params: { name: "swarm_launch_run", arguments: [] }
  });
  assert.equal(invalid.error.code, -32602);
  assert.equal(calls, 0);
});

test("unknown and unadvertised tools are rejected before API calls", async () => {
  let calls = 0;
  const server = makeServer({ request: async () => { calls += 1; return {}; } });
  await server.handle({ jsonrpc: "2.0", id: 1, method: "initialize" });
  const response = await call(server, "swarm_unregistered_tool", {});
  assert.equal(response.result.isError, true);
  assert.match(response.result.content[0].text, /unknown or unadvertised/);
  assert.equal(calls, 0);
});

test("HTTP client emits only bounded request headers", async () => {
  let options;
  const client = new SwarmAPIClient({
    baseUrl: "https://api.swarm.services",
    token: "swarm_mcp_test",
    fetchImpl: async (_url, value) => {
      options = value;
      return new Response("{}", { status: 200 });
    }
  });
  await client.request("POST", "/v1/test", { body: { ok: true }, idempotencyKey: "idem_test" });
  assert.equal(options.headers.Authorization, "Bearer swarm_mcp_test");
  assert.equal(options.headers["Idempotency-Key"], "idem_test");
  assert.equal(options.headers["Content-Type"], "application/json");
  assert.equal("Cookie" in options.headers, false);
});

test("HTTP client rejects declared and streamed oversized responses", async () => {
  const declared = new SwarmAPIClient({
    baseUrl: "https://api.swarm.services",
    token: "test",
    fetchImpl: async () => new Response("", {
      status: 200,
      headers: { "content-length": String(MAX_HTTP_RESPONSE_BYTES + 1) }
    })
  });
  await assert.rejects(declared.request("GET", "/v1/test"), /size limit/);

  let canceled = false;
  const streamed = new SwarmAPIClient({
    baseUrl: "https://api.swarm.services",
    token: "test",
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      headers: new Headers(),
      body: { getReader: () => ({
        read: async () => ({ done: false, value: { byteLength: MAX_HTTP_RESPONSE_BYTES + 1 } }),
        cancel: async () => { canceled = true; }
      }) }
    })
  });
  await assert.rejects(streamed.request("GET", "/v1/test"), /size limit/);
  assert.equal(canceled, true);
});

test("HTTP client preserves bounded pagination metadata", async () => {
  const client = new SwarmAPIClient({
    baseUrl: "https://api.swarm.services",
    token: "test",
    fetchImpl: async () => new Response('{"items":[{"id":"run_1"}]}', {
      status: 200,
      headers: {
        "content-type": "application/json",
        "x-next-cursor": "cursor_2",
        "x-order": "desc"
      }
    })
  });

  assert.deepEqual(await client.request("GET", "/v1/runs"), {
    items: [{ id: "run_1" }],
    page: { next_cursor: "cursor_2", order: "desc" }
  });
});

test("API failures expose only safe status and allowlisted headers", async () => {
  const server = makeServer({
    request: async () => {
      throw new SwarmAPIError(429, {
        "retry-after": "2",
        "x-request-id": "req_safe",
        "set-cookie": "session=secret",
        authorization: "Bearer secret"
      });
    }
  });
  await server.handle({ jsonrpc: "2.0", id: 1, method: "initialize" });
  await server.handle({ jsonrpc: "2.0", id: 2, method: "tools/list" });
  const response = await call(server, "swarm_get_space", {});
  const text = response.result.content[0].text;
  assert.equal(response.result.isError, true);
  assert.match(text, /req_safe/);
  assert.match(text, /retry_after/);
  assert.doesNotMatch(text, /session=secret|Bearer secret|set-cookie|authorization/i);
});

test("unexpected local errors are replaced with a generic message", async () => {
  const server = makeServer({ request: async () => { throw new Error("provider key sk-private-value"); } });
  await server.handle({ jsonrpc: "2.0", id: 1, method: "initialize" });
  await server.handle({ jsonrpc: "2.0", id: 2, method: "tools/list" });
  const response = await call(server, "swarm_get_space", {});
  assert.match(response.result.content[0].text, /Tool execution failed/);
  assert.doesNotMatch(response.result.content[0].text, /sk-private-value/);
});

test("tool transport cannot access files, processes, or sockets", async () => {
  const directory = fileURLToPath(new URL("../src/", import.meta.url));
  for (const name of ["tool-handlers.mjs", "tool-schema.mjs", "tool-definitions.mjs"]) {
    const source = await readFile(`${directory}${name}`, "utf8");
    assert.doesNotMatch(source, /node:(?:fs|child_process|net|http|https)/);
    assert.doesNotMatch(source, /\bfetch\s*\(/);
  }
});

async function call(server, name, args) {
  return server.handle({ jsonrpc: "2.0", id: 10, method: "tools/call", params: { name, arguments: args } });
}
