import { PACKAGE_VERSION } from "./package-info.mjs";

const HELP_FLAGS = new Set(["--help", "-h"]);
const VERSION_FLAGS = new Set(["--version", "-v"]);
const COMMANDS = new Set(["connect", "disconnect", "status"]);

export function resolveCLICommand(args = []) {
  const normalized = args.map((arg) => String(arg || "").trim()).filter(Boolean);
  if (normalized.some((arg) => HELP_FLAGS.has(arg))) return { kind: "output", text: renderHelp() };
  if (normalized.some((arg) => VERSION_FLAGS.has(arg))) return { kind: "output", text: `${PACKAGE_VERSION}\n` };
  if (normalized.length === 0) return { kind: "serve" };
  if (normalized.length === 1 && COMMANDS.has(normalized[0])) return { kind: normalized[0] };
  throw new Error("Unknown Swarm MCP command. Run `swarm-mcp --help`.");
}

export function renderHelp() {
  return [
    `Swarm MCP ${PACKAGE_VERSION}`,
    "",
    "Usage:",
    "  swarm-mcp connect       Connect in your browser",
    "  swarm-mcp               Start the MCP stdio bridge",
    "  swarm-mcp status        Check local connection state",
    "  swarm-mcp disconnect    Remove access from this device",
    "",
    "Non-secret configuration:",
    "  SWARM_API_BASE_URL      Swarm API origin (default: https://api.swarm.services)",
    "  SWARM_MCP_PROFILE       Local profile name (default: default)",
    "  SWARM_SPACE_ID          Optional convenience Space; authority stays server-owned",
    "  SWARM_MCP_TIMEOUT_MS    Request timeout from 1000 to 120000 milliseconds",
    "",
    "Swarm access is stored in Keychain, Credential Manager, or Secret Service.",
    "No token file or token environment variable is supported.",
    ""
  ].join("\n");
}
