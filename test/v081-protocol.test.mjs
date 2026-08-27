import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import test from "node:test";
import { resolveCLICommand } from "../src/cli.mjs";
import { SwarmMCPServer } from "../src/protocol/server.mjs";
import { runStdio } from "../src/transports/stdio.mjs";
import { testConfig } from "./v081-helpers.mjs";

test("stdio server initializes locally and delegates the Permit-filtered tool catalog", async () => {
  const calls = [];
  const remoteClient = { request: async (message) => {
    calls.push(message);
    return { jsonrpc: "2.0", id: message.id, result: message.method === "tools/list"
      ? { tools: [{ name: "swarm_checkpoint_publish", inputSchema: { type: "object" } }], nextCursor: "next" }
      : { content: [{ type: "text", text: "saved" }], isError: false } };
  } };
  const server = new SwarmMCPServer({ config: testConfig(), remoteClient, secureStoreName: "Test store" });
  const initialized = await server.handle({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-11-25" } });
  assert.equal(initialized.result.protocolVersion, "2025-11-25");
  const listed = await server.handle({ jsonrpc: "2.0", id: 2, method: "tools/list", params: { cursor: "cursor" } });
  assert.equal(listed.result.tools[0].name, "swarm_checkpoint_publish");
  assert.equal(listed.result.nextCursor, "next");
  await server.handle({ jsonrpc: "2.0", id: 3, method: "tools/call", params: {
    name: "swarm_checkpoint_publish", arguments: { idempotency_key: "caller-key", space_id: "sp_test" }
  } });
  assert.deepEqual(calls.map((call) => call.method), ["tools/list", "tools/call"]);
});

test("prompts and resources are sanitized local guidance without credentials", async () => {
  const server = new SwarmMCPServer({
    config: testConfig(), remoteClient: { request: async () => { throw new Error("unused"); } }, secureStoreName: "Test store"
  });
  await server.handle({ jsonrpc: "2.0", id: 1, method: "initialize", params: {} });
  const prompts = await server.handle({ jsonrpc: "2.0", id: 2, method: "prompts/list" });
  const resources = await server.handle({ jsonrpc: "2.0", id: 3, method: "resources/read", params: { uri: "swarm://connection/status" } });
  const encoded = JSON.stringify({ prompts, resources });
  assert.match(encoded, /untrusted evidence/);
  assert.match(encoded, /operating-system-credential-store/);
  assert.doesNotMatch(encoded, /swa_|swr_|access_token|refresh_token/i);
});

test("stdio framing is bounded and notifications produce no response", async () => {
  const input = new PassThrough();
  const output = new PassThrough();
  let rendered = "";
  output.on("data", (chunk) => { rendered += chunk.toString("utf8"); });
  const server = new SwarmMCPServer({
    config: testConfig(), remoteClient: { request: async () => ({ jsonrpc: "2.0", id: 2, result: { tools: [] } }) }, secureStoreName: "Store"
  });
  const running = runStdio(server, input, output);
  input.write('{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}\n');
  input.write('{"jsonrpc":"2.0","method":"notifications/initialized"}\n');
  input.write('{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}\n');
  input.end();
  await running;
  const lines = rendered.trim().split("\n").map(JSON.parse);
  assert.deepEqual(lines.map((line) => line.id), [1, 2]);
});

test("notification-shaped tool calls cannot execute mutations", async () => {
  const input = new PassThrough();
  const output = new PassThrough();
  let remoteCalls = 0;
  let rendered = "";
  output.on("data", (chunk) => { rendered += chunk.toString("utf8"); });
  const server = new SwarmMCPServer({
    config: testConfig(),
    remoteClient: { request: async () => { remoteCalls += 1; return { jsonrpc: "2.0", id: null, result: {} }; } },
    secureStoreName: "Store"
  });
  const running = runStdio(server, input, output);
  input.write('{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}\n');
  input.write('{"jsonrpc":"2.0","method":"tools/call","params":{"name":"swarm_checkpoint_publish","arguments":{}}}\n');
  input.end();
  await running;
  assert.equal(remoteCalls, 0);
  assert.deepEqual(rendered.trim().split("\n").map(JSON.parse).map((line) => line.id), [1]);
});

test("stdio transport honors output backpressure and a final unterminated request", async () => {
  const input = new PassThrough();
  const output = new EventEmitter();
  const writes = [];
  output.write = (value) => {
    writes.push(value);
    if (writes.length === 1) {
      queueMicrotask(() => output.emit("drain"));
      return false;
    }
    return true;
  };
  const server = new SwarmMCPServer({
    config: testConfig(), remoteClient: { request: async () => ({ jsonrpc: "2.0", id: 2, result: {} }) }, secureStoreName: "Store"
  });
  const running = runStdio(server, input, output);
  input.end('{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}');
  await running;
  assert.equal(writes.length, 1);
  assert.equal(JSON.parse(writes[0]).id, 1);
});

test("CLI exposes browser pairing and never documents token configuration", () => {
  assert.equal(resolveCLICommand([]).kind, "serve");
  assert.equal(resolveCLICommand(["connect"]).kind, "connect");
  const help = resolveCLICommand(["--help"]).text;
  assert.match(help, /swarm-mcp connect/);
  assert.match(help, /Keychain, Credential Manager, or Secret Service/);
  assert.doesNotMatch(help, /SWARM_API_TOKEN|bearer token|Download Env/i);
  assert.throws(() => resolveCLICommand(["unknown"]), /Unknown/);
});

test("remote failures are sanitized at the stdio protocol boundary", async () => {
  const server = new SwarmMCPServer({
    config: testConfig(), remoteClient: { request: async () => { throw new Error("swr_secret raw provider payload"); } }, secureStoreName: "Store"
  });
  await server.handle({ jsonrpc: "2.0", id: 1, method: "initialize", params: {} });
  const response = await server.handle({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} });
  assert.deepEqual(response.error, { code: -32603, message: "Swarm request failed" });
  assert.doesNotMatch(JSON.stringify(response), /swr_|provider payload/);
});
