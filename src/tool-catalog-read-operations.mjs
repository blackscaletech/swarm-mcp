export const OPERATIONAL_READ_TOOL_DEFINITIONS = [
  {
    name: "swarm_list_runtime_receipts",
    title: "List Runtime Receipts",
    description: "List signed Swarm runtime receipts for trust inspection.",
    inputSchema: {
      type: "object",
      properties: {
        space_id: { type: "string" },
        agent_id: { type: "string" },
        run_id: { type: "string" },
        run_lease_id: { type: "string" },
        action: {
          type: "string",
          enum: [
            "run_lease.acquired",
            "run_lease.renewed",
            "run_lease.released",
            "artifact.created",
            "evaluation.created"
          ]
        },
        limit: { type: "integer", minimum: 1, maximum: 500 },
        cursor: { type: "string" },
        order: { type: "string", enum: ["asc", "desc"] }
      }
    }
  },
  {
    name: "swarm_verify_runtime_receipt",
    title: "Verify Runtime Receipt",
    description: "Verify one Swarm runtime receipt signature.",
    inputSchema: {
      type: "object",
      properties: {
        receipt_id: { type: "string" }
      },
      required: ["receipt_id"]
    }
  },
  {
    name: "swarm_list_budget_accounts",
    title: "List Budget Accounts",
    description: "List Swarm space budget accounts.",
    inputSchema: {
      type: "object",
      properties: {
        space_id: { type: "string" },
        limit: { type: "integer", minimum: 1, maximum: 500 },
        cursor: { type: "string" },
        order: { type: "string", enum: ["asc", "desc"] }
      }
    }
  },
  {
    name: "swarm_list_budget_ledger_entries",
    title: "List Budget Ledger Entries",
    description: "List Swarm budget ledger entries with optional filters.",
    inputSchema: {
      type: "object",
      properties: {
        space_id: { type: "string" },
        account_id: { type: "string" },
        delegation_id: { type: "string" },
        target_agent_id: { type: "string" },
        target_run_id: { type: "string" },
        approval_request_id: { type: "string" },
        kind: { type: "string", enum: ["fund", "delegate", "consume", "release"] },
        limit: { type: "integer", minimum: 1, maximum: 500 },
        cursor: { type: "string" },
        order: { type: "string", enum: ["asc", "desc"] }
      }
    }
  },
  {
    name: "swarm_list_budget_delegations",
    title: "List Budget Delegations",
    description: "List Swarm budget delegations for one space, account, or agent.",
    inputSchema: {
      type: "object",
      properties: {
        space_id: { type: "string" },
        account_id: { type: "string" },
        target_agent_id: { type: "string" },
        target_run_id: { type: "string" },
        approval_request_id: { type: "string" },
        status: { type: "string", enum: ["active", "exhausted", "revoked"] },
        limit: { type: "integer", minimum: 1, maximum: 500 },
        cursor: { type: "string" },
        order: { type: "string", enum: ["asc", "desc"] }
      }
    }
  },
  {
    name: "swarm_list_approval_requests",
    title: "List Approval Requests",
    description: "List Swarm approval requests for a space or resource.",
    inputSchema: {
      type: "object",
      properties: {
        space_id: { type: "string" },
        resource_type: { type: "string" },
        resource_id: { type: "string" },
        status: { type: "string", enum: ["pending", "approved", "rejected"] },
        limit: { type: "integer", minimum: 1, maximum: 500 },
        cursor: { type: "string" },
        order: { type: "string", enum: ["asc", "desc"] }
      }
    }
  },
  {
    name: "swarm_list_directory_spaces",
    title: "List Space Directory Entries",
    description: "List discoverable Swarm spaces from the directory surface.",
    inputSchema: {
      type: "object",
      properties: {
        limit: { type: "integer", minimum: 1, maximum: 500 },
        cursor: { type: "string" },
        order: { type: "string", enum: ["asc", "desc"] }
      }
    }
  },
  {
    name: "swarm_list_directory_agents",
    title: "List Agent Directory Entries",
    description: "List discoverable Swarm agents from the directory surface.",
    inputSchema: {
      type: "object",
      properties: {
        space_id: { type: "string" },
        limit: { type: "integer", minimum: 1, maximum: 500 },
        cursor: { type: "string" },
        order: { type: "string", enum: ["asc", "desc"] }
      }
    }
  }
];
