import {
  SPACE_INTELLIGENCE_STATUSES,
  SPACE_LEARNING_QUEUE_KINDS,
  SPACE_LEARNING_QUEUE_STATUSES,
  SPACE_OPERATION_STATUSES,
  SPACE_PROMOTION_GATE_DECISIONS,
  pageToolProperties
} from "./tool-catalog-base.mjs";

export const INTELLIGENCE_READ_TOOL_DEFINITIONS = [
  {
    name: "swarm_list_space_answers",
    title: "List Space Answers",
    description: "List persisted grounded answers for one Swarm space.",
    inputSchema: {
      type: "object",
      properties: {
        space_id: { type: "string" },
        ...pageToolProperties()
      },
      required: ["space_id"]
    }
  },
  {
    name: "swarm_get_space_answer",
    title: "Get Space Answer",
    description: "Read one persisted grounded answer for a Swarm space.",
    inputSchema: {
      type: "object",
      properties: {
        space_id: { type: "string" },
        answer_id: { type: "string" }
      },
      required: ["space_id", "answer_id"]
    }
  },
  {
    name: "swarm_get_space_answer_contract",
    title: "Get Space Answer Contract",
    description: "Read the answer contract and trust boundary for one Swarm space.",
    inputSchema: {
      type: "object",
      properties: {
        space_id: { type: "string" }
      },
      required: ["space_id"]
    }
  },
  {
    name: "swarm_discover_space_contract",
    title: "Discover Space Work Contract",
    description: "Read the neutral Space work contract, stack layers, basic collaboration rules, capabilities, and agent instructions.",
    inputSchema: {
      type: "object",
      properties: {
        space_id: { type: "string" }
      },
      required: ["space_id"]
    }
  },
  {
    name: "swarm_list_space_capabilities",
    title: "List Space Capabilities",
    description: "List the capability patterns available for one Swarm space.",
    inputSchema: {
      type: "object",
      properties: {
        space_id: { type: "string" }
      },
      required: ["space_id"]
    }
  },
  {
    name: "swarm_get_space_operation_contract",
    title: "Get Space Operation Contract",
    description: "Read the input, output, budget, trust, and promotion contract for a supported Space operation kind.",
    inputSchema: {
      type: "object",
      properties: {
        space_id: { type: "string" },
        operation_kind: { type: "string" }
      },
      required: ["space_id", "operation_kind"]
    }
  },
  {
    name: "swarm_list_operations",
    title: "List Space Operations",
    description: "List neutral Swarm Evolution operation records for one space.",
    inputSchema: {
      type: "object",
      properties: {
        space_id: { type: "string" },
        operation_kind: { type: "string" },
        capability_key: { type: "string" },
        status: { type: "string", enum: SPACE_OPERATION_STATUSES },
        ...pageToolProperties()
      },
      required: ["space_id"]
    }
  },
  {
    name: "swarm_get_operation",
    title: "Get Space Operation",
    description: "Read one neutral Swarm Evolution operation record.",
    inputSchema: {
      type: "object",
      properties: {
        space_id: { type: "string" },
        operation_id: { type: "string" }
      },
      required: ["space_id", "operation_id"]
    }
  },
  {
    name: "swarm_get_space_decision_graph",
    title: "Get Space Decision Graph",
    description: "Read the derived decision graph for one Swarm space.",
    inputSchema: {
      type: "object",
      properties: {
        space_id: { type: "string" }
      },
      required: ["space_id"]
    }
  },
  {
    name: "swarm_list_space_learning_candidates",
    title: "List Space Learning Candidates",
    description: "List candidate memory/projection updates for one Swarm space.",
    inputSchema: {
      type: "object",
      properties: {
        space_id: { type: "string" },
        family: { type: "string" },
        status: { type: "string", enum: SPACE_INTELLIGENCE_STATUSES },
        ...pageToolProperties()
      },
      required: ["space_id"]
    }
  },
  {
    name: "swarm_list_space_promotion_gates",
    title: "List Space Promotion Gates",
    description: "List validation and promotion decisions for Space Intelligence candidates.",
    inputSchema: {
      type: "object",
      properties: {
        space_id: { type: "string" },
        candidate_id: { type: "string" },
        projection_id: { type: "string" },
        decision: { type: "string", enum: SPACE_PROMOTION_GATE_DECISIONS },
        ...pageToolProperties()
      },
      required: ["space_id"]
    }
  },
  {
    name: "swarm_list_space_intelligence_projections",
    title: "List Space Intelligence Projections",
    description: "List promoted or candidate decision projections for one Swarm space.",
    inputSchema: {
      type: "object",
      properties: {
        space_id: { type: "string" },
        family: { type: "string" },
        status: { type: "string", enum: SPACE_INTELLIGENCE_STATUSES },
        ...pageToolProperties()
      },
      required: ["space_id"]
    }
  },
  {
    name: "swarm_list_space_learning_queue",
    title: "List Space Learning Queue",
    description: "List active learning queue items for one Swarm space.",
    inputSchema: {
      type: "object",
      properties: {
        space_id: { type: "string" },
        kind: { type: "string", enum: SPACE_LEARNING_QUEUE_KINDS },
        family: { type: "string" },
        status: { type: "string", enum: SPACE_LEARNING_QUEUE_STATUSES },
        due_only: { type: "boolean" },
        ...pageToolProperties()
      },
      required: ["space_id"]
    }
  },
  {
    name: "swarm_get_space_learning_frontier",
    title: "Get Space Learning Frontier",
    description: "Read Space Intelligence learning progress metrics for one Swarm space.",
    inputSchema: {
      type: "object",
      properties: {
        space_id: { type: "string" }
      },
      required: ["space_id"]
    }
  }
];
