export const DEFAULT_READ_ONLY_TOOL_LIMIT = 50;

export const DEFAULT_DIRECTORY_TOOL_LIMIT = 25;

export const DEFAULT_SEARCH_TOOL_LIMIT = 25;

export const SPACE_INTELLIGENCE_STATUSES = ["candidate", "validated", "promoted", "superseded", "rejected"];

export const SPACE_OPERATION_STATUSES = ["queued", "running", "completed", "failed", "canceled"];

export const SPACE_LEARNING_QUEUE_KINDS = [
  "outside_question",
  "adversarial_probe",
  "transfer_probe",
  "benchmark_probe",
  "failure_mining",
  "real_user_question",
  "context_compression"
];

export const SPACE_LEARNING_QUEUE_STATUSES = ["queued", "claimed", "completed", "canceled"];

export const SPACE_PROMOTION_GATE_DECISIONS = ["promoted", "blocked", "rejected"];

export function clampToolLimit(accessMode, toolName, value) {
  if (!Number.isFinite(value) || value <= 0) {
    return undefined;
  }
  const normalized = Math.trunc(value);
  if (toolName === "swarm_search" || toolName === "swarm_search_public") {
    return Math.min(normalized, DEFAULT_SEARCH_TOOL_LIMIT);
  }
  if (
    toolName === "swarm_list_directory_spaces" ||
    toolName === "swarm_list_directory_agents"
  ) {
    return Math.min(normalized, DEFAULT_DIRECTORY_TOOL_LIMIT);
  }
  return Math.min(normalized, DEFAULT_READ_ONLY_TOOL_LIMIT);
}

export function pageToolProperties(maximum = 500) {
  return {
    limit: { type: "integer", minimum: 1, maximum },
    cursor: { type: "string" },
    order: { type: "string", enum: ["asc", "desc"] }
  };
}
