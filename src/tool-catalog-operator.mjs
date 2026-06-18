const RUN_REQUIREMENTS_SCHEMA = {
  type: "object",
  properties: {
    target_agent_ids: { type: "array", items: { type: "string" } },
    required_capabilities: { type: "array", items: { type: "string" } },
    required_tools: { type: "array", items: { type: "string" } },
    required_models: { type: "array", items: { type: "string" } },
    required_connectors: { type: "array", items: { type: "string" } },
    required_regions: { type: "array", items: { type: "string" } },
    required_protocols: { type: "array", items: { type: "string" } },
    required_hosting_mode: { type: "string" },
    required_runtime_human_action_tags: { type: "array", items: { type: "string" } }
  }
};

const RUN_CONTEXT_REFS_SCHEMA = {
  type: "array",
  items: {
    type: "object",
    properties: {
      resource_type: { type: "string", enum: ["run", "task", "artifact", "evaluation"] },
      resource_id: { type: "string" }
    },
    required: ["resource_type", "resource_id"]
  }
};

const IDEMPOTENCY_PROPERTY = { idempotency_key: { type: "string" } };

function launchRunProperties({ includeSpaceId = false, includeAgentLease = false } = {}) {
  return {
    ...(includeSpaceId ? { space_id: { type: "string" } } : {}),
    ...(includeAgentLease ? {
      agent_id: { type: "string" },
      ttl_seconds: { type: "integer", minimum: 1 }
    } : {}),
    automation_profile_id: { type: "string" },
    launch_template_id: { type: "string" },
    title: { type: "string" },
    description: { type: "string" },
    execution_policy_id: { type: "string" },
    prompt_capture_mode: { type: "string", enum: ["off", "compiled_only", "raw_and_compiled"] },
    source_prompt: { type: "string" },
    compiled_brief: { type: "string" },
    run_requirements: RUN_REQUIREMENTS_SCHEMA,
    run_context_refs: RUN_CONTEXT_REFS_SCHEMA,
    intent_key: { type: "string" },
    ...IDEMPOTENCY_PROPERTY
  };
}

export function buildOperatorMutationToolDefinitions() {
  return [
    {
      name: "swarm_launch_run",
      title: "Launch Run",
      description: "Create a new task and initial run together inside one Swarm space.",
      inputSchema: {
        type: "object",
        properties: launchRunProperties({ includeSpaceId: true }),
        required: ["space_id"]
      }
    },
    {
      name: "swarm_launch_default_run",
      title: "Launch Default Space Run",
      description: "Create a new task and initial run in this Swarm Connector's configured default Space.",
      inputSchema: {
        type: "object",
        properties: launchRunProperties()
      }
    },
    {
      name: "swarm_launch_and_acquire_run",
      title: "Launch And Acquire Run",
      description: "Create one exact Swarm task and run, then issue the initial lease to the selected runtime.",
      inputSchema: {
        type: "object",
        properties: launchRunProperties({ includeSpaceId: true, includeAgentLease: true }),
        required: ["space_id"]
      }
    },
    {
      name: "swarm_create_task",
      title: "Create Task",
      description: "Create a queued Swarm task without launching a run yet.",
      inputSchema: {
        type: "object",
        properties: {
          space_id: { type: "string" },
          title: { type: "string" },
          description: { type: "string" },
          ...IDEMPOTENCY_PROPERTY
        },
        required: ["space_id", "title", "description"]
      }
    },
    {
      name: "swarm_update_task",
      title: "Update Task",
      description: "Edit a task before it has executed.",
      inputSchema: {
        type: "object",
        properties: {
          task_id: { type: "string" },
          title: { type: "string" },
          description: { type: "string" }
        },
        required: ["task_id", "title", "description"]
      }
    },
    {
      name: "swarm_cancel_task",
      title: "Cancel Task",
      description: "Cancel a task that has not executed.",
      inputSchema: {
        type: "object",
        properties: {
          task_id: { type: "string" },
          reason: { type: "string" }
        },
        required: ["task_id"]
      }
    },
    {
      name: "swarm_request_run_stop",
      title: "Request Run Stop",
      description: "Request cooperative stop for a Swarm run.",
      inputSchema: {
        type: "object",
        properties: {
          run_id: { type: "string" },
          reason: { type: "string" }
        },
        required: ["run_id"]
      }
    },
    {
      name: "swarm_create_budget_delegation",
      title: "Create Budget Delegation",
      description: "Create a bounded Swarm budget delegation.",
      inputSchema: {
        type: "object",
        properties: {
          account_id: { type: "string" },
          target_agent_id: { type: "string" },
          target_run_id: { type: "string" },
          approval_request_id: { type: "string" },
          amount: { type: "integer", minimum: 1 },
          reason: { type: "string" },
          ...IDEMPOTENCY_PROPERTY
        },
        required: ["account_id", "amount"]
      }
    },
    {
      name: "swarm_consume_budget_delegation",
      title: "Consume Budget Delegation",
      description: "Record usage against a Swarm budget delegation.",
      inputSchema: {
        type: "object",
        properties: {
          delegation_id: { type: "string" },
          amount: { type: "integer", minimum: 1 },
          reason: { type: "string" }
        },
        required: ["delegation_id", "amount"]
      }
    },
    {
      name: "swarm_revoke_budget_delegation",
      title: "Revoke Budget Delegation",
      description: "Revoke a Swarm budget delegation and release any remaining balance.",
      inputSchema: {
        type: "object",
        properties: {
          delegation_id: { type: "string" },
          reason: { type: "string" }
        },
        required: ["delegation_id"]
      }
    },
    {
      name: "swarm_create_approval_request",
      title: "Create Approval Request",
      description: "Create a Swarm approval request.",
      inputSchema: {
        type: "object",
        properties: {
          space_id: { type: "string" },
          resource_type: { type: "string" },
          resource_id: { type: "string" },
          action: { type: "string" },
          summary: { type: "string" },
          ...IDEMPOTENCY_PROPERTY
        },
        required: ["space_id", "resource_type", "action", "summary"]
      }
    },
    {
      name: "swarm_approve_approval_request",
      title: "Approve Approval Request",
      description: "Approve a pending Swarm approval request.",
      inputSchema: {
        type: "object",
        properties: {
          request_id: { type: "string" },
          resolution_note: { type: "string" }
        },
        required: ["request_id"]
      }
    },
    {
      name: "swarm_reject_approval_request",
      title: "Reject Approval Request",
      description: "Reject a pending Swarm approval request.",
      inputSchema: {
        type: "object",
        properties: {
          request_id: { type: "string" },
          resolution_note: { type: "string" }
        },
        required: ["request_id"]
      }
    }
  ];
}
