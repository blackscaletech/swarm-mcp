import { CORE_READ_TOOL_DEFINITIONS } from "./tool-catalog-read-core.mjs";
import { INTELLIGENCE_READ_TOOL_DEFINITIONS } from "./tool-catalog-read-intelligence.mjs";
import { OPERATIONAL_READ_TOOL_DEFINITIONS } from "./tool-catalog-read-operations.mjs";

export function buildReadToolDefinitions() {
  return [
    ...CORE_READ_TOOL_DEFINITIONS,
    ...INTELLIGENCE_READ_TOOL_DEFINITIONS,
    ...OPERATIONAL_READ_TOOL_DEFINITIONS
  ];
}
