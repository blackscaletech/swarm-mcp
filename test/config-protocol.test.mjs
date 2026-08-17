import assert from "node:assert/strict";
import test from "node:test";
import { resolveConfig } from "../src/config.mjs";
import { makeServer, listToolNames } from "./helpers.mjs";

test("resolveConfig requires canonical Swarm Connect configuration", () => {
  assert.throws(() => resolveConfig({}), /SWARM_API_TOKEN/);

  const config = resolveConfig({
    SWARM_API_TOKEN: "swarm_mcp_test",
    SWARM_SPACE_ID: "sp_test"
  });

  assert.equal(config.defaultSpaceId, "sp_test");
  assert.equal("defaultAgentId" in config, false);
});

test("resolveConfig rejects unsafe base URLs", () => {
  const config = resolveConfig({
    SWARM_API_TOKEN: "swarm_mcp_test",
    SWARM_MCP_TIMEOUT_MS: "1200"
  });

  assert.equal(config.timeoutMs, 1200);
  assert.throws(
    () => resolveConfig({ SWARM_API_TOKEN: "swarm_mcp_test", SWARM_API_BASE_URL: "file:///tmp/swarm" }),
    /valid https URL/
  );
  assert.throws(
    () => resolveConfig({ SWARM_API_TOKEN: "swarm_mcp_test", SWARM_API_BASE_URL: "http://api.swarm.services" }),
    /valid https URL/
  );
  assert.throws(
    () => resolveConfig({ SWARM_API_TOKEN: "swarm_mcp_test", SWARM_API_BASE_URL: "http://0.0.0.0:8080" }),
    /valid https URL/
  );
  assert.equal(
    resolveConfig({ SWARM_API_TOKEN: "swarm_mcp_test", SWARM_API_BASE_URL: "http://localhost:8080" }).baseUrl,
    "http://localhost:8080"
  );
});

test("server negotiates the latest MCP protocol by default", async () => {
  const server = makeServer();
  const init = await server.handle({ jsonrpc: "2.0", id: 1, method: "initialize", params: {} });

  assert.equal(init.result.protocolVersion, "2025-11-25");
  assert.equal(init.result.serverInfo.name, "Swarm MCP Test");
  assert.deepEqual(Object.keys(init.result.capabilities).sort(), ["prompts", "resources", "tools"]);
});

test("server returns the canonical protocol version for unsupported requests", async () => {
  const server = makeServer();
  const init = await server.handle({
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: { protocolVersion: "legacy-client-version" }
  });

  assert.equal(init.result.protocolVersion, "2025-11-25");
});

test("initialized notification does not create a response", async () => {
  const server = makeServer();
  const response = await server.handle({ jsonrpc: "2.0", method: "notifications/initialized" });
  assert.equal(response, null);
});

test("canonical catalog exposes reads, mutations, intelligence, and execution tools", async () => {
  const toolNames = await listToolNames(makeServer());

  assert.ok(toolNames.includes("swarm_get_space"));
  assert.ok(toolNames.includes("swarm_list_operations"));
  assert.ok(toolNames.includes("swarm_get_space_facet_catalog"));
  assert.ok(toolNames.includes("swarm_post_message"));
  assert.ok(toolNames.includes("swarm_request_agent"));
  assert.ok(toolNames.includes("swarm_launch_run"));
  assert.ok(toolNames.includes("swarm_create_artifact"));
  assert.ok(toolNames.includes("swarm_install_facet"));
  assert.ok(toolNames.includes("swarm_get_artifact_content"));
  assert.equal(toolNames.includes("swarm_create_task"), false);
  assert.equal(toolNames.includes("swarm_acquire_next_run"), false);
});

test("server exposes Swarm workflow prompts", async () => {
  const server = makeServer();
  await server.handle({ jsonrpc: "2.0", id: 1, method: "initialize" });

  const listed = await server.handle({ jsonrpc: "2.0", id: 2, method: "prompts/list" });
  const promptNames = listed.result.prompts.map((prompt) => prompt.name);
  assert.deepEqual(promptNames, ["swarm_operate_space", "swarm_publish_result", "swarm_security_posture"]);

  const prompt = await server.handle({
    jsonrpc: "2.0",
    id: 3,
    method: "prompts/get",
    params: {
      name: "swarm_operate_space",
      arguments: {
        goal: "Build a durable public automation Space",
        space_id: "sp_test"
      }
    }
  });

  assert.equal(prompt.result.messages[0].role, "user");
  assert.match(prompt.result.messages[0].content.text, /Build a durable public automation Space/);
  assert.match(prompt.result.messages[0].content.text, /swarm_get_space/);
});

test("server exposes sanitized Swarm resources", async () => {
  const server = makeServer();
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
  assert.doesNotMatch(text, /access_mode/);
  assert.match(text, /"authenticated": true/);
  assert.doesNotMatch(text, /swarm_mcp_test/);
});
