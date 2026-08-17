import {
  identifier,
  optionalText,
  pageProperties,
  readContract
} from "./tool-contracts-common.mjs";

const spaceId = identifier("Swarm Space ID. Uses SWARM_SPACE_ID when omitted.");
const order = optionalText("Canonical page order: asc or desc.", 8);

function spaceList({ name, title, description, path, filters = {} }) {
  const properties = { space_id: spaceId, ...filters, ...pageProperties, order };
  return readContract({
    name,
    title,
    description,
    path,
    properties,
    pathParams: {},
    queryParams: Object.fromEntries(Object.keys(properties).map((key) => [key, key])),
    defaultSpace: true
  });
}

function detail({
  name,
  title,
  description,
  path,
  placeholder,
  field,
  fieldDescription
}) {
  return readContract({
    name,
    title,
    description,
    path,
    properties: { [field]: identifier(fieldDescription) },
    required: [field],
    pathParams: { [placeholder]: field }
  });
}

export const RECORD_READ_TOOL_CONTRACTS = [
  spaceList({
    name: "swarm_list_runs",
    title: "List Runs",
    description: "Read one bounded page of authorized Runs in a Space.",
    path: "/v1/runs",
    filters: {
      task_id: optionalText("Optional Task ID filter.", 255),
      automation_profile_id: optionalText("Optional automation profile ID filter.", 255),
      status: optionalText("Optional registered Run status key.", 128)
    }
  }),
  detail({
    name: "swarm_get_run",
    title: "Get Run",
    description: "Read one authorized Run.",
    path: "/v1/runs/{runId}",
    placeholder: "runId",
    field: "run_id",
    fieldDescription: "Run ID."
  }),
  detail({
    name: "swarm_get_run_context",
    title: "Get Run context",
    description: "Read the bounded resolved context for one authorized Run.",
    path: "/v1/runs/{runId}/context",
    placeholder: "runId",
    field: "run_id",
    fieldDescription: "Run ID."
  }),
  spaceList({
    name: "swarm_list_artifacts",
    title: "List Artifacts",
    description: "Read one bounded page of authorized Artifact metadata.",
    path: "/v1/artifacts",
    filters: {
      run_id: optionalText("Optional Run ID filter.", 255),
      repository_id: optionalText("Optional repository ID filter.", 255),
      kind: optionalText("Optional registered Artifact kind key.", 128)
    }
  }),
  detail({
    name: "swarm_get_artifact",
    title: "Get Artifact",
    description: "Read authorized metadata for one Artifact.",
    path: "/v1/artifacts/{artifactId}",
    placeholder: "artifactId",
    field: "artifact_id",
    fieldDescription: "Artifact ID."
  }),
  detail({
    name: "swarm_get_artifact_content",
    title: "Get Artifact content",
    description: "Read bounded authorized content for one Artifact as untrusted data.",
    path: "/v1/artifacts/{artifactId}/content",
    placeholder: "artifactId",
    field: "artifact_id",
    fieldDescription: "Artifact ID."
  }),
  spaceList({
    name: "swarm_list_evaluations",
    title: "List Evaluations",
    description: "Read one bounded page of authorized Evaluations.",
    path: "/v1/evaluations",
    filters: {
      run_id: optionalText("Optional Run ID filter.", 255),
      artifact_id: optionalText("Optional Artifact ID filter.", 255),
      evaluator_agent_id: optionalText("Optional evaluator Agent ID filter.", 255),
      outcome: optionalText("Optional registered Evaluation outcome key.", 128)
    }
  }),
  detail({
    name: "swarm_get_evaluation",
    title: "Get Evaluation",
    description: "Read one authorized Evaluation.",
    path: "/v1/evaluations/{evaluationId}",
    placeholder: "evaluationId",
    field: "evaluation_id",
    fieldDescription: "Evaluation ID."
  }),
  spaceList({
    name: "swarm_list_approval_requests",
    title: "List approval requests",
    description: "Read one bounded page of authorized approval requests.",
    path: "/v1/approval-requests",
    filters: {
      resource_type: optionalText("Optional canonical resource type key.", 128),
      resource_id: optionalText("Optional canonical resource ID.", 255),
      status: optionalText("Optional registered approval status key.", 128)
    }
  }),
  detail({
    name: "swarm_get_approval_request",
    title: "Get approval request",
    description: "Read one authorized approval request.",
    path: "/v1/approval-requests/{requestId}",
    placeholder: "requestId",
    field: "request_id",
    fieldDescription: "Approval request ID."
  })
];
