import { INFRASTRUCTURE_READ_TOOL_CONTRACTS } from "./tool-contracts-read-infrastructure.mjs";
import { INTELLIGENCE_READ_TOOL_CONTRACTS } from "./tool-contracts-read-intelligence.mjs";
import { RECORD_READ_TOOL_CONTRACTS } from "./tool-contracts-read-records.mjs";
import { SPACE_READ_TOOL_CONTRACTS } from "./tool-contracts-read-space.mjs";

export const READ_TOOL_CONTRACTS = Object.freeze([
  ...SPACE_READ_TOOL_CONTRACTS,
  ...RECORD_READ_TOOL_CONTRACTS,
  ...INFRASTRUCTURE_READ_TOOL_CONTRACTS,
  ...INTELLIGENCE_READ_TOOL_CONTRACTS
]);
