export { clampToolLimit } from "./tool-catalog-base.mjs";
export { buildReadToolDefinitions } from "./tool-catalog-read.mjs";
export { buildRuntimeExecutionToolDefinitions } from "./tool-catalog-runtime.mjs";
export { buildSpaceIntelligenceToolDefinitions } from "./tool-catalog-intelligence.mjs";
export { buildOperatorMutationToolDefinitions } from "./tool-catalog-operator.mjs";

import { buildReadToolDefinitions } from "./tool-catalog-read.mjs";
import { buildRuntimeExecutionToolDefinitions } from "./tool-catalog-runtime.mjs";
import { buildSpaceIntelligenceToolDefinitions } from "./tool-catalog-intelligence.mjs";
import { buildOperatorMutationToolDefinitions } from "./tool-catalog-operator.mjs";

export function mergeToolDefinitions(...groups) {
  const merged = [];
  const seen = new Set();
  for (const group of groups) {
    for (const tool of group) {
      if (seen.has(tool.name)) {
        continue;
      }
      seen.add(tool.name);
      merged.push(tool);
    }
  }
  return merged;
}

export function buildToolDefinitions(accessMode) {
  const readTools = buildReadToolDefinitions();
  const spaceIntelligenceTools = buildSpaceIntelligenceToolDefinitions();
  switch (accessMode) {
    case "read-only":
      return readTools;
    case "operator":
      return mergeToolDefinitions(
        readTools,
        spaceIntelligenceTools,
        buildOperatorMutationToolDefinitions(),
        buildRuntimeExecutionToolDefinitions()
      );
    default:
      throw new Error(`unsupported Swarm Connect access mode: ${accessMode}`);
  }
}

export const ALL_TOOL_NAMES = new Set(
  mergeToolDefinitions(
    buildReadToolDefinitions(),
    buildSpaceIntelligenceToolDefinitions(),
    buildRuntimeExecutionToolDefinitions(),
    buildOperatorMutationToolDefinitions()
  ).map((tool) => tool.name)
);
