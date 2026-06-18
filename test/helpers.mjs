import { SwarmMCPServer } from "../src/server.mjs";

export function makeServer(accessMode, client = {}) {
  return new SwarmMCPServer({
    config: {
      baseUrl: "https://api.swarm.services",
      token: "swarm_mcp_test",
      defaultSpaceId: "sp_test",
      defaultAgentId: "agt_test",
      accessMode,
      serverName: "Swarm MCP Test"
    },
    client
  });
}

export async function listToolNames(server) {
  await server.handle({ jsonrpc: "2.0", id: 1, method: "initialize" });
  const tools = await server.handle({ jsonrpc: "2.0", id: 2, method: "tools/list" });
  return tools.result.tools.map((tool) => tool.name);
}
