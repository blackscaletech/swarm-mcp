import assert from "node:assert/strict";
import test from "node:test";
import { resolveConfig } from "../src/config.mjs";
import { SwarmAPIClient, SwarmAPIError } from "../src/http-client.mjs";
import { SwarmMCPServer } from "../src/server.mjs";

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

  const init = await server.handle({
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {}
  });

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

test("search defaults to the configured Space to avoid broad agent fanout", async () => {
  let capturedQuery = null;
  const server = makeServer("operator", {
    search(query) {
      capturedQuery = query;
      return { items: [] };
    }
  });

  await server.handle({ jsonrpc: "2.0", id: 1, method: "initialize" });
  const response = await server.handle({
    jsonrpc: "2.0",
    id: 2,
    method: "tools/call",
    params: { name: "swarm_search", arguments: { q: "vacation options" } }
  });

  assert.equal(response.result.isError, false);
  assert.equal(capturedQuery.q, "vacation options");
  assert.equal(capturedQuery.space_id, "sp_test");
});

test("search preserves explicit entity and Space scopes", async () => {
  const capturedQueries = [];
  const server = makeServer("operator", {
    search(query) {
      capturedQueries.push(query);
      return { items: [] };
    }
  });

  await server.handle({ jsonrpc: "2.0", id: 1, method: "initialize" });
  await server.handle({
    jsonrpc: "2.0",
    id: 2,
    method: "tools/call",
    params: { name: "swarm_search", arguments: { q: "entity", entity_id: "ent_test" } }
  });
  await server.handle({
    jsonrpc: "2.0",
    id: 3,
    method: "tools/call",
    params: { name: "swarm_search", arguments: { q: "space", space_id: "sp_other" } }
  });

  assert.equal(capturedQueries[0].q, "entity");
  assert.equal(capturedQueries[0].entity_id, "ent_test");
  assert.equal(capturedQueries[0].space_id, undefined);
  assert.equal(capturedQueries[1].q, "space");
  assert.equal(capturedQueries[1].space_id, "sp_other");
});

test("ask tools normalize common output-shape shorthands", async () => {
  let capturedInput = null;
  let capturedOptions = null;
  const server = makeServer("operator", {
    askSpace(_spaceId, input, options) {
      capturedInput = input;
      capturedOptions = options;
      return { answer: "ok" };
    }
  });

  await server.handle({ jsonrpc: "2.0", id: 1, method: "initialize" });
  const response = await server.handle({
    jsonrpc: "2.0",
    id: 2,
    method: "tools/call",
    params: {
      name: "swarm_ask_default_space",
      arguments: {
        question: "What changed?",
        desired_output_shape: "brief"
      }
    }
  });

  assert.equal(response.result.isError, false);
  assert.equal(capturedInput.question, "What changed?");
  assert.equal(capturedInput.desired_output_shape, "brief_with_rationale");
  assert.equal(typeof capturedOptions.idempotencyKey, "string");
  assert.equal(capturedOptions.idempotencyKey.startsWith("swarm-mcp-"), true);
});

test("tool calls remain access-mode-gated even before tools/list", async () => {
  const server = makeServer("read-only", {
    createTask() {
      throw new Error("createTask should not be called");
    }
  });

  await server.handle({ jsonrpc: "2.0", id: 1, method: "initialize" });
  const response = await server.handle({
    jsonrpc: "2.0",
    id: 2,
    method: "tools/call",
    params: { name: "swarm_create_task", arguments: { space_id: "sp_test", title: "blocked" } }
  });

  assert.equal(response.result.isError, true);
  assert.match(response.result.content[0].text, /does not permit/);
});

test("operator access mode exposes run execution and publication tools", async () => {
  const toolNames = await listToolNames(makeServer("operator"));

  assert.ok(toolNames.includes("swarm_heartbeat_agent"));
  assert.ok(toolNames.includes("swarm_acquire_next_run"));
  assert.ok(toolNames.includes("swarm_complete_run"));
  assert.ok(toolNames.includes("swarm_create_artifact"));
  assert.ok(toolNames.includes("swarm_record_action_trace"));
  assert.ok(toolNames.includes("swarm_create_task"));
});

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

test("write tools pass idempotency keys to Swarm requests", async () => {
  let launchOptions = null;
  let createTaskOptions = null;
  let heartbeatOptions = null;
  let startRunOptions = null;
  let completeRunOptions = null;
  let releaseLeaseOptions = null;
  const server = makeServer("operator", {
    launchRun(_spaceId, _payload, options) {
      launchOptions = options;
      return { run_id: "run_test" };
    },
    createTask(_payload, options) {
      createTaskOptions = options;
      return { task_id: "task_test" };
    },
    heartbeatAgent(_agentId, _payload, options) {
      heartbeatOptions = options;
      return { agent_id: "agt_test", status_value: "online" };
    },
    startRun(_runId, options) {
      startRunOptions = options;
      return { id: "run_test", status: "running" };
    },
    completeRun(_runId, _payload, options) {
      completeRunOptions = options;
      return { id: "run_test", status: "succeeded" };
    },
    releaseRunLease(_leaseId, options) {
      releaseLeaseOptions = options;
      return { id: "lease_test", status: "released" };
    }
  });

  await server.handle({ jsonrpc: "2.0", id: 1, method: "initialize" });
  await server.handle({
    jsonrpc: "2.0",
    id: 2,
    method: "tools/call",
    params: {
      name: "swarm_launch_run",
      arguments: {
        space_id: "sp_test",
        title: "Launch once",
        description: "Only one run should be created.",
        intent_key: "intent_123"
      }
    }
  });
  await server.handle({
    jsonrpc: "2.0",
    id: 3,
    method: "tools/call",
    params: {
      name: "swarm_create_task",
      arguments: {
        space_id: "sp_test",
        title: "Create once",
        description: "Only one task should be created.",
        idempotency_key: "idem_456"
      }
    }
  });
  await server.handle({
    jsonrpc: "2.0",
    id: 4,
    method: "tools/call",
    params: {
      name: "swarm_heartbeat_agent",
      arguments: {
        status: "online",
        protocol: "mcp",
        idempotency_key: "idem_heartbeat"
      }
    }
  });
  await server.handle({
    jsonrpc: "2.0",
    id: 5,
    method: "tools/call",
    params: {
      name: "swarm_start_run",
      arguments: {
        run_id: "run_test",
        idempotency_key: "idem_start"
      }
    }
  });
  await server.handle({
    jsonrpc: "2.0",
    id: 6,
    method: "tools/call",
    params: {
      name: "swarm_complete_run",
      arguments: {
        run_id: "run_test",
        outcome: "succeeded",
        idempotency_key: "idem_complete"
      }
    }
  });
  await server.handle({
    jsonrpc: "2.0",
    id: 7,
    method: "tools/call",
    params: {
      name: "swarm_release_run_lease",
      arguments: {
        lease_id: "lease_test",
        idempotency_key: "idem_release"
      }
    }
  });

  assert.equal(launchOptions.idempotencyKey, "intent_123");
  assert.equal(createTaskOptions.idempotencyKey, "idem_456");
  assert.equal(heartbeatOptions.idempotencyKey, "idem_heartbeat");
  assert.equal(startRunOptions.idempotencyKey, "idem_start");
  assert.equal(completeRunOptions.idempotencyKey, "idem_complete");
  assert.equal(releaseLeaseOptions.idempotencyKey, "idem_release");
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

test("operation tools validate Swarm Evolution contracts before API calls", async () => {
  const calls = [];
  const server = makeServer("operator", {
    createSpaceIntelligenceOperation(spaceId, input, options) {
      calls.push({ spaceId, input, options });
      return { id: "op_test", operation_kind: input.operation_kind, status: "queued" };
    }
  });

  await server.handle({ jsonrpc: "2.0", id: 1, method: "initialize" });
  const valid = await server.handle({
    jsonrpc: "2.0",
    id: 2,
    method: "tools/call",
    params: {
      name: "swarm_create_default_operation",
      arguments: {
        operation_kind: "optimize",
        capability_key: "reflective_evolution",
        objective: "Improve connector handoff workflow.",
        target_refs: [{ resource_type: "prompt", external_ref: "connector-handoff-v1" }],
        idempotency_key: "idem_operation"
      }
    }
  });

  assert.equal(valid.result.isError, false);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].spaceId, "sp_test");
  assert.equal(calls[0].input.operation_kind, "optimize");
  assert.equal(calls[0].input.target_refs[0].resource_type, "prompt");
  assert.equal(calls[0].options.idempotencyKey, "idem_operation");

  const invalidTarget = await server.handle({
    jsonrpc: "2.0",
    id: 3,
    method: "tools/call",
    params: {
      name: "swarm_create_default_operation",
      arguments: {
        operation_kind: "validate",
        capability_key: "code_trust_review",
        objective: "Validate an invalid target.",
        target_refs: [{ resource_type: "external_ref", external_ref: "not-a-target" }]
      }
    }
  });
  assert.equal(invalidTarget.result.isError, true);
  assert.match(invalidTarget.result.content[0].text, /external_ref is not supported/);
  assert.equal(calls.length, 1);

  const invalidCapability = await server.handle({
    jsonrpc: "2.0",
    id: 4,
    method: "tools/call",
    params: {
      name: "swarm_create_operation",
      arguments: {
        space_id: "sp_test",
        operation_kind: "optimize",
        capability_key: "code_trust_review",
        objective: "Optimize with the wrong capability.",
        target_refs: [{ resource_type: "prompt", external_ref: "connector-handoff-v1" }]
      }
    }
  });
  assert.equal(invalidCapability.result.isError, true);
  assert.match(invalidCapability.result.content[0].text, /code_trust_review is not supported/);
  assert.equal(calls.length, 1);
});

test("learning queue tools use configured Swarm Connect agent attribution", async () => {
  let claimPayload = null;
  let resultPayload = null;
  const server = makeServer("operator", {
    claimSpaceLearningQueueItem(_spaceId, payload) {
      claimPayload = payload;
      return { id: "slq_test", claimed_by_agent_id: payload.agent_id };
    },
    submitSpaceLearningQueueResult(_spaceId, _itemId, payload) {
      resultPayload = payload;
      return {
        item: { id: "slq_test", status: "completed" },
        candidate: { created_by_agent_id: payload.agent_id },
        evaluation: { evaluator_agent_id: payload.agent_id }
      };
    }
  });

  await server.handle({ jsonrpc: "2.0", id: 1, method: "initialize" });
  await server.handle({
    jsonrpc: "2.0",
    id: 2,
    method: "tools/call",
    params: {
      name: "swarm_claim_learning_queue_item",
      arguments: {
        space_id: "sp_test",
        kind: "failure_mining"
      }
    }
  });
  await server.handle({
    jsonrpc: "2.0",
    id: 3,
    method: "tools/call",
    params: {
      name: "swarm_submit_learning_queue_result",
      arguments: {
        space_id: "sp_test",
        item_id: "slq_test",
        artifact: {
          kind: "mcp.operator.result",
          title: "MCP operator result",
          body: "Operator queue result.",
          media_type: "text/plain"
        }
      }
    }
  });

  assert.equal(claimPayload.agent_id, "agt_test");
  assert.equal(resultPayload.agent_id, "agt_test");
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
        Authorization: "Bearer secret-token"
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

function makeServer(accessMode, client = {}) {
  return new SwarmMCPServer({
    config: {
      baseUrl: "https://api.swarm.services",
      token: "swarm_mcp_test",
      defaultSpaceId: "sp_test",
      defaultAgentId: "agt_test",
      accessMode,
      serverName: "Swarm MCP Test"
    },
    client
  });
}

async function listToolNames(server) {
  await server.handle({ jsonrpc: "2.0", id: 1, method: "initialize" });
  const tools = await server.handle({ jsonrpc: "2.0", id: 2, method: "tools/list" });
  return tools.result.tools.map((tool) => tool.name);
}
