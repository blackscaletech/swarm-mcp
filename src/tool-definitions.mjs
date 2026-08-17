import { ALL_TOOL_NAMES, TOOL_CONTRACTS } from "./tool-contracts.mjs";

export { ALL_TOOL_NAMES };

export function buildToolDefinitions() {
  return TOOL_CONTRACTS.map(({ name, title, description, inputSchema, annotations }) => ({
    name,
    title,
    description,
    inputSchema,
    annotations
  }));
}
