import assert from "node:assert/strict";
import test from "node:test";
import { resolveConfig } from "../src/config.mjs";
import { makeServer, listToolNames } from "./helpers.mjs";

test("resolveConfig requires a token and supports read-only Swarm Connect", () => {
  assert.throws(() => resolveConfig({}), /SWARM_MCP_TOKEN/);

  const config = resolveConfig({
    SWARM_MCP_TOKEN: "swarm_mcp_test",
    SWARM_MCP_ACCESS_MODE: "read-only",
    SWARM_MCP_DEFAULT_SPACE_ID: "sp_test",
    SWARM_MCP_AGENT_ID: "agt_test"
  });

  assert.equal(config.accessMode, "read-only");
  assert.equal(config.defaultSpaceId, "sp_test");
  assert.equal(config.defaultAgentId, "agt_test");
});

test("resolveConfig defaults to operator and rejects unsafe base URLs", () => {
  const config = resolveConfig({
    SWARM_MCP_TOKEN: "swarm_mcp_test",
    SWARM_MCP_TIMEOUT_MS: "1200"
  });

  assert.equal(config.accessMode, "operator");
  assert.equal(config.timeoutMs, 1200);
  assert.throws(
    () => resolveConfig({ SWARM_MCP_TOKEN: "swarm_mcp_test", SWARM_MCP_BASE_URL: "file:///tmp/swarm" }),
    /valid https URL/
  );
  assert.throws(
    () => resolveConfig({ SWARM_MCP_TOKEN: "swarm_mcp_test", SWARM_MCP_BASE_URL: "http://api.swarm.services" }),
    /valid https URL/
  );
  assert.throws(
    () => resolveConfig({ SWARM_MCP_TOKEN: "swarm_mcp_test", SWARM_MCP_BASE_URL: "http://0.0.0.0:8080" }),
    /valid https URL/
  );
  assert.equal(
    resolveConfig({ SWARM_MCP_TOKEN: "swarm_mcp_test", SWARM_MCP_BASE_URL: "http://localhost:8080" }).baseUrl,
    "http://localhost:8080"
  );
});

test("server negotiates the latest MCP protocol by default", async () => {
  const server = makeServer("read-only");
  const init = await server.handle({ jsonrpc: "2.0", id: 1, method: "initialize", params: {} });

  assert.equal(init.result.protocolVersion, "2025-11-25");
  assert.equal(init.result.serverInfo.name, "Swarm MCP Test");
  assert.deepEqual(Object.keys(init.result.capabilities).sort(), ["prompts", "resources", "tools"]);
});

test("server returns the canonical protocol version for unsupported requests", async () => {
  const server = makeServer("read-only");
  const init = await server.handle({
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: { protocolVersion: "legacy-client-version" }
  });

  assert.equal(init.result.protocolVersion, "2025-11-25");
});

test("initialized notification does not create a response", async () => {
  const server = makeServer("operator");
  const response = await server.handle({ jsonrpc: "2.0", method: "notifications/initialized" });
  assert.equal(response, null);
});

test("read-only mode exposes read tools without mutation tools", async () => {
  const toolNames = await listToolNames(makeServer("read-only"));

  assert.ok(toolNames.includes("swarm_search"));
  assert.ok(toolNames.includes("swarm_discover_space_contract"));
  assert.ok(toolNames.includes("swarm_list_space_capabilities"));
  assert.ok(toolNames.includes("swarm_list_operations"));
  assert.ok(!toolNames.includes("swarm_create_task"));
  assert.ok(!toolNames.includes("swarm_complete_run"));
});

test("operator mode exposes normal Space work and Evolution tools", async () => {
  const toolNames = await listToolNames(makeServer("operator"));

  assert.ok(toolNames.includes("swarm_create_task"));
  assert.ok(toolNames.includes("swarm_launch_run"));
  assert.ok(toolNames.includes("swarm_create_operation"));
  assert.ok(toolNames.includes("swarm_cancel_operation"));
  assert.ok(toolNames.includes("swarm_acquire_next_run"));
  assert.ok(toolNames.includes("swarm_complete_run"));
  assert.ok(toolNames.includes("swarm_create_artifact"));
  assert.ok(toolNames.includes("swarm_record_action_trace"));
});

test("server exposes Swarm workflow prompts", async () => {
  const server = makeServer("operator");
  await server.handle({ jsonrpc: "2.0", id: 1, method: "initialize" });

  const listed = await server.handle({ jsonrpc: "2.0", id: 2, method: "prompts/list" });
  const promptNames = listed.result.prompts.map((prompt) => prompt.name);
  assert.deepEqual(promptNames, [
    "swarm_onboarding",
    "swarm_operate_space",
    "swarm_execute_assigned_run",
    "swarm_publish_durable_artifact",
    "swarm_context_pack_workflow",
    "swarm_security_posture",
    "swarm_weekly_digest"
  ]);

  const prompt = await server.handle({
    jsonrpc: "2.0",
    id: 3,
    method: "prompts/get",
    params: {
      name: "swarm_operate_space",
      arguments: {
        goal: "Build a durable public automation Space",
        agent_role: "curator"
      }
    }
  });

  assert.equal(prompt.result.messages[0].role, "user");
  assert.match(prompt.result.messages[0].content.text, /Build a durable public automation Space/);
  assert.match(prompt.result.messages[0].content.text, /Persist all useful outputs in Swarm/);
});

test("server exposes sanitized Swarm resources", async () => {
  const server = makeServer("operator");
  await server.handle({ jsonrpc: "2.0", id: 1, method: "initialize" });

  const listed = await server.handle({ jsonrpc: "2.0", id: 2, method: "resources/list" });
  const uris = listed.result.resources.map((resource) => resource.uri);
  assert.ok(uris.includes("swarm://connection/status"));
  assert.ok(uris.includes("swarm://docs/security-model"));

  const resource = await server.handle({
    jsonrpc: "2.0",
    id: 3,
    method: "resources/read",
    params: { uri: "swarm://connection/status" }
  });
  const text = resource.result.contents[0].text;
  assert.match(text, /"access_mode": "operator"/);
  assert.match(text, /"token_value": "\[redacted\]"/);
  assert.doesNotMatch(text, /swarm_mcp_test/);
});

test("bootstrap tool gives a safe first-run connection summary", async () => {
  const server = makeServer("operator");
  await server.handle({ jsonrpc: "2.0", id: 1, method: "initialize" });
  const response = await server.handle({
    jsonrpc: "2.0",
    id: 2,
    method: "tools/call",
    params: { name: "swarm_bootstrap", arguments: {} }
  });

  assert.equal(response.result.isError, false);
  assert.equal(response.result.structuredContent.access_mode, "operator");
  assert.equal(response.result.structuredContent.default_space_id, "sp_test");
  assert.equal(response.result.structuredContent.default_agent_id, "agt_test");
  assert.equal(response.result.structuredContent.token_value, "[redacted]");
  assert.doesNotMatch(response.result.content[0].text, /swarm_mcp_test/);
});
