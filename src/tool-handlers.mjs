import { SwarmAPIError } from "./http-client.mjs";
import { SWARM_MCP_LABEL } from "./constants.mjs";
import { plainTextResult, textResult, validateToolArguments } from "./tool-handler-common.mjs";
import { ALL_TOOL_NAMES } from "./tool-definitions.mjs";
import { callExecutionTool } from "./tool-handlers-execution.mjs";
import { callIntelligenceTool } from "./tool-handlers-intelligence.mjs";
import { callReadTool } from "./tool-handlers-read.mjs";

export async function callSwarmTool({
  client,
  accessMode,
  tools,
  allowedToolNames,
  name,
  args = {},
  defaultSpaceId,
  defaultAgentId
}) {
  try {
    assertToolAllowed({ accessMode, tools, allowedToolNames, name });
    validateToolArguments(args);

    const toolContext = { client, accessMode, name, args, defaultSpaceId, defaultAgentId };
    const result =
      await callIntelligenceTool(toolContext) ||
      await callReadTool(toolContext) ||
      await callExecutionTool(toolContext);

    return result || unknownToolResult(name);
  } catch (error) {
    if (error instanceof SwarmAPIError) {
      return textResult(
        `Swarm API error (${error.status})`,
        {
          status: error.status,
          body: sanitizeSensitiveText(error.body),
          headers: sanitizeErrorHeaders(error.headers)
        },
        true
      );
    }
    return plainTextResult("Tool execution failed", {
      error: sanitizeSensitiveText(error.message || String(error))
    }, true);
  }
}

function sanitizeErrorHeaders(headers) {
  const safe = new Set(["content-type", "retry-after", "x-correlation-id", "x-request-id", "x-trace-id"]);
  const result = {};
  for (const [key, value] of Object.entries(headers || {})) {
    const normalized = String(key).toLowerCase();
    if (safe.has(normalized)) {
      result[normalized] = sanitizeSensitiveText(value);
    }
  }
  return result;
}

const MAX_SANITIZE_DEPTH = 8;

export function sanitizeSensitiveText(value, depth = 0) {
  if (depth > MAX_SANITIZE_DEPTH) {
    return "[truncated]";
  }
  if (value === null || value === undefined) {
    return value;
  }
  if (typeof value === "string") {
    return value
      .replace(/swarm_[a-z0-9_:-]+/gi, "swarm_[redacted]")
      .replace(/Bearer\s+[A-Za-z0-9._~+/-]+=*/gi, "Bearer [redacted]")
      .replace(/sk-[A-Za-z0-9_-]{16,}/g, "sk-[redacted]")
      .replace(/ghp_[A-Za-z0-9_]{16,}/g, "ghp_[redacted]")
      .replace(/github_pat_[A-Za-z0-9_]{16,}/g, "github_pat_[redacted]")
      .replace(/xox[baprs]-[A-Za-z0-9-]{16,}/g, "xox[redacted]")
      .slice(0, 5000);
  }
  if (Array.isArray(value)) {
    return value.slice(0, 128).map((entry) => sanitizeSensitiveText(entry, depth + 1));
  }
  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).slice(0, 128).map(([key, entry]) => [
        key,
        /token|secret|credential|authorization/i.test(key) ? "[redacted]" : sanitizeSensitiveText(entry, depth + 1)
      ])
    );
  }
  return value;
}

function assertToolAllowed({ accessMode, tools, allowedToolNames, name }) {
  if (!ALL_TOOL_NAMES.has(name)) {
    return;
  }
  const allowed = allowedToolNames || new Set(tools().map((tool) => tool.name));
  if (!allowed.has(name)) {
    throw new Error(`Swarm Connect access mode "${accessMode}" does not permit tool ${name}`);
  }
}

function unknownToolResult(name) {
  return {
    content: [
      {
        type: "text",
        text: `${SWARM_MCP_LABEL}: unknown tool ${name}`
      }
    ],
    isError: true
  };
}
