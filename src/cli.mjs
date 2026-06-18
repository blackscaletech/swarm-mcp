import { PACKAGE_VERSION } from "./package-info.mjs";

const HELP_FLAGS = new Set(["--help", "-h"]);
const VERSION_FLAGS = new Set(["--version", "-v"]);

export function resolveCLIResponse(args = []) {
  const normalized = args.map((arg) => String(arg || "").trim()).filter(Boolean);
  if (normalized.some((arg) => HELP_FLAGS.has(arg))) {
    return renderHelp();
  }
  if (normalized.some((arg) => VERSION_FLAGS.has(arg))) {
    return `${PACKAGE_VERSION}\n`;
  }
  return null;
}

export function renderHelp() {
  return [
    `Swarm MCP ${PACKAGE_VERSION}`,
    "",
    "Usage:",
    "  swarm-mcp",
    "",
    "Required environment:",
    "  SWARM_MCP_TOKEN              Swarm Connect token",
    "",
    "Common environment:",
    "  SWARM_MCP_BASE_URL           Swarm API URL, defaults to https://api.swarm.services",
    "  SWARM_MCP_DEFAULT_SPACE_ID   Default Space for tool calls",
    "  SWARM_MCP_AGENT_ID           Swarm Connect agent identity",
    "  SWARM_MCP_ACCESS_MODE        operator or read-only, defaults to operator",
    "",
    "Examples:",
    "  SWARM_MCP_TOKEN=... swarm-mcp",
    "  npx @blackscaletech/swarm-mcp",
    ""
  ].join("\n");
}
