import {
  boundedText,
  identifier,
  mutationContract,
  objectValue,
  optionalText,
  resourceRef
} from "./tool-contracts-common.mjs";

const spaceId = identifier("Swarm Space ID. Uses SWARM_SPACE_ID when omitted.");
const spacePath = { spaceId: "space_id" };

function spaceMutation(contract) {
  return mutationContract({ ...contract, defaultSpace: true });
}

function runGroupControl(name, action) {
  return mutationContract({
    name,
    title: `${action[0].toUpperCase()}${action.slice(1)} Run Group`,
    description: `${action[0].toUpperCase()}${action.slice(1)} a canonical Run Group.`,
    path: `/v1/foundation/run-groups/{runGroupId}:${action}`,
    commandKey: `run_group.${action}`,
    capabilityKey: "space.run_group.control",
    effect: action === "cancel" ? "destructive" : "control",
    properties: { run_group_id: identifier("Run Group ID.") },
    required: ["run_group_id"],
    pathParams: { runGroupId: "run_group_id" }
  });
}

function coreControl(name, action) {
  return spaceMutation({
    name,
    title: `${action[0].toUpperCase()}${action.slice(1)} Core`,
    description: `${action[0].toUpperCase()}${action.slice(1)} a Core through its canonical lifecycle Command.`,
    path: `/v1/spaces/{spaceId}/cores/{coreId}/${action}`,
    commandKey: `core.${action}`,
    capabilityKey: "core.lifecycle.manage",
    effect: action === "disable" ? "destructive" : "control",
    properties: { space_id: spaceId, core_id: identifier("Core ID.") },
    required: ["core_id"],
    pathParams: { ...spacePath, coreId: "core_id" }
  });
}

export const EXECUTION_TOOL_CONTRACTS = [
  spaceMutation({
    name: "swarm_launch_run",
    title: "Launch Run",
    description: "Launch one freeform Run Group and Main Run without requiring a Task.",
    path: "/v1/foundation/spaces/{spaceId}/runs:launch",
    commandKey: "run.launch",
    capabilityKey: "space.run.launch",
    effect: "additive",
    properties: {
      space_id: spaceId,
      goal_summary: boundedText("Execution goal.", 4096),
      automation_profile_id: optionalText("Optional automation profile ID.", 255),
      execution_policy_id: optionalText("Optional execution policy ID.", 255),
      model_route_policy_id: optionalText("Optional model route policy ID.", 255),
      run_requirements: objectValue("Bounded registered execution requirements.", 32),
      run_context_refs: { type: "array", maxItems: 100, items: resourceRef }
    },
    required: ["goal_summary"],
    pathParams: spacePath,
    bodyParams: ["goal_summary", "automation_profile_id", "execution_policy_id", "model_route_policy_id", "run_requirements", "run_context_refs"]
  }),
  runGroupControl("swarm_pause_run_group", "pause"),
  runGroupControl("swarm_resume_run_group", "resume"),
  runGroupControl("swarm_cancel_run_group", "cancel"),
  spaceMutation({
    name: "swarm_enable_cloud_core",
    title: "Enable Swarm Cloud Core",
    description: "Enable the managed Core for a Space through canonical lifecycle authority.",
    path: "/v1/spaces/{spaceId}/cores/enable-swarm-cloud",
    commandKey: "core.enable_swarm_cloud",
    capabilityKey: "core.lifecycle.manage",
    effect: "additive",
    properties: { space_id: spaceId },
    pathParams: spacePath
  }),
  spaceMutation({
    name: "swarm_create_connected_core",
    title: "Create Connected Core",
    description: "Create a Connected Core identity in a Space.",
    path: "/v1/spaces/{spaceId}/cores",
    commandKey: "core.create_connected",
    capabilityKey: "core.lifecycle.manage",
    effect: "additive",
    properties: {
      space_id: spaceId,
      name: boundedText("Core display name.", 256),
      capability_keys: { type: "array", maxItems: 64, items: identifier("Registered Core capability key.") }
    },
    required: ["name"],
    pathParams: spacePath,
    bodyParams: ["name", "capability_keys"]
  }),
  coreControl("swarm_pause_core", "pause"),
  coreControl("swarm_resume_core", "resume"),
  coreControl("swarm_disable_core", "disable")
];
