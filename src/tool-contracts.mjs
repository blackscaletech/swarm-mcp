import { COLLABORATION_TOOL_CONTRACTS } from "./tool-contracts-collaboration.mjs";
import { EXECUTION_TOOL_CONTRACTS } from "./tool-contracts-execution.mjs";
import { FACET_TOOL_CONTRACTS } from "./tool-contracts-facets.mjs";
import { READ_TOOL_CONTRACTS } from "./tool-contracts-read.mjs";

export const TOOL_CONTRACTS = Object.freeze([
  ...READ_TOOL_CONTRACTS,
  ...COLLABORATION_TOOL_CONTRACTS,
  ...EXECUTION_TOOL_CONTRACTS,
  ...FACET_TOOL_CONTRACTS
]);

export const TOOL_CONTRACT_BY_NAME = new Map(TOOL_CONTRACTS.map((contract) => [contract.name, contract]));
export const ALL_TOOL_NAMES = new Set(TOOL_CONTRACT_BY_NAME.keys());

validateContracts();

function validateContracts() {
  if (TOOL_CONTRACT_BY_NAME.size !== TOOL_CONTRACTS.length) {
    throw new Error("duplicate Swarm MCP tool name");
  }
  for (const contract of TOOL_CONTRACTS) {
    if (!contract.name || !contract.title || !contract.description || !contract.method || !contract.path) {
      throw new Error(`incomplete Swarm MCP contract: ${contract.name || "unnamed"}`);
    }
    if (contract.method !== "GET" && (!contract.commandKey || !contract.capabilityKey)) {
      throw new Error(`mutation contract lacks canonical authority metadata: ${contract.name}`);
    }
    const annotations = contract.annotations;
    if (!annotations || ["readOnlyHint", "destructiveHint", "idempotentHint", "openWorldHint"].some((key) => typeof annotations[key] !== "boolean")) {
      throw new Error(`tool contract lacks explicit safety annotations: ${contract.name}`);
    }
    if ((contract.effect === "read") !== annotations.readOnlyHint) {
      throw new Error(`tool read annotation does not match effect: ${contract.name}`);
    }
    if ((contract.effect === "destructive") !== annotations.destructiveHint) {
      throw new Error(`tool destructive annotation does not match effect: ${contract.name}`);
    }
    if (!annotations.idempotentHint || !annotations.openWorldHint) {
      throw new Error(`tool retry or open-world annotation is invalid: ${contract.name}`);
    }
  }
}
