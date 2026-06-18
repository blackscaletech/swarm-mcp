import { DEFAULT_TIMEOUT_MS, MAX_TIMEOUT_MS, MIN_TIMEOUT_MS } from "./constants.mjs";

const DEFAULT_BASE_URL = "https://api.swarm.services";

export const MCP_ACCESS_MODES = Object.freeze({
  "read-only": Object.freeze({
    label: "Swarm Read-Only",
    mutations: false
  }),
  operator: Object.freeze({
    label: "Swarm Operator",
    mutations: true
  })
});

export function resolveConfig(env = process.env) {
  const baseUrl = normalizeURL(env.SWARM_MCP_BASE_URL || env.SWARM_API_BASE_URL || DEFAULT_BASE_URL);
  const token = String(env.SWARM_MCP_TOKEN || env.SWARM_API_TOKEN || "").trim();
  const defaultSpaceId = String(env.SWARM_MCP_DEFAULT_SPACE_ID || env.SWARM_SPACE_ID || "").trim();
  const defaultAgentId = String(env.SWARM_MCP_AGENT_ID || env.SWARM_AGENT_ID || "").trim();
  const accessMode = resolveMCPAccessMode(env.SWARM_MCP_ACCESS_MODE || "operator");
  const serverName = String(env.SWARM_MCP_SERVER_NAME || accessMode.label).trim() || accessMode.label;
  const timeoutMs = resolveTimeoutMs(env.SWARM_MCP_TIMEOUT_MS);

  if (!token) {
    throw new Error("SWARM_MCP_TOKEN is required");
  }

  return {
    baseUrl,
    token,
    defaultSpaceId,
    defaultAgentId,
    accessMode: accessMode.key,
    serverName,
    timeoutMs
  };
}

export function resolveMCPAccessMode(value) {
  const normalized = String(value || "").trim().toLowerCase();
  const accessMode = MCP_ACCESS_MODES[normalized];
  if (!accessMode) {
    throw new Error(`unsupported SWARM_MCP_ACCESS_MODE: ${normalized}`);
  }
  return { key: normalized, ...accessMode };
}

function normalizeURL(value) {
  const normalized = String(value || "").trim().replace(/\/+$/, "");
  if (!normalized) {
    return DEFAULT_BASE_URL;
  }
  try {
    const url = new URL(normalized);
    if (url.protocol !== "https:" && url.protocol !== "http:") {
      throw new Error("unsupported scheme");
    }
    if (url.protocol === "http:" && !isLoopbackHost(url.hostname)) {
      throw new Error("insecure remote URL");
    }
    return url.toString().replace(/\/+$/, "");
  } catch {
    throw new Error("SWARM_MCP_BASE_URL must be a valid https URL, or http for localhost development");
  }
}

function isLoopbackHost(hostname) {
  const normalized = String(hostname || "").trim().toLowerCase();
  return (
    normalized === "localhost" ||
    normalized.endsWith(".localhost") ||
    normalized === "127.0.0.1" ||
    normalized === "::1" ||
    normalized === "[::1]"
  );
}

function resolveTimeoutMs(value) {
  if (value === undefined || value === null || String(value).trim() === "") {
    return DEFAULT_TIMEOUT_MS;
  }
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) {
    throw new Error("SWARM_MCP_TIMEOUT_MS must be an integer number of milliseconds");
  }
  if (parsed < MIN_TIMEOUT_MS || parsed > MAX_TIMEOUT_MS) {
    throw new Error(`SWARM_MCP_TIMEOUT_MS must be between ${MIN_TIMEOUT_MS} and ${MAX_TIMEOUT_MS}`);
  }
  return parsed;
}
