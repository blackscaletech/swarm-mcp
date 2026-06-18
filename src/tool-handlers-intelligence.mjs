import { SWARM_UNTRUSTED_DATA_WARNING } from "./constants.mjs";
import {
  collectionArgs,
  mutationOptions,
  optionalBoolean,
  optionalInteger,
  optionalOperationRefs,
  optionalString,
  optionalStringArray,
  requireDefaultSpaceId,
  requireSpaceId,
  requireString,
  textResult,
  textResultWithWarning
} from "./tool-handler-common.mjs";

const OPERATION_CONTRACTS = Object.freeze({
  optimize: {
    capabilities: new Set(["context_pack_tuning", "reflective_evolution"]),
    targets: new Set(["launch_template", "automation_profile", "answer_contract", "context_pack_recipe", "prompt", "space_projection"])
  },
  understand_and_evaluate: {
    capabilities: new Set(["code_trust_review"]),
    targets: new Set(["code_change_set", "pull_request", "repository_snapshot", "issue"])
  },
  validate: {
    capabilities: new Set(["code_trust_review", "risk_discovery"]),
    targets: new Set(["artifact", "run", "space_projection", "launch_template", "automation_profile", "repository_snapshot"])
  }
});

export async function callIntelligenceTool({ client, accessMode, name, args = {}, defaultSpaceId }) {
  switch (name) {
    case "swarm_list_space_answers":
      return textResultWithWarning(
        "Space answers",
        await client.listSpaceAnswers(
          requireSpaceId(args),
          collectionArgs(accessMode, name, args)
        ),
        SWARM_UNTRUSTED_DATA_WARNING
      );
    case "swarm_get_space_answer":
      return textResultWithWarning(
        "Space answer",
        await client.getSpaceAnswer(requireSpaceId(args), requireString(args.answer_id, "answer_id")),
        SWARM_UNTRUSTED_DATA_WARNING
      );
    case "swarm_get_space_answer_contract":
      return textResult(
        "Space answer contract",
        await client.getSpaceAnswerContract(requireSpaceId(args))
      );
    case "swarm_discover_space_contract":
      return textResult(
        "Space work contract",
        await client.getSpaceWorkContract(requireSpaceId(args))
      );
    case "swarm_list_space_capabilities":
      return textResult(
        "Space capabilities",
        await client.listSpaceCapabilities(requireSpaceId(args))
      );
    case "swarm_get_space_operation_contract":
      return textResult(
        "Space operation contract",
        await client.getSpaceOperationContract(
          requireSpaceId(args),
          requireString(args.operation_kind, "operation_kind")
        )
      );
    case "swarm_list_operations":
      return textResultWithWarning(
        "Space operations",
        await client.listSpaceIntelligenceOperations(
          requireSpaceId(args),
          collectionArgs(accessMode, name, args, {
            operation_kind: optionalString(args.operation_kind),
            capability_key: optionalString(args.capability_key),
            status: optionalString(args.status)
          })
        ),
        SWARM_UNTRUSTED_DATA_WARNING
      );
    case "swarm_get_operation":
      return textResultWithWarning(
        "Space operation",
        await client.getSpaceIntelligenceOperation(
          requireSpaceId(args),
          requireString(args.operation_id, "operation_id")
        ),
        SWARM_UNTRUSTED_DATA_WARNING
      );
    case "swarm_get_space_decision_graph":
      return textResultWithWarning(
        "Space decision graph",
        await client.getSpaceDecisionGraph(requireSpaceId(args)),
        SWARM_UNTRUSTED_DATA_WARNING
      );
    case "swarm_list_space_learning_candidates":
      return textResultWithWarning(
        "Space learning candidates",
        await client.listSpaceLearningCandidates(
          requireSpaceId(args),
          collectionArgs(accessMode, name, args, {
            family: optionalString(args.family),
            status: optionalString(args.status)
          })
        ),
        SWARM_UNTRUSTED_DATA_WARNING
      );
    case "swarm_list_space_promotion_gates":
      return textResult(
        "Space promotion gates",
        await client.listSpacePromotionGates(
          requireSpaceId(args),
          collectionArgs(accessMode, name, args, {
            candidate_id: optionalString(args.candidate_id),
            projection_id: optionalString(args.projection_id),
            decision: optionalString(args.decision)
          })
        )
      );
    case "swarm_list_space_intelligence_projections":
      return textResultWithWarning(
        "Space intelligence projections",
        await client.listSpaceIntelligenceProjections(
          requireSpaceId(args),
          collectionArgs(accessMode, name, args, {
            family: optionalString(args.family),
            status: optionalString(args.status)
          })
        ),
        SWARM_UNTRUSTED_DATA_WARNING
      );
    case "swarm_list_space_learning_queue":
      return textResultWithWarning(
        "Space learning queue",
        await client.listSpaceLearningQueueItems(
          requireSpaceId(args),
          collectionArgs(accessMode, name, args, {
            kind: optionalString(args.kind),
            family: optionalString(args.family),
            status: optionalString(args.status),
            due_only: optionalBoolean(args.due_only)
          })
        ),
        SWARM_UNTRUSTED_DATA_WARNING
      );
    case "swarm_get_space_learning_frontier":
      return textResult(
        "Space learning frontier",
        await client.getSpaceLearningFrontier(requireSpaceId(args))
      );
    case "swarm_ask_space":
      return textResultWithWarning(
        "Space answer",
        await client.askSpace(optionalString(args.space_id) || requireDefaultSpaceId(defaultSpaceId), {
          question: requireString(args.question, "question"),
          objective: optionalString(args.objective),
          constraints: optionalStringArray(args.constraints),
          desired_output_shape: normalizeDesiredOutputShape(args.desired_output_shape),
          allow_learning_update: optionalBoolean(args.allow_learning_update)
        }, mutationOptions(args)),
        SWARM_UNTRUSTED_DATA_WARNING
      );
    case "swarm_ask_default_space":
      return textResultWithWarning(
        "Default Space answer",
        await client.askSpace(requireDefaultSpaceId(defaultSpaceId), {
          question: requireString(args.question, "question"),
          objective: optionalString(args.objective),
          constraints: optionalStringArray(args.constraints),
          desired_output_shape: normalizeDesiredOutputShape(args.desired_output_shape),
          allow_learning_update: optionalBoolean(args.allow_learning_update)
        }, mutationOptions(args)),
        SWARM_UNTRUSTED_DATA_WARNING
      );
    case "swarm_build_space_context_pack": {
      const query = optionalString(args.query);
      const objective = optionalString(args.objective);
      if (!query && !objective) {
        throw new Error("query or objective is required");
      }
      return textResultWithWarning(
        "Space context pack",
        await client.buildSpaceContextPack(requireSpaceId(args), {
          query,
          objective,
          mode: optionalString(args.mode),
          token_budget: optionalInteger(args.token_budget)
        }),
        SWARM_UNTRUSTED_DATA_WARNING
      );
    }
    case "swarm_build_default_context_pack": {
      const query = optionalString(args.query);
      const objective = optionalString(args.objective) || "Resume durable Space context.";
      return textResultWithWarning(
        "Default Space context pack",
        await client.buildSpaceContextPack(requireDefaultSpaceId(defaultSpaceId), {
          query,
          objective,
          mode: optionalString(args.mode),
          token_budget: optionalInteger(args.token_budget)
        }),
        SWARM_UNTRUSTED_DATA_WARNING
      );
    }
    case "swarm_discover_default_space_contract":
      return textResult(
        "Default Space work contract",
        await client.getSpaceWorkContract(requireDefaultSpaceId(defaultSpaceId))
      );
    case "swarm_get_default_space_decision_graph":
      return textResultWithWarning(
        "Default Space decision graph",
        await client.getSpaceDecisionGraph(requireDefaultSpaceId(defaultSpaceId)),
        SWARM_UNTRUSTED_DATA_WARNING
      );
    case "swarm_resume_space": {
      const query = optionalString(args.query);
      const objective = optionalString(args.objective);
      if (!query && !objective) {
        throw new Error("query or objective is required");
      }
      return textResultWithWarning(
        "Connected Space context pack",
        await client.buildConnectedChatContextPack({
          query,
          objective,
          mode: optionalString(args.mode),
          token_budget: optionalInteger(args.token_budget)
        }),
        SWARM_UNTRUSTED_DATA_WARNING
      );
    }
    case "swarm_ask_connected_space":
      return textResultWithWarning(
        "Connected Space answer",
        await client.askConnectedChatSpace({
          question: requireString(args.question, "question"),
          objective: optionalString(args.objective),
          constraints: optionalStringArray(args.constraints),
          desired_output_shape: normalizeDesiredOutputShape(args.desired_output_shape),
          allow_learning_update: optionalBoolean(args.allow_learning_update)
        }, mutationOptions(args)),
        SWARM_UNTRUSTED_DATA_WARNING
      );
    case "swarm_save_session_digest":
      return textResult(
        "Session digest saved",
        await client.createConnectedChatSessionDigest({
          run_id: optionalString(args.run_id),
          summary: requireString(args.summary, "summary"),
          durable_decisions: optionalStringArray(args.durable_decisions),
          constraints: optionalStringArray(args.constraints),
          open_questions: optionalStringArray(args.open_questions),
          next_steps: optionalStringArray(args.next_steps),
          source_artifact_ids: optionalStringArray(args.source_artifact_ids),
          candidate_families: optionalStringArray(args.candidate_families),
          create_memory_candidates: optionalBoolean(args.create_memory_candidates)
        }, mutationOptions(args))
      );
    case "swarm_create_operation": {
      const input = operationInput(args);
      assertOperationContract(input);
      return textResultWithWarning(
        "Space operation created",
        await client.createSpaceIntelligenceOperation(requireSpaceId(args), input, mutationOptions(args)),
        SWARM_UNTRUSTED_DATA_WARNING
      );
    }
    case "swarm_create_default_operation": {
      const input = operationInput(args);
      assertOperationContract(input);
      return textResultWithWarning(
        "Default Space operation created",
        await client.createSpaceIntelligenceOperation(requireDefaultSpaceId(defaultSpaceId), input, mutationOptions(args)),
        SWARM_UNTRUSTED_DATA_WARNING
      );
    }
    case "swarm_start_operation":
      return textResultWithWarning(
        "Space operation started",
        await client.startSpaceIntelligenceOperation(
          requireSpaceId(args),
          requireString(args.operation_id, "operation_id"),
          {
            output_refs: optionalOperationRefs(args.output_refs, "output_refs"),
            expected_updated_at: optionalString(args.expected_updated_at)
          },
          mutationOptions(args)
        ),
        SWARM_UNTRUSTED_DATA_WARNING
      );
    case "swarm_cancel_operation":
      return textResultWithWarning(
        "Space operation canceled",
        await client.cancelQueuedSpaceIntelligenceOperation(
          requireSpaceId(args),
          requireString(args.operation_id, "operation_id"),
          {
            expected_updated_at: optionalString(args.expected_updated_at)
          },
          mutationOptions(args)
        ),
        SWARM_UNTRUSTED_DATA_WARNING
      );
    case "swarm_complete_operation":
      return textResultWithWarning(
        "Space operation completed",
        await client.completeSpaceIntelligenceOperation(
          requireSpaceId(args),
          requireString(args.operation_id, "operation_id"),
          {
            output_refs: optionalOperationRefs(args.output_refs, "output_refs"),
            expected_updated_at: optionalString(args.expected_updated_at)
          },
          mutationOptions(args)
        ),
        SWARM_UNTRUSTED_DATA_WARNING
      );
    case "swarm_fail_operation":
      return textResultWithWarning(
        "Space operation failed",
        await client.failSpaceIntelligenceOperation(
          requireSpaceId(args),
          requireString(args.operation_id, "operation_id"),
          {
            output_refs: optionalOperationRefs(args.output_refs, "output_refs"),
            expected_updated_at: optionalString(args.expected_updated_at)
          },
          mutationOptions(args)
        ),
        SWARM_UNTRUSTED_DATA_WARNING
      );
    default:
      return undefined;
  }
}

function operationInput(args) {
  const budget = args.budget && typeof args.budget === "object" && !Array.isArray(args.budget) ? {
    max_runs: optionalInteger(args.budget.max_runs),
    max_tokens: optionalInteger(args.budget.max_tokens),
    max_runtime_minutes: optionalInteger(args.budget.max_runtime_minutes)
  } : undefined;
  return {
    operation_kind: requireString(args.operation_kind, "operation_kind").toLowerCase(),
    capability_key: optionalString(args.capability_key)?.toLowerCase(),
    objective: requireString(args.objective, "objective"),
    constraints: optionalStringArray(args.constraints),
    budget,
    target_refs: optionalOperationRefs(args.target_refs, "target_refs") || [],
    input_refs: optionalOperationRefs(args.input_refs, "input_refs")
  };
}

function assertOperationContract(input) {
  const contract = OPERATION_CONTRACTS[input.operation_kind];
  if (!contract) {
    throw new Error(`operation_kind must be one of: ${Object.keys(OPERATION_CONTRACTS).join(", ")}`);
  }
  if (input.capability_key && !contract.capabilities.has(input.capability_key)) {
    throw new Error(`capability_key ${input.capability_key} is not supported by operation_kind ${input.operation_kind}`);
  }
  if (input.target_refs.length === 0) {
    throw new Error("target_refs requires at least one target");
  }
  const invalidTargets = input.target_refs
    .map((ref) => ref.resource_type)
    .filter((resourceType) => !contract.targets.has(resourceType));
  if (invalidTargets.length > 0) {
    throw new Error(
      `target_refs resource_type ${[...new Set(invalidTargets)].join(", ")} is not supported by operation_kind ${input.operation_kind}. Supported targets: ${[...contract.targets].join(", ")}`
    );
  }
}

function normalizeDesiredOutputShape(value) {
  const shape = optionalString(value)?.toLowerCase();
  switch (shape) {
    case undefined:
      return undefined;
    case "brief":
    case "brief_with_rationale":
      return "brief_with_rationale";
    case "lineage":
    case "answer_with_lineage":
      return "answer_with_lineage";
    case "gaps":
    case "next_steps":
    case "gaps_and_next_steps":
      return "gaps_and_next_steps";
    default:
      return shape;
  }
}
