import {
  MAX_TOOL_ARGUMENT_BYTES,
  MAX_TOOL_ARGUMENT_DEPTH,
  MAX_TOOL_ARRAY_ITEMS,
  MAX_TOOL_OBJECT_KEYS,
  MAX_TOOL_STRING_BYTES,
  SWARM_MCP_LABEL,
  SWARM_UNTRUSTED_DATA_WARNING
} from "./constants.mjs";
import { randomUUID } from "node:crypto";
import { clampToolLimit } from "./tool-definitions.mjs";

export function textResult(title, value, isError = false, warning = SWARM_UNTRUSTED_DATA_WARNING) {
  const structuredContent = warning ? mergeStructuredContent(value, warning) : value;
  const warningLine = warning ? `Warning: ${warning}\n` : "";
  return {
    content: [
      {
        type: "text",
        text: `${SWARM_MCP_LABEL}: ${title}\n${warningLine}${JSON.stringify(structuredContent, null, 2)}`
      }
    ],
    structuredContent,
    isError
  };
}

function mergeStructuredContent(value, warning) {
  if (!warning) {
    return value;
  }
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return {
      ...value,
      warning
    };
  }
  return {
    warning,
    value
  };
}

export function textResultWithWarning(title, value, warning, isError = false) {
  return textResult(title, value, isError, warning);
}

export function plainTextResult(title, value, isError = false) {
  return textResult(title, value, isError, "");
}

export function requireString(value, field) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${field} is required`);
  }
  return checkedString(value.trim(), field);
}

export function optionalString(value, field = "value") {
  return typeof value === "string" && value.trim() !== "" ? checkedString(value.trim(), field) : undefined;
}

export function mutationOptions(args = {}) {
  const idempotencyKey =
    optionalString(args.idempotency_key) || optionalString(args.intent_key) || `swarm-mcp-${randomUUID()}`;
  return { idempotencyKey };
}

export function optionalSpaceId(args = {}) {
  return optionalString(args.space_id);
}

export function requireSpaceId(args = {}) {
  const value = optionalSpaceId(args);
  if (!value) {
    throw new Error("space_id is required");
  }
  return value;
}

export function requireDefaultSpaceId(defaultSpaceId) {
  const value = optionalString(defaultSpaceId);
  if (!value) {
    throw new Error("No default Swarm Space is configured. Set SWARM_MCP_DEFAULT_SPACE_ID before using default-Space tools.");
  }
  return value;
}

export function requireAgentId(args = {}, defaultAgentId = "") {
  const value = optionalString(args.agent_id) || optionalString(defaultAgentId);
  if (!value) {
    throw new Error("agent_id is required unless SWARM_MCP_AGENT_ID is configured.");
  }
  return value;
}

export function optionalNumber(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

export function optionalInteger(value) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : undefined;
}

export function requireInteger(value, field, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}) {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) {
    throw new Error(`${field} must be an integer`);
  }
  if (parsed < min || parsed > max) {
    throw new Error(`${field} must be between ${min} and ${max}`);
  }
  return parsed;
}

export function optionalBoolean(value) {
  return typeof value === "boolean" ? value : undefined;
}

export function collectionArgs(accessMode, toolName, args = {}, extra = {}) {
  return {
    ...extra,
    limit: clampToolLimit(accessMode, toolName, optionalNumber(args.limit)),
    cursor: optionalString(args.cursor),
    order: optionalString(args.order)
  };
}

export function optionalStringArray(value) {
  if (!Array.isArray(value)) {
    return undefined;
  }
  if (value.length > MAX_TOOL_ARRAY_ITEMS) {
    throw new Error(`array fields must contain ${MAX_TOOL_ARRAY_ITEMS} items or fewer`);
  }
  const items = value
    .filter((item) => typeof item === "string")
    .map((item) => checkedString(item.trim(), "array item"))
    .filter((item) => item !== "");
  return items.length > 0 ? items : undefined;
}

export function optionalStringMap(value) {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value !== "object" || Array.isArray(value)) {
    throw new Error("data must be an object");
  }
  const rawEntries = Object.entries(value);
  if (rawEntries.length > MAX_TOOL_OBJECT_KEYS) {
    throw new Error(`data must contain ${MAX_TOOL_OBJECT_KEYS} keys or fewer`);
  }
  const entries = rawEntries
    .filter(([key, item]) => typeof key === "string" && key.trim() !== "" && item !== undefined && item !== null)
    .map(([key, item]) => [
      checkedString(key.trim(), "data key"),
      checkedString(typeof item === "string" ? item.trim() : String(item).trim(), "data value")
    ])
    .filter(([, item]) => item !== "")
    .slice(0, 16);
  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
}

export function requireObject(value, field) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${field} must be an object`);
  }
  return value;
}

export function optionalObject(value, field) {
  if (value === undefined || value === null) {
    return undefined;
  }
  return requireObject(value, field);
}

export function optionalOperationRefs(value, field) {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (!Array.isArray(value)) {
    throw new Error(`${field} must be an array`);
  }
  const refs = value
    .filter((item) => item && typeof item === "object" && !Array.isArray(item))
    .map((item) => ({
      resource_type: optionalString(item.resource_type),
      resource_id: optionalString(item.resource_id),
      external_ref: optionalString(item.external_ref),
      artifact_kind: optionalString(item.artifact_kind),
      metadata: optionalStringMap(item.metadata)
    }))
    .filter((item) => item.resource_type);
  return refs.length > 0 ? refs : undefined;
}

export function optionalRunRequirements(value) {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value !== "object" || Array.isArray(value)) {
    throw new Error("run_requirements must be an object");
  }
  const spec = {
    target_agent_ids: optionalStringArray(value.target_agent_ids),
    required_capabilities: optionalStringArray(value.required_capabilities),
    required_tools: optionalStringArray(value.required_tools),
    required_models: optionalStringArray(value.required_models),
    required_connectors: optionalStringArray(value.required_connectors),
    required_regions: optionalStringArray(value.required_regions),
    required_protocols: optionalStringArray(value.required_protocols),
    required_hosting_mode: optionalString(value.required_hosting_mode),
    required_runtime_human_action_tags: optionalStringArray(value.required_runtime_human_action_tags)
  };
  const filtered = Object.fromEntries(Object.entries(spec).filter(([, field]) => {
    if (Array.isArray(field)) {
      return field.length > 0;
    }
    return Boolean(field);
  }));
  return Object.keys(filtered).length > 0 ? filtered : undefined;
}

export function optionalRunContextRefs(value) {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (!Array.isArray(value)) {
    throw new Error("run_context_refs must be an array");
  }
  const refs = value
    .filter((item) => item && typeof item === "object" && !Array.isArray(item))
    .map((item) => ({
      resource_type: optionalString(item.resource_type),
      resource_id: optionalString(item.resource_id)
    }))
    .filter((item) => item.resource_type && item.resource_id);
  return refs.length > 0 ? refs : undefined;
}

export function validateToolArguments(args = {}) {
  const size = Buffer.byteLength(JSON.stringify(args || {}), "utf8");
  if (size > MAX_TOOL_ARGUMENT_BYTES) {
    throw new Error(`tool arguments exceed ${MAX_TOOL_ARGUMENT_BYTES} bytes`);
  }
  validateArgumentShape(args, "arguments", 0);
}

function validateArgumentShape(value, field, depth) {
  if (depth > MAX_TOOL_ARGUMENT_DEPTH) {
    throw new Error(`${field} is too deeply nested`);
  }
  if (typeof value === "string") {
    checkedString(value, field);
    return;
  }
  if (Array.isArray(value)) {
    if (value.length > MAX_TOOL_ARRAY_ITEMS) {
      throw new Error(`${field} must contain ${MAX_TOOL_ARRAY_ITEMS} items or fewer`);
    }
    value.forEach((item, index) => validateArgumentShape(item, `${field}[${index}]`, depth + 1));
    return;
  }
  if (value && typeof value === "object") {
    const entries = Object.entries(value);
    if (entries.length > MAX_TOOL_OBJECT_KEYS) {
      throw new Error(`${field} must contain ${MAX_TOOL_OBJECT_KEYS} keys or fewer`);
    }
    for (const [key, item] of entries) {
      checkedString(String(key), `${field} key`);
      validateArgumentShape(item, `${field}.${key}`, depth + 1);
    }
  }
}

function checkedString(value, field) {
  if (Buffer.byteLength(value, "utf8") > MAX_TOOL_STRING_BYTES) {
    throw new Error(`${field} exceeds ${MAX_TOOL_STRING_BYTES} bytes`);
  }
  return value;
}
