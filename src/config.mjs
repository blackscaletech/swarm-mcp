import { DEFAULT_TIMEOUT_MS, MAX_TIMEOUT_MS, MIN_TIMEOUT_MS } from "./constants.mjs";

const DEFAULT_BASE_URL = "https://api.swarm.services";

export function resolveConfig(env = process.env) {
  const baseUrl = normalizeURL(env.SWARM_API_BASE_URL || DEFAULT_BASE_URL);
  const token = String(env.SWARM_API_TOKEN || "").trim();
  const defaultSpaceId = String(env.SWARM_SPACE_ID || "").trim();
  const serverName = String(env.SWARM_MCP_SERVER_NAME || "Swarm MCP").trim() || "Swarm MCP";
  const timeoutMs = resolveTimeoutMs(env.SWARM_MCP_TIMEOUT_MS);

  if (!token) {
    throw new Error("SWARM_API_TOKEN is required");
  }

  return {
    baseUrl,
    token,
    defaultSpaceId,
    serverName,
    timeoutMs
  };
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
    throw new Error("SWARM_API_BASE_URL must be a valid https URL, or http for localhost development");
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
