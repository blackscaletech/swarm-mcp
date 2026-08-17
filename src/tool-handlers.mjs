import { SWARM_MCP_LABEL, SWARM_UNTRUSTED_DATA_WARNING } from "./constants.mjs";
import { SwarmAPIError, pathSegment } from "./http-client.mjs";
import { ALL_TOOL_NAMES, TOOL_CONTRACT_BY_NAME } from "./tool-contracts.mjs";
import { validateToolInput } from "./tool-schema.mjs";

export async function callSwarmTool({ client, allowedToolNames, name, args = {}, defaultSpaceId }) {
  try {
    assertAdvertised(allowedToolNames, name);
    const contract = TOOL_CONTRACT_BY_NAME.get(name);
    const input = withDefaultSpace(contract, args, defaultSpaceId);
    validateToolInput(contract.inputSchema, input);
    const response = await client.request(contract.method, buildPath(contract, input), {
      query: selectMapped(input, contract.queryParams),
      body: buildBody(contract, input),
      idempotencyKey: contract.method === "GET" ? undefined : input.idempotency_key
    });
    return toolResult(contract.title, response);
  } catch (error) {
    return toolError(error);
  }
}

function withDefaultSpace(contract, args, defaultSpaceId) {
  const input = { ...args };
  if (contract.defaultSpace && !input.space_id) {
    if (!defaultSpaceId) {
      throw new Error("space_id is required when SWARM_SPACE_ID is not configured");
    }
    input.space_id = defaultSpaceId;
  }
  return input;
}

function buildPath(contract, input) {
  let path = contract.path;
  for (const [placeholder, field] of Object.entries(contract.pathParams || {})) {
    path = path.replace(`{${placeholder}}`, pathSegment(input[field]));
  }
  if (path.includes("{")) {
    throw new Error("required path parameter is missing");
  }
  return path;
}

function selectMapped(input, mapping = {}) {
  const selected = {};
  for (const [parameter, field] of Object.entries(mapping)) {
    if (input[field] !== undefined) {
      selected[parameter] = input[field];
    }
  }
  return selected;
}

function buildBody(contract, input) {
  if (!contract.bodyParams?.length) {
    return undefined;
  }
  return Object.fromEntries(
    contract.bodyParams
      .filter((field) => input[field] !== undefined)
      .map((field) => [field, input[field]])
  );
}

function assertAdvertised(allowedToolNames, name) {
  if (!(allowedToolNames || ALL_TOOL_NAMES).has(name) || !TOOL_CONTRACT_BY_NAME.has(name)) {
    throw new Error("unknown or unadvertised Swarm tool");
  }
}

function toolResult(title, value) {
  const data = value && typeof value === "object" && !Array.isArray(value) ? value : { data: value };
  const structuredContent = { ...data, warning: SWARM_UNTRUSTED_DATA_WARNING };
  return {
    content: [{
      type: "text",
      text: `${SWARM_MCP_LABEL}: ${title}\nWarning: ${SWARM_UNTRUSTED_DATA_WARNING}\n${JSON.stringify(data, null, 2)}`
    }],
    structuredContent,
    isError: false
  };
}

function toolError(error) {
  const detail = error instanceof SwarmAPIError
    ? safeAPIError(error)
    : { message: safeLocalMessage(error?.message) };
  return {
    content: [{ type: "text", text: `${SWARM_MCP_LABEL}: request failed\n${JSON.stringify(detail)}` }],
    structuredContent: detail,
    isError: true
  };
}

function safeAPIError(error) {
  const detail = {
    status: error.status,
    message: "Swarm rejected the request. Review the tool inputs and current permissions."
  };
  for (const key of ["retry-after", "x-correlation-id", "x-request-id", "x-trace-id"]) {
    if (error.headers?.[key]) {
      detail[key.replaceAll("-", "_")] = String(error.headers[key]).slice(0, 255);
    }
  }
  return detail;
}

function safeLocalMessage(message) {
  const safe = String(message || "Tool execution failed");
  return /required|invalid|unsupported|allowed|missing|unknown|advertised|length|range|fields|items|nested|format/i.test(safe)
    ? safe.slice(0, 512)
    : "Tool execution failed";
}
