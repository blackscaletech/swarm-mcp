import { identifier, mutationContract, optionalText, stringArray } from "./tool-contracts-common.mjs";

const spaceId = identifier("Swarm Space ID. Uses SWARM_SPACE_ID when omitted.");
const spacePath = { spaceId: "space_id" };

function spaceMutation(contract) {
  return mutationContract({ ...contract, defaultSpace: true });
}

function installControl(name, action) {
  return spaceMutation({
    name,
    title: `${action[0].toUpperCase()}${action.slice(1)} Facet install`,
    description: `${action[0].toUpperCase()}${action.slice(1)} one canonical Facet install session.`,
    path: `/v1/spaces/{spaceId}/facet-installs/{installSessionId}/${action === "accept" ? "accept-permissions" : action}`,
    commandKey: `facet.install.${action === "accept" ? "accept_permissions" : action}`,
    capabilityKey: "facet.install",
    effect: action === "cancel" ? "destructive" : "control",
    properties: {
      space_id: spaceId,
      install_session_id: identifier("Facet install session ID."),
      preview_hash: optionalText("Accepted immutable permission preview hash.", 255)
    },
    required: ["install_session_id"],
    pathParams: { ...spacePath, installSessionId: "install_session_id" },
    bodyParams: action === "accept" ? ["preview_hash"] : []
  });
}

function facetControl(name, action) {
  return spaceMutation({
    name,
    title: `${action[0].toUpperCase()}${action.slice(1)} Facet`,
    description: `${action[0].toUpperCase()}${action.slice(1)} an installed Facet.`,
    path: `/v1/spaces/{spaceId}/facets/{facetInstanceId}/${action}`,
    commandKey: `facet.instance.${action}`,
    capabilityKey: "facet.manage",
    effect: action === "disable" ? "destructive" : "control",
    properties: { space_id: spaceId, facet_instance_id: identifier("Facet instance ID.") },
    required: ["facet_instance_id"],
    pathParams: { ...spacePath, facetInstanceId: "facet_instance_id" }
  });
}

export const FACET_TOOL_CONTRACTS = [
  spaceMutation({
    name: "swarm_install_facet",
    title: "Install Facet",
    description: "Start installation from an immutable Facet catalog version.",
    path: "/v1/spaces/{spaceId}/facet-catalog/{facetVersionId}/install",
    commandKey: "facet.catalog.install.start",
    capabilityKey: "facet.install",
    effect: "additive",
    properties: {
      space_id: spaceId,
      facet_version_id: identifier("Immutable Facet version ID."),
      core_id: optionalText("Target Core ID when required.", 255),
      accepted_capabilities: stringArray("Accepted registered capability key.", 64),
      install_config: {
        type: "object",
        maxProperties: 64,
        additionalProperties: { type: "string", maxLength: 4096 },
        description: "Bounded Facet install configuration."
      }
    },
    required: ["facet_version_id"],
    pathParams: { ...spacePath, facetVersionId: "facet_version_id" },
    bodyParams: ["core_id", "accepted_capabilities", "install_config"]
  }),
  installControl("swarm_accept_facet_permissions", "accept"),
  installControl("swarm_continue_facet_install", "continue"),
  installControl("swarm_cancel_facet_install", "cancel"),
  facetControl("swarm_pause_facet", "pause"),
  facetControl("swarm_resume_facet", "resume"),
  facetControl("swarm_disable_facet", "disable")
];
