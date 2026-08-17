import {
  identifier,
  pageProperties,
  readContract
} from "./tool-contracts-common.mjs";

const spaceId = identifier("Swarm Space ID. Uses SWARM_SPACE_ID when omitted.");

function spaceRead(contract) {
  return readContract({ ...contract, defaultSpace: true });
}

export const INFRASTRUCTURE_READ_TOOL_CONTRACTS = [
  spaceRead({
    name: "swarm_list_cores",
    title: "List Cores",
    description: "Read one bounded page of authorized Cores in a Space.",
    path: "/v1/spaces/{spaceId}/cores",
    properties: { space_id: spaceId, ...pageProperties },
    pathParams: { spaceId: "space_id" },
    queryParams: { limit: "limit", cursor: "cursor" }
  }),
  spaceRead({
    name: "swarm_get_core",
    title: "Get Core",
    description: "Read one authorized Core.",
    path: "/v1/spaces/{spaceId}/cores/{coreId}",
    properties: { space_id: spaceId, core_id: identifier("Core ID.") },
    required: ["core_id"],
    pathParams: { spaceId: "space_id", coreId: "core_id" }
  }),
  spaceRead({
    name: "swarm_get_core_health",
    title: "Get Core health",
    description: "Read canonical health and readiness for one authorized Core.",
    path: "/v1/spaces/{spaceId}/cores/{coreId}/health",
    properties: { space_id: spaceId, core_id: identifier("Core ID.") },
    required: ["core_id"],
    pathParams: { spaceId: "space_id", coreId: "core_id" }
  }),
  spaceRead({
    name: "swarm_get_space_facet_catalog",
    title: "Get Space Facet catalog",
    description: "Read one bounded page of Facets installable in a Space.",
    path: "/v1/spaces/{spaceId}/facet-catalog",
    properties: { space_id: spaceId, ...pageProperties },
    pathParams: { spaceId: "space_id" },
    queryParams: { limit: "limit", cursor: "cursor" }
  }),
  spaceRead({
    name: "swarm_get_facet_detail",
    title: "Get Facet detail",
    description: "Read an immutable Facet version and its installation requirements.",
    path: "/v1/spaces/{spaceId}/facet-catalog/{facetVersionId}",
    properties: {
      space_id: spaceId,
      facet_version_id: identifier("Immutable Facet version ID.")
    },
    required: ["facet_version_id"],
    pathParams: { spaceId: "space_id", facetVersionId: "facet_version_id" }
  }),
  spaceRead({
    name: "swarm_get_installed_facets",
    title: "Get installed Facets",
    description: "Read one bounded page of Facets installed in a Space.",
    path: "/v1/spaces/{spaceId}/facets",
    properties: { space_id: spaceId, ...pageProperties },
    pathParams: { spaceId: "space_id" },
    queryParams: { limit: "limit", cursor: "cursor" }
  }),
  spaceRead({
    name: "swarm_get_facet_health",
    title: "Get Facet health",
    description: "Read canonical health for one installed Facet.",
    path: "/v1/spaces/{spaceId}/facets/{facetInstanceId}/health",
    properties: {
      space_id: spaceId,
      facet_instance_id: identifier("Facet instance ID.")
    },
    required: ["facet_instance_id"],
    pathParams: { spaceId: "space_id", facetInstanceId: "facet_instance_id" }
  })
];
