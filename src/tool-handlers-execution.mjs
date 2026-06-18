import {
  optionalInteger,
  optionalNumber,
  optionalRunContextRefs,
  optionalRunRequirements,
  mutationOptions,
  optionalString,
  optionalStringArray,
  optionalStringMap,
  requireAgentId,
  requireDefaultSpaceId,
  requireInteger,
  requireObject,
  requireString,
  textResult
} from "./tool-handler-common.mjs";

export async function callExecutionTool({ client, name, args = {}, defaultSpaceId, defaultAgentId }) {
  switch (name) {
    case "swarm_heartbeat_agent":
      return textResult("Agent heartbeat updated", await client.heartbeatAgent(
        requireAgentId(args, defaultAgentId),
        {
          status: optionalString(args.status),
          current_run_id: optionalString(args.current_run_id),
          current_run_lease_id: optionalString(args.current_run_lease_id),
          region: optionalString(args.region),
          protocol: optionalString(args.protocol),
          version: optionalString(args.version)
        },
        mutationOptions(args)
      ));
    case "swarm_launch_run":
      assertLaunchRunArgs(args);
      return textResult("Run launched", await client.launchRun(
        requireString(args.space_id, "space_id"),
        launchRunPayload(args),
        intentOptions(args)
      ));
    case "swarm_launch_default_run":
      assertLaunchRunArgs(args);
      return textResult("Default Space run launched", await client.launchRun(
        requireDefaultSpaceId(defaultSpaceId),
        launchRunPayload(args),
        intentOptions(args)
      ));
    case "swarm_launch_and_acquire_run":
      assertLaunchRunArgs(args);
      return textResult("Run launched and acquired", await client.launchAndAcquireRun(
        requireString(args.space_id, "space_id"),
        {
          agent_id: requireAgentId(args, defaultAgentId),
          ttl_seconds: optionalNumber(args.ttl_seconds),
          ...launchRunPayload(args)
        },
        intentOptions(args)
      ));
    case "swarm_create_task":
      return textResult("Task created", await client.createTask({
        space_id: requireString(args.space_id, "space_id"),
        title: requireString(args.title, "title"),
        description: requireString(args.description, "description")
      }, mutationOptions(args)));
    case "swarm_update_task":
      return textResult("Task updated", await client.updateTask(
        requireString(args.task_id, "task_id"),
        {
          title: requireString(args.title, "title"),
          description: requireString(args.description, "description")
        },
        mutationOptions(args)
      ));
    case "swarm_cancel_task":
      return textResult("Task canceled", await client.cancelTask(
        requireString(args.task_id, "task_id"),
        { reason: optionalString(args.reason) },
        mutationOptions(args)
      ));
    case "swarm_create_agent_capability_manifest":
      return textResult("Agent capability manifest created", await client.createAgentCapabilityManifest({
        agent_id: requireAgentId(args, defaultAgentId),
        ...agentCapabilityManifestPayload(args)
      }, mutationOptions(args)));
    case "swarm_update_agent_capability_manifest":
      return textResult("Agent capability manifest updated", await client.updateAgentCapabilityManifest(
        requireString(args.manifest_id, "manifest_id"),
        agentCapabilityManifestPayload(args),
        mutationOptions(args)
      ));
    case "swarm_acquire_next_run":
      return textResult("Run acquisition", await client.acquireNextRun(
        requireAgentId(args, defaultAgentId),
        { ttl_seconds: requireInteger(args.ttl_seconds, "ttl_seconds", { min: 1 }) },
        mutationOptions(args)
      ));
    case "swarm_start_run":
      return textResult("Run started", await client.startRun(requireString(args.run_id, "run_id"), mutationOptions(args)));
    case "swarm_complete_run":
      return textResult("Run completed", await client.completeRun(requireString(args.run_id, "run_id"), {
        outcome: requireString(args.outcome, "outcome")
      }, mutationOptions(args)));
    case "swarm_request_run_stop":
      return textResult("Run stop requested", await client.requestRunStop(requireString(args.run_id, "run_id"), {
        reason: optionalString(args.reason)
      }, mutationOptions(args)));
    case "swarm_renew_run_lease":
      return textResult("Run lease renewed", await client.renewRunLease(requireString(args.lease_id, "lease_id"), {
        ttl_seconds: requireInteger(args.ttl_seconds, "ttl_seconds", { min: 1 })
      }, mutationOptions(args)));
    case "swarm_release_run_lease":
      return textResult("Run lease released", await client.releaseRunLease(requireString(args.lease_id, "lease_id"), mutationOptions(args)));
    case "swarm_create_artifact":
      return textResult("Artifact created", await client.createArtifact({
        space_id: requireString(args.space_id, "space_id"),
        run_id: optionalString(args.run_id),
        repository_id: optionalString(args.repository_id),
        kind: requireString(args.kind, "kind"),
        media_type: requireString(args.media_type, "media_type"),
        body: requireString(args.body, "body"),
        parent_artifact_ids: optionalStringArray(args.parent_artifact_ids)
      }, mutationOptions(args)));
    case "swarm_create_evaluation":
      return textResult("Evaluation created", await client.createEvaluation({
        space_id: requireString(args.space_id, "space_id"),
        run_id: optionalString(args.run_id),
        artifact_id: optionalString(args.artifact_id),
        runtime_receipt_id: optionalString(args.runtime_receipt_id),
        evaluator_agent_id: optionalString(args.evaluator_agent_id) || optionalString(defaultAgentId),
        outcome: requireString(args.outcome, "outcome"),
        score: requireInteger(args.score, "score", { min: 0, max: 100 }),
        rubric_key: optionalString(args.rubric_key),
        summary: requireString(args.summary, "summary")
      }, mutationOptions(args)));
    case "swarm_claim_learning_queue_item":
      return textResult("Learning queue item claimed", await client.claimSpaceLearningQueueItem(
        requireString(args.space_id, "space_id"),
        {
          agent_id: optionalString(args.agent_id) || optionalString(defaultAgentId),
          kind: optionalString(args.kind),
          family: optionalString(args.family),
          claim_ttl_seconds: optionalClaimTTLSeconds(args.claim_ttl_seconds)
        },
        mutationOptions(args)
      ));
    case "swarm_submit_learning_queue_result":
      return textResult("Learning queue result submitted", await client.submitSpaceLearningQueueResult(
        requireString(args.space_id, "space_id"),
        requireString(args.item_id, "item_id"),
        {
          agent_id: optionalString(args.agent_id) || optionalString(defaultAgentId),
          ...learningQueueResultPayload(args)
        },
        mutationOptions(args)
      ));
    case "swarm_report_token_usage":
      return textResult("Token usage recorded", await client.createTokenUsageEvent({
        space_id: requireString(args.space_id, "space_id"),
        run_id: optionalString(args.run_id),
        agent_id: optionalString(args.agent_id) || optionalString(defaultAgentId),
        source_resource_type: requireString(args.source_resource_type, "source_resource_type"),
        source_resource_id: requireString(args.source_resource_id, "source_resource_id"),
        operation: requireString(args.operation, "operation"),
        count_source: "provider_reported",
        model_provider: optionalString(args.model_provider),
        model: optionalString(args.model),
        input_tokens: optionalInteger(args.input_tokens),
        output_tokens: optionalInteger(args.output_tokens),
        cached_input_tokens: optionalInteger(args.cached_input_tokens),
        reasoning_tokens: optionalInteger(args.reasoning_tokens),
        total_tokens: optionalInteger(args.total_tokens)
      }, mutationOptions(args)));
    case "swarm_record_action_trace":
      return textResult("Action trace recorded", await client.createAgentActionTrace({
        space_id: requireString(args.space_id, "space_id"),
        run_id: optionalString(args.run_id),
        agent_id: optionalString(args.agent_id) || optionalString(defaultAgentId),
        parent_action_id: optionalString(args.parent_action_id),
        sequence: optionalInteger(args.sequence),
        action_type: requireString(args.action_type, "action_type"),
        status: requireString(args.status, "status"),
        protocol: optionalString(args.protocol),
        provider: optionalString(args.provider),
        model: optionalString(args.model),
        tool_namespace: optionalString(args.tool_namespace),
        tool_name: optionalString(args.tool_name),
        resource_type: optionalString(args.resource_type),
        resource_id: optionalString(args.resource_id),
        token_usage_event_id: optionalString(args.token_usage_event_id),
        input_summary: optionalString(args.input_summary),
        output_summary: optionalString(args.output_summary),
        artifact_ids: optionalStringArray(args.artifact_ids),
        evaluation_ids: optionalStringArray(args.evaluation_ids),
        data: optionalStringMap(args.data)
      }, mutationOptions(args)));
    case "swarm_create_budget_delegation":
      return textResult("Budget delegation created", await client.createBudgetDelegation({
        account_id: requireString(args.account_id, "account_id"),
        target_agent_id: optionalString(args.target_agent_id),
        target_run_id: optionalString(args.target_run_id),
        approval_request_id: optionalString(args.approval_request_id),
        amount: requireInteger(args.amount, "amount", { min: 1 }),
        reason: optionalString(args.reason)
      }, mutationOptions(args)));
    case "swarm_consume_budget_delegation":
      return textResult("Budget delegation consumed", await client.consumeBudgetDelegation(
        requireString(args.delegation_id, "delegation_id"),
        { amount: requireInteger(args.amount, "amount", { min: 1 }), reason: optionalString(args.reason) },
        mutationOptions(args)
      ));
    case "swarm_revoke_budget_delegation":
      return textResult("Budget delegation revoked", await client.revokeBudgetDelegation(
        requireString(args.delegation_id, "delegation_id"),
        { reason: optionalString(args.reason) },
        mutationOptions(args)
      ));
    case "swarm_create_approval_request":
      return textResult("Approval request created", await client.createApprovalRequest({
        space_id: requireString(args.space_id, "space_id"),
        resource_type: requireString(args.resource_type, "resource_type"),
        resource_id: optionalString(args.resource_id),
        action: requireString(args.action, "action"),
        summary: requireString(args.summary, "summary")
      }, mutationOptions(args)));
    case "swarm_approve_approval_request":
      return textResult("Approval request approved", await client.approveApprovalRequest(
        requireString(args.request_id, "request_id"),
        { resolution_note: optionalString(args.resolution_note) },
        mutationOptions(args)
      ));
    case "swarm_reject_approval_request":
      return textResult("Approval request rejected", await client.rejectApprovalRequest(
        requireString(args.request_id, "request_id"),
        { resolution_note: optionalString(args.resolution_note) },
        mutationOptions(args)
      ));
    default:
      return null;
  }
}

function assertLaunchRunArgs(args) {
  if (!optionalString(args.launch_template_id)) {
    requireString(args.title, "title");
    requireString(args.description, "description");
  }
  if (optionalString(args.source_prompt) && optionalString(args.prompt_capture_mode) !== "raw_and_compiled") {
    throw new Error("source_prompt requires prompt_capture_mode raw_and_compiled");
  }
}

function launchRunPayload(args) {
  return {
    automation_profile_id: optionalString(args.automation_profile_id),
    launch_template_id: optionalString(args.launch_template_id),
    title: optionalString(args.title),
    description: optionalString(args.description),
    execution_policy_id: optionalString(args.execution_policy_id),
    prompt_capture_mode: optionalString(args.prompt_capture_mode),
    source_prompt: optionalString(args.source_prompt),
    compiled_brief: optionalString(args.compiled_brief),
    run_requirements: optionalRunRequirements(args.run_requirements),
    run_context_refs: optionalRunContextRefs(args.run_context_refs)
  };
}

function intentOptions(args) {
  return mutationOptions(args);
}

function agentCapabilityManifestPayload(args) {
  return {
    tools: optionalStringArray(args.tools),
    models: optionalStringArray(args.models),
    connectors: optionalStringArray(args.connectors),
    regions: optionalStringArray(args.regions),
    protocols: optionalStringArray(args.protocols),
    latency_class: optionalString(args.latency_class),
    cost_class: optionalString(args.cost_class),
    safety_tier: optionalString(args.safety_tier),
    hosting_mode: optionalString(args.hosting_mode),
    runtime_human_action_tags: optionalStringArray(args.runtime_human_action_tags)
  };
}

function optionalClaimTTLSeconds(value) {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }
  return requireInteger(value, "claim_ttl_seconds", { min: 15, max: 1800 });
}

function learningQueueResultPayload(args) {
  const artifact = requireObject(args.artifact, "artifact");
  return {
    artifact: {
      kind: requireString(artifact.kind, "artifact.kind"),
      title: optionalString(artifact.title),
      media_type: requireString(artifact.media_type, "artifact.media_type"),
      body: requireString(artifact.body, "artifact.body")
    },
    candidate: optionalLearningCandidate(args.candidate),
    evaluation: optionalLearningEvaluation(args.evaluation)
  };
}

function optionalLearningCandidate(value) {
  if (value === undefined || value === null) {
    return undefined;
  }
  const candidate = requireObject(value, "candidate");
  return {
    family: requireString(candidate.family, "candidate.family"),
    summary: requireString(candidate.summary, "candidate.summary")
  };
}

function optionalLearningEvaluation(value) {
  if (value === undefined || value === null) {
    return undefined;
  }
  const evaluation = requireObject(value, "evaluation");
  return {
    outcome: requireString(evaluation.outcome, "evaluation.outcome"),
    score: requireInteger(evaluation.score, "evaluation.score", { min: 0, max: 100 }),
    rubric_key: optionalString(evaluation.rubric_key),
    summary: requireString(evaluation.summary, "evaluation.summary")
  };
}
