export const CORE_READ_TOOL_DEFINITIONS = [
  {
    name: "swarm_bootstrap",
    title: "Bootstrap Swarm Connection",
    description:
      "Inspect this MCP server's sanitized Swarm connection state, access mode, default Space, Swarm Connect identity, allowed tool count, and recommended first tools. This does not call Swarm or mutate state.",
    inputSchema: {
      type: "object",
      properties: {}
    }
  },
  {
    name: "swarm_list_agents",
    title: "List Swarm Agents",
    description: "List Swarm agents visible to the authenticated principal.",
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
    name: "swarm_list_spaces",
    title: "List Swarm Spaces",
    description: "List spaces visible to the authenticated Swarm principal.",
    inputSchema: {
      type: "object",
      properties: {
        entity_id: { type: "string" },
        limit: { type: "integer", minimum: 1, maximum: 500 },
        cursor: { type: "string" },
        order: { type: "string", enum: ["asc", "desc"] }
      }
    }
  },
  {
    name: "swarm_get_default_space",
    title: "Get Default Space",
    description: "Read the Swarm Space configured as this Swarm Connector's default Space.",
    inputSchema: {
      type: "object",
      properties: {}
    }
  },
  {
    name: "swarm_list_default_space_runs",
    title: "List Default Space Runs",
    description: "List runs in this Swarm Connector's configured default Space.",
    inputSchema: {
      type: "object",
      properties: {
        task_id: { type: "string" },
        status: {
          type: "string",
          enum: ["blocked", "queued", "leased", "running", "succeeded", "failed", "canceled"]
        },
        limit: { type: "integer", minimum: 1, maximum: 500 },
        cursor: { type: "string" },
        order: { type: "string", enum: ["asc", "desc"] }
      }
    }
  },
  {
    name: "swarm_list_default_space_activity",
    title: "List Default Space Activity",
    description: "List activity in this Swarm Connector's configured default Space.",
    inputSchema: {
      type: "object",
      properties: {
        resource_type: { type: "string" },
        limit: { type: "integer", minimum: 1, maximum: 500 },
        cursor: { type: "string" },
        order: { type: "string", enum: ["asc", "desc"] }
      }
    }
  },
  {
    name: "swarm_get_space_operator_summary",
    title: "Get Space Summary",
    description: "Read the operator summary for one Swarm space.",
    inputSchema: {
      type: "object",
      properties: {
        space_id: { type: "string" }
      },
      required: ["space_id"]
    }
  },
  {
    name: "swarm_list_space_operator_activity",
    title: "List Space Activity",
    description: "List enriched operator activity entries for one space.",
    inputSchema: {
      type: "object",
      properties: {
        space_id: { type: "string" },
        resource_type: { type: "string" },
        limit: { type: "integer", minimum: 1, maximum: 500 },
        cursor: { type: "string" },
        order: { type: "string", enum: ["asc", "desc"] }
      },
      required: ["space_id"]
    }
  },
  {
    name: "swarm_list_space_operator_presence",
    title: "List Space Presence",
    description: "List enriched operator presence entries for one space.",
    inputSchema: {
      type: "object",
      properties: {
        space_id: { type: "string" },
        status: { type: "string", enum: ["online", "idle", "busy", "offline"] },
        limit: { type: "integer", minimum: 1, maximum: 500 },
        cursor: { type: "string" },
        order: { type: "string", enum: ["asc", "desc"] }
      },
      required: ["space_id"]
    }
  },
  {
    name: "swarm_list_space_signed_status",
    title: "List Space Signed Status",
    description: "List runtime receipt signature status entries for one space.",
    inputSchema: {
      type: "object",
      properties: {
        space_id: { type: "string" },
        agent_id: { type: "string" },
        run_id: { type: "string" },
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
      },
      required: ["space_id"]
    }
  },
  {
    name: "swarm_list_agent_capability_manifests",
    title: "List Agent Capability Manifests",
    description: "List Swarm agent capability manifests for a space or agent.",
    inputSchema: {
      type: "object",
      properties: {
        space_id: { type: "string" },
        agent_id: { type: "string" },
        limit: { type: "integer", minimum: 1, maximum: 500 },
        cursor: { type: "string" },
        order: { type: "string", enum: ["asc", "desc"] }
      }
    }
  },
  {
    name: "swarm_list_agent_presence",
    title: "List Agent Presence",
    description: "List current Swarm agent heartbeat and presence records.",
    inputSchema: {
      type: "object",
      properties: {
        space_id: { type: "string" },
        agent_id: { type: "string" },
        status: { type: "string", enum: ["online", "idle", "busy", "offline"] },
        limit: { type: "integer", minimum: 1, maximum: 500 },
        cursor: { type: "string" },
        order: { type: "string", enum: ["asc", "desc"] }
      }
    }
  },
  {
    name: "swarm_list_runs",
    title: "List Swarm Runs",
    description: "List runs in a space or by task/status filter.",
    inputSchema: {
      type: "object",
      properties: {
        space_id: { type: "string" },
        task_id: { type: "string" },
        status: {
          type: "string",
          enum: ["blocked", "queued", "leased", "running", "succeeded", "failed", "canceled"]
        },
        limit: { type: "integer", minimum: 1, maximum: 500 },
        cursor: { type: "string" },
        order: { type: "string", enum: ["asc", "desc"] }
      }
    }
  },
  {
    name: "swarm_list_tasks",
    title: "List Swarm Tasks",
    description: "List tasks in a Space.",
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
    name: "swarm_get_task",
    title: "Get Swarm Task",
    description: "Read one task by ID.",
    inputSchema: {
      type: "object",
      properties: {
        task_id: { type: "string" }
      },
      required: ["task_id"]
    }
  },
  {
    name: "swarm_list_launch_templates",
    title: "List Launch Templates",
    description: "List Swarm launch templates available to the authenticated principal.",
    inputSchema: {
      type: "object",
      properties: {
        space_id: { type: "string" },
        active_only: { type: "boolean" },
        limit: { type: "integer", minimum: 1, maximum: 500 },
        cursor: { type: "string" },
        order: { type: "string", enum: ["asc", "desc"] }
      }
    }
  },
  {
    name: "swarm_get_run_context",
    title: "Get Run Context",
    description: "Resolve the ordered upstream context attached to one Swarm run.",
    inputSchema: {
      type: "object",
      properties: {
        run_id: { type: "string" }
      },
      required: ["run_id"]
    }
  },
  {
    name: "swarm_search",
    title: "Search Swarm Records",
    description: "Search indexed Swarm records. Defaults to the configured Space when no entity or Space is supplied.",
    inputSchema: {
      type: "object",
      properties: {
        q: { type: "string" },
        entity_id: { type: "string" },
        space_id: { type: "string" },
        resource_type: {
          type: "string",
          enum: ["space", "agent", "task", "run", "artifact", "evaluation", "audit_event"]
        },
        limit: { type: "integer", minimum: 1, maximum: 100 },
        cursor: { type: "string" },
        order: { type: "string", enum: ["asc", "desc"] }
      },
      required: ["q"]
    }
  },
  {
    name: "swarm_search_public",
    title: "Search Public Swarm Records",
    description: "Search explicitly public Swarm space and agent projections.",
    inputSchema: {
      type: "object",
      properties: {
        q: { type: "string" },
        resource_type: {
          type: "string",
          enum: ["space", "agent"]
        },
        limit: { type: "integer", minimum: 1, maximum: 100 },
        cursor: { type: "string" },
        order: { type: "string", enum: ["asc", "desc"] }
      },
      required: ["q"]
    }
  },
  {
    name: "swarm_list_audit_events",
    title: "List Audit Events",
    description: "List Swarm audit events for a space or entity scope.",
    inputSchema: {
      type: "object",
      properties: {
        entity_id: { type: "string" },
        space_id: { type: "string" },
        resource_type: { type: "string" },
        resource_id: { type: "string" },
        limit: { type: "integer", minimum: 1, maximum: 500 },
        cursor: { type: "string" },
        order: { type: "string", enum: ["asc", "desc"] }
      }
    }
  },
  {
    name: "swarm_get_artifact_content",
    title: "Get Artifact Content",
    description: "Read the body of a Swarm artifact.",
    inputSchema: {
      type: "object",
      properties: {
        artifact_id: { type: "string" }
      },
      required: ["artifact_id"]
    }
  }
];
