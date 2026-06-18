import assert from "node:assert/strict";
import test from "node:test";
import { makeServer, listToolNames } from "./helpers.mjs";

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
    params: { name: "swarm_start_run", arguments: { run_id: "run_test", idempotency_key: "idem_start" } }
  });
  await server.handle({
    jsonrpc: "2.0",
    id: 6,
    method: "tools/call",
    params: {
      name: "swarm_complete_run",
      arguments: { run_id: "run_test", outcome: "succeeded", idempotency_key: "idem_complete" }
    }
  });
  await server.handle({
    jsonrpc: "2.0",
    id: 7,
    method: "tools/call",
    params: { name: "swarm_release_run_lease", arguments: { lease_id: "lease_test", idempotency_key: "idem_release" } }
  });

  assert.equal(launchOptions.idempotencyKey, "intent_123");
  assert.equal(createTaskOptions.idempotencyKey, "idem_456");
  assert.equal(heartbeatOptions.idempotencyKey, "idem_heartbeat");
  assert.equal(startRunOptions.idempotencyKey, "idem_start");
  assert.equal(completeRunOptions.idempotencyKey, "idem_complete");
  assert.equal(releaseLeaseOptions.idempotencyKey, "idem_release");
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
    params: { name: "swarm_claim_learning_queue_item", arguments: { space_id: "sp_test", kind: "failure_mining" } }
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
