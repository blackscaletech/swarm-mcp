import {
  identifier,
  optionalText,
  pageProperties,
  readContract
} from "./tool-contracts-common.mjs";

const spaceId = identifier("Swarm Space ID. Uses SWARM_SPACE_ID when omitted.");
const order = optionalText("Canonical page order: asc or desc.", 8);

function spaceRead({ name, title, description, suffix, filters = {}, page = false, required = [], pathParams = {} }) {
  const properties = { space_id: spaceId, ...filters, ...(page ? { ...pageProperties, order } : {}) };
  return readContract({
    name,
    title,
    description,
    path: `/v1/spaces/{spaceId}/${suffix}`,
    properties,
    required,
    pathParams: { spaceId: "space_id", ...pathParams },
    queryParams: page
      ? Object.fromEntries(
          Object.keys({ ...filters, ...pageProperties, order }).map((key) => [key, key])
        )
      : {},
    defaultSpace: true
  });
}

export const INTELLIGENCE_READ_TOOL_CONTRACTS = [
  spaceRead({
    name: "swarm_list_answers",
    title: "List Space answers",
    description: "Read one bounded page of authorized Space answers.",
    suffix: "answers",
    filters: {
      confidence: optionalText("Optional registered confidence key.", 128),
      visibility: optionalText("Optional registered visibility key.", 128)
    },
    page: true
  }),
  spaceRead({
    name: "swarm_get_answer",
    title: "Get Space answer",
    description: "Read one authorized Space answer.",
    suffix: "answers/{answerId}",
    filters: { answer_id: identifier("Space answer ID.") },
    required: ["answer_id"],
    pathParams: { answerId: "answer_id" }
  }),
  spaceRead({
    name: "swarm_get_answer_contract",
    title: "Get answer contract",
    description: "Read the canonical answer contract for a Space.",
    suffix: "answer-contract"
  }),
  spaceRead({
    name: "swarm_get_work_contract",
    title: "Get work contract",
    description: "Read the canonical work contract for a Space.",
    suffix: "work-contract"
  }),
  spaceRead({
    name: "swarm_list_capabilities",
    title: "List Space capabilities",
    description: "Read registered intelligence capabilities available in a Space.",
    suffix: "capabilities"
  }),
  spaceRead({
    name: "swarm_get_operation_contract",
    title: "Get operation contract",
    description: "Read one registered Space operation contract.",
    suffix: "operation-contracts/{operationKind}",
    filters: { operation_kind: identifier("Registered operation kind key.") },
    required: ["operation_kind"],
    pathParams: { operationKind: "operation_kind" }
  }),
  spaceRead({
    name: "swarm_list_operations",
    title: "List Space operations",
    description: "Read one bounded page of authorized Space operations.",
    suffix: "operations",
    filters: {
      operation_kind: optionalText("Optional registered operation kind key.", 128),
      capability_key: optionalText("Optional registered capability key.", 128),
      status: optionalText("Optional registered operation status key.", 128)
    },
    page: true
  }),
  spaceRead({
    name: "swarm_get_operation",
    title: "Get Space operation",
    description: "Read one authorized Space operation.",
    suffix: "operations/{operationId}",
    filters: { operation_id: identifier("Space operation ID.") },
    required: ["operation_id"],
    pathParams: { operationId: "operation_id" }
  }),
  spaceRead({
    name: "swarm_get_decision_graph",
    title: "Get decision graph",
    description: "Read the canonical bounded decision graph for a Space.",
    suffix: "decision-graph"
  }),
  spaceRead({
    name: "swarm_list_learning_candidates",
    title: "List learning candidates",
    description: "Read one bounded page of authorized learning candidates.",
    suffix: "learning-candidates",
    filters: {
      status: optionalText("Optional registered candidate status key.", 128),
      family: optionalText("Optional registered candidate family key.", 128)
    },
    page: true
  }),
  spaceRead({
    name: "swarm_list_promotion_gates",
    title: "List promotion gates",
    description: "Read one bounded page of authorized promotion decisions.",
    suffix: "promotion-gates",
    filters: {
      decision: optionalText("Optional registered promotion decision key.", 128),
      candidate_id: optionalText("Optional candidate ID.", 255),
      projection_id: optionalText("Optional projection ID.", 255)
    },
    page: true
  }),
  spaceRead({
    name: "swarm_list_learning_queue",
    title: "List learning queue",
    description: "Read one bounded page of authorized learning queue items.",
    suffix: "learning-queue",
    filters: {
      kind: optionalText("Optional registered queue kind key.", 128),
      family: optionalText("Optional registered queue family key.", 128),
      status: optionalText("Optional registered queue status key.", 128)
    },
    page: true
  }),
  spaceRead({
    name: "swarm_get_learning_frontier",
    title: "Get learning frontier",
    description: "Read canonical learning-frontier metrics for a Space.",
    suffix: "learning-frontier"
  }),
  spaceRead({
    name: "swarm_list_projections",
    title: "List intelligence projections",
    description: "Read one bounded page of authorized intelligence projections.",
    suffix: "projections",
    filters: {
      family: optionalText("Optional registered projection family key.", 128),
      status: optionalText("Optional registered projection status key.", 128)
    },
    page: true
  })
];
