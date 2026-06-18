import assert from "node:assert/strict";
import test from "node:test";
import { SwarmAPIClient, SwarmAPIError } from "../src/http-client.mjs";
import { makeServer } from "./helpers.mjs";

test("oversized tool arguments are rejected before API calls", async () => {
  let called = false;
  const server = makeServer("read-only", {
    search() {
      called = true;
      return { items: [] };
    }
  });

  await server.handle({ jsonrpc: "2.0", id: 1, method: "initialize" });
  const response = await server.handle({
    jsonrpc: "2.0",
    id: 2,
    method: "tools/call",
    params: { name: "swarm_search", arguments: { q: "x".repeat(1024 * 1024 + 1) } }
  });

  assert.equal(called, false);
  assert.equal(response.result.isError, true);
  assert.match(response.result.content[0].text, /exceeds/);
});

test("invalid JSON-RPC and malformed tool calls are rejected before tool dispatch", async () => {
  const server = makeServer("operator", {
    createTask() {
      throw new Error("createTask should not be called");
    }
  });

  assert.equal((await server.handle({ id: 1, method: "initialize" })).error.code, -32600);
  await server.handle({ jsonrpc: "2.0", id: 2, method: "initialize" });

  const missingName = await server.handle({
    jsonrpc: "2.0",
    id: 3,
    method: "tools/call",
    params: { arguments: {} }
  });
  assert.equal(missingName.error.code, -32602);

  const invalidArgs = await server.handle({
    jsonrpc: "2.0",
    id: 4,
    method: "tools/call",
    params: { name: "swarm_create_task", arguments: [] }
  });
  assert.equal(invalidArgs.error.code, -32602);
});

test("launch tools reject raw prompts unless raw prompt capture is enabled", async () => {
  let called = false;
  const server = makeServer("operator", {
    launchRun() {
      called = true;
      return { run_id: "run_test" };
    }
  });

  await server.handle({ jsonrpc: "2.0", id: 1, method: "initialize" });
  const response = await server.handle({
    jsonrpc: "2.0",
    id: 2,
    method: "tools/call",
    params: {
      name: "swarm_launch_run",
      arguments: {
        space_id: "sp_test",
        title: "Invalid prompt capture",
        description: "This should be rejected before Swarm receives it.",
        prompt_capture_mode: "compiled_only",
        source_prompt: "raw prompt text"
      }
    }
  });

  assert.equal(called, false);
  assert.equal(response.result.isError, true);
  assert.match(response.result.content[0].text, /source_prompt requires prompt_capture_mode raw_and_compiled/);
});

test("HTTP client emits idempotency header when supplied", async () => {
  let capturedHeaders = null;
  const client = new SwarmAPIClient({
    baseUrl: "https://api.swarm.services",
    token: "swarm_mcp_test",
    fetchImpl: async (_url, options) => {
      capturedHeaders = options.headers;
      return new Response("{}", { status: 200, headers: { "content-type": "application/json" } });
    }
  });

  await client.launchRun("sp_test", {}, { idempotencyKey: "idem_header" });
  assert.equal(capturedHeaders["Idempotency-Key"], "idem_header");
});

test("tool errors redact bearer tokens and Swarm credentials", async () => {
  const server = makeServer("read-only", {
    listAgents() {
      throw new SwarmAPIError(401, {
        error: "invalid token swarm_mcp_secret",
        Authorization: ["Bearer", "secret-token"].join(" ")
      });
    }
  });

  await server.handle({ jsonrpc: "2.0", id: 1, method: "initialize" });
  await server.handle({ jsonrpc: "2.0", id: 2, method: "tools/list" });
  const response = await server.handle({
    jsonrpc: "2.0",
    id: 3,
    method: "tools/call",
    params: { name: "swarm_list_agents", arguments: {} }
  });

  const text = response.result.content[0].text;
  assert.equal(response.result.isError, true);
  assert.match(text, /swarm_\[redacted\]/);
  assert.doesNotMatch(text, /swarm_mcp_secret/);
  assert.doesNotMatch(text, /secret-token/);
});

test("tool errors redact common provider token shapes", async () => {
  const openaiKey = ["sk", "testsecret000000000000"].join("-");
  const githubKey = ["ghp", "abcdefghijklmnopqrstuvwxyz"].join("_");
  const githubPat = ["github", "pat", "abcdefghijklmnopqrstuvwxyz"].join("_");
  const slackKey = ["xoxb", "1234567890", "abcdefghijklmnopqrstuvwxyz"].join("-");
  const server = makeServer("read-only", {
    listAgents() {
      throw new SwarmAPIError(500, {
        error: `bad keys ${openaiKey} ${githubKey} ${githubPat} ${slackKey}`
      });
    }
  });

  await server.handle({ jsonrpc: "2.0", id: 1, method: "initialize" });
  const response = await server.handle({
    jsonrpc: "2.0",
    id: 2,
    method: "tools/call",
    params: { name: "swarm_list_agents", arguments: {} }
  });

  const text = response.result.content[0].text;
  assert.doesNotMatch(text, /testsecret/);
  assert.doesNotMatch(text, /abcdefghijklmnopqrstuvwxyz/);
  assert.match(text, /sk-\[redacted\]/);
  assert.match(text, /ghp_\[redacted\]/);
  assert.match(text, /github_pat_\[redacted\]/);
  assert.match(text, /xox\[redacted\]/);
});

test("tool API errors only expose safe response headers", async () => {
  const server = makeServer("read-only", {
    listAgents() {
      throw new SwarmAPIError(429, { error: "rate limited" }, {
        "set-cookie": "swarm_session=secret",
        "x-request-id": "req_123"
      });
    }
  });

  await server.handle({ jsonrpc: "2.0", id: 1, method: "initialize" });
  const response = await server.handle({
    jsonrpc: "2.0",
    id: 2,
    method: "tools/call",
    params: { name: "swarm_list_agents", arguments: {} }
  });

  const text = response.result.content[0].text;
  assert.equal(response.result.isError, true);
  assert.match(text, /x-request-id/);
  assert.match(text, /req_123/);
  assert.doesNotMatch(text, /set-cookie/);
  assert.doesNotMatch(text, /secret/);
});
