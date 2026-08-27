export const LEGACY_PROTOCOL_VERSION = "2025-11-25";
export const NATIVE_PROTOCOL_VERSION = "2026-07-28";
export const STDIO_OAUTH_CLIENT_ID = "https://swarm.services/clients/swarm-mcp";
export const MAX_STDIN_MESSAGE_BYTES = 256 * 1024;
export const MAX_REMOTE_RESPONSE_BYTES = 1024 * 1024;
export const CLIENT_INFO_META_KEY = "io.modelcontextprotocol/clientInfo";

export const METHODS = Object.freeze({
  discover: "server/discover",
  initialize: "initialize",
  initialized: "notifications/initialized",
  ping: "ping",
  promptsGet: "prompts/get",
  promptsList: "prompts/list",
  resourcesList: "resources/list",
  resourcesRead: "resources/read",
  toolsCall: "tools/call",
  toolsList: "tools/list"
});
