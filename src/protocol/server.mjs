import { PACKAGE_VERSION } from "../package-info.mjs";
import { getPrompt, listPrompts } from "../prompts/catalog.mjs";
import { listResources, readResource } from "../resources/catalog.mjs";
import { LEGACY_PROTOCOL_VERSION, METHODS } from "./constants.mjs";

export class SwarmMCPServer {
  constructor({ config, remoteClient, secureStoreName }) {
    this.config = config;
    this.remoteClient = remoteClient;
    this.secureStoreName = secureStoreName;
    this.initialized = false;
  }

  async handle(message) {
    const invalid = validateRequest(message);
    if (invalid) return failure(message?.id, -32600, invalid);
    const notification = message.id === undefined;
    if (message.method === METHODS.initialized) {
      this.initialized = true;
      return null;
    }
    if (notification) return null;
    if (message.method === METHODS.discover) return this.remote(message);
    if (message.method === METHODS.initialize) {
      this.initialized = true;
      return success(message.id, {
        protocolVersion: LEGACY_PROTOCOL_VERSION,
        capabilities: { prompts: {}, resources: {}, tools: { listChanged: false } },
        serverInfo: { name: this.config.serverName, version: PACKAGE_VERSION },
        instructions: "Use bounded Swarm context before acting and publish only durable results with provenance."
      });
    }
    if (!this.initialized) return failure(message.id, -32002, "Server is not initialized");
    if (message.method === METHODS.promptsList) return success(message.id, { prompts: listPrompts() });
    if (message.method === METHODS.promptsGet) {
      try {
        return success(message.id, getPrompt(objectParams(message.params).name));
      } catch {
        return failure(message.id, -32602, "Unknown Swarm prompt");
      }
    }
    if (message.method === METHODS.resourcesList) {
      const response = await this.remote(message);
      if (response.error) return response;
      if (!Array.isArray(response.result?.resources)) return failure(message.id, -32603, "Swarm returned an invalid resource catalog");
      const local = listResources();
      const localURIs = new Set(local.map(({ uri }) => uri));
      return { ...response, result: { ...response.result, resources: [
        ...(message.params?.cursor ? [] : local),
        ...response.result.resources.filter((resource) => !localURIs.has(resource?.uri))
      ] } };
    }
    if (message.method === METHODS.resourcesRead) {
      const uri = objectParams(message.params).uri;
      if (typeof uri !== "string" || !uri || uri.length > 2048) return failure(message.id, -32602, "Invalid Swarm resource");
      // Remote URIs are opaque MCP identifiers, never URLs to fetch locally.
      if (!listResources().some((resource) => resource.uri === uri)) return this.remote(message);
      try {
        return success(message.id, readResource(uri, this.config, this.secureStoreName));
      } catch {
        return failure(message.id, -32602, "Unknown Swarm resource");
      }
    }
    if (message.method === METHODS.ping || message.method === METHODS.toolsList || message.method === METHODS.toolsCall) {
      return this.remote(message);
    }
    return failure(message.id, -32601, "Method not found");
  }

  async remote(message) {
    try {
      return await this.remoteClient.request(message);
    } catch {
      return failure(message.id, -32603, "Swarm request failed");
    }
  }
}

function validateRequest(message) {
  if (!message || typeof message !== "object" || Array.isArray(message)) return "Invalid request";
  if (message.jsonrpc !== "2.0") return "Invalid JSON-RPC version";
  if (typeof message.method !== "string" || !message.method.trim()) return "Method is required";
  if (message.id !== undefined && message.id !== null && typeof message.id !== "string" && typeof message.id !== "number") return "Invalid request id";
  return "";
}

function objectParams(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function success(id, result) {
  return { jsonrpc: "2.0", id: id ?? null, result };
}

function failure(id, code, message) {
  return { jsonrpc: "2.0", id: id ?? null, error: { code, message } };
}
