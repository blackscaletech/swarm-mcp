import { PACKAGE_VERSION } from "../package-info.mjs";
import { CLIENT_INFO_META_KEY, MAX_REMOTE_RESPONSE_BYTES, NATIVE_PROTOCOL_VERSION } from "../protocol/constants.mjs";
import { fetchJSONBounded, isRecord } from "./bounded-fetch.mjs";

const MAX_REQUEST_BYTES = 256 * 1024;

export class RemoteMCPClient {
  constructor({ config, tokenManager, fetchImpl = fetch }) {
    this.config = config;
    this.tokenManager = tokenManager;
    this.fetchImpl = fetchImpl;
  }

  async request(message) {
    const native = nativeRequest(message, this.config.defaultSpaceId);
    let token = await this.tokenManager.accessToken();
    let result = await this.send(native, token);
    if (result.response.status === 401) {
      token = await this.tokenManager.accessToken({ forceRefresh: true });
      result = await this.send(native, token);
    }
    if (result.response.status === 401) throw new Error("Swarm access is no longer active. Run `swarm-mcp connect` again.");
    if (!isRecord(result.value) || result.value.jsonrpc !== "2.0" || !sameID(result.value.id, message.id)) {
      throw new Error("Swarm returned an invalid MCP response");
    }
    return result.value;
  }

  async send(message, token) {
    const body = JSON.stringify(message);
    if (Buffer.byteLength(body, "utf8") > MAX_REQUEST_BYTES) throw new Error("MCP request exceeded the size limit");
    const toolName = message.method === "tools/call" ? String(message.params?.name || "") : "";
    if (message.method === "tools/call" && !/^[a-z0-9][a-z0-9._-]{0,127}$/.test(toolName)) {
      throw new Error("MCP tool name is invalid");
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.config.timeoutMs);
    try {
      return await fetchJSONBounded(this.fetchImpl, `${this.config.baseUrl}/mcp`, {
        body,
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          "MCP-Protocol-Version": NATIVE_PROTOCOL_VERSION,
          "Mcp-Method": message.method,
          ...(toolName ? { "Mcp-Name": toolName } : {})
        },
        method: "POST",
        signal: controller.signal
      }, MAX_REMOTE_RESPONSE_BYTES);
    } finally {
      clearTimeout(timer);
    }
  }
}

export function nativeRequest(message, defaultSpaceId = "") {
  const params = isRecord(message.params) ? { ...message.params } : {};
  delete params._meta;
  if (message.method === "tools/call" && defaultSpaceId && isRecord(params.arguments) && !params.arguments.space_id) {
    params.arguments = { ...params.arguments, space_id: defaultSpaceId };
  }
  if (message.method !== "server/discover") {
    params._meta = {
      [CLIENT_INFO_META_KEY]: { name: "@blackscaletech/swarm-mcp", version: PACKAGE_VERSION }
    };
  }
  return { jsonrpc: "2.0", id: message.id ?? null, method: message.method, params };
}

function sameID(left, right) {
  return (left === null && (right === null || right === undefined)) || left === right;
}
