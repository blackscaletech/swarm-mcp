import { SwarmAPIClient } from "./http-client.mjs";
import { LATEST_PROTOCOL_VERSION, MAX_STDIN_MESSAGE_BYTES, SUPPORTED_PROTOCOL_VERSIONS } from "./constants.mjs";
import { callSwarmTool } from "./tool-handlers.mjs";
import { buildToolDefinitions } from "./tool-definitions.mjs";
import { getPrompt, listPrompts } from "./prompts.mjs";
import { listResources, readResource } from "./resources.mjs";
import { PACKAGE_VERSION } from "./package-info.mjs";

export class SwarmMCPServer {
  constructor({ config, client = new SwarmAPIClient(config) }) {
    this.config = config;
    this.client = client;
    this.initialized = false;
    this.allowedToolNames = null;
  }

  tools() {
    return buildToolDefinitions(this.config.accessMode);
  }

  async handle(message) {
    if (!message || typeof message !== "object") {
      return error(null, -32600, "invalid request");
    }
    if (message.jsonrpc !== "2.0") {
      return error(message.id, -32600, "invalid JSON-RPC version");
    }
    if (typeof message.method !== "string" || message.method.trim() === "") {
      return error(message.id, -32600, "method is required");
    }

    if (message.method === "notifications/initialized") {
      this.initialized = true;
      return null;
    }

    if (message.method === "initialize") {
      this.initialized = true;
      return result(message.id, {
        protocolVersion: negotiatedProtocolVersion(message),
        capabilities: {
          tools: {},
          prompts: {},
          resources: {}
        },
        serverInfo: {
          name: this.config.serverName,
          version: PACKAGE_VERSION
        }
      });
    }

    if (!this.initialized) {
      return error(message.id, -32002, "server not initialized");
    }

    if (message.method === "ping") {
      return result(message.id, {});
    }

    if (message.method === "tools/list") {
      const tools = this.tools();
      this.allowedToolNames = new Set(tools.map((tool) => tool.name));
      return result(message.id, { tools });
    }

    if (message.method === "prompts/list") {
      return result(message.id, { prompts: listPrompts() });
    }

    if (message.method === "prompts/get") {
      const params = objectParams(message.params);
      if (typeof params.name !== "string" || params.name.trim() === "") {
        return error(message.id, -32602, "prompt name is required");
      }
      try {
        return result(message.id, getPrompt(params.name.trim(), params.arguments || {}, this.config));
      } catch (err) {
        return error(message.id, -32602, err.message || "invalid prompt request");
      }
    }

    if (message.method === "resources/list") {
      return result(message.id, { resources: listResources() });
    }

    if (message.method === "resources/read") {
      const params = objectParams(message.params);
      if (typeof params.uri !== "string" || params.uri.trim() === "") {
        return error(message.id, -32602, "resource uri is required");
      }
      try {
        return result(message.id, readResource(params.uri.trim(), this.config, this.tools()));
      } catch (err) {
        return error(message.id, -32602, err.message || "invalid resource request");
      }
    }

    if (message.method === "tools/call") {
      const params = objectParams(message.params);
      if (typeof params.name !== "string" || params.name.trim() === "") {
        return error(message.id, -32602, "tool name is required");
      }
      const invalidArguments =
        params.arguments !== undefined &&
        (!params.arguments || typeof params.arguments !== "object" || Array.isArray(params.arguments));
      if (invalidArguments) {
        return error(message.id, -32602, "tool arguments must be an object");
      }
      const output = await callSwarmTool({
        client: this.client,
        accessMode: this.config.accessMode,
        tools: () => this.tools(),
        allowedToolNames: this.allowedToolNames,
        name: params.name.trim(),
        args: params.arguments || {},
        defaultSpaceId: this.config.defaultSpaceId,
        defaultAgentId: this.config.defaultAgentId
      });
      return result(message.id, output);
    }

    return error(message.id, -32601, `method not found: ${message.method}`);
  }
}

export async function runStdio(server, input = process.stdin, output = process.stdout) {
  let buffer = "";
  for await (const chunk of input) {
    buffer += chunk.toString("utf8");
    if (Buffer.byteLength(buffer, "utf8") > MAX_STDIN_MESSAGE_BYTES) {
      output.write(`${JSON.stringify(error(null, -32600, "request too large"))}\n`);
      buffer = "";
      continue;
    }
    let newlineIndex = buffer.indexOf("\n");
    while (newlineIndex !== -1) {
      const line = buffer.slice(0, newlineIndex).trim();
      buffer = buffer.slice(newlineIndex + 1);
      if (line) {
        const response = await handleLine(server, line);
        if (response !== null) {
          output.write(`${JSON.stringify(response)}\n`);
        }
      }
      newlineIndex = buffer.indexOf("\n");
    }
  }
}

async function handleLine(server, line) {
  let message;
  try {
    message = JSON.parse(line);
  } catch {
    return error(null, -32700, "parse error");
  }
  try {
    return await server.handle(message);
  } catch {
    return error(message?.id, -32603, "server error");
  }
}

function negotiatedProtocolVersion(message) {
  const requested = typeof message.params?.protocolVersion === "string"
    ? message.params.protocolVersion
    : LATEST_PROTOCOL_VERSION;
  return SUPPORTED_PROTOCOL_VERSIONS.has(requested) ? requested : LATEST_PROTOCOL_VERSION;
}

function objectParams(params) {
  return params && typeof params === "object" && !Array.isArray(params) ? params : {};
}

function result(id, payload) {
  return { jsonrpc: "2.0", id: id ?? null, result: payload };
}

function error(id, code, message) {
  return { jsonrpc: "2.0", id: id ?? null, error: { code, message } };
}
