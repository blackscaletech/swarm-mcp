import { createHash } from "node:crypto";

const DEFAULT_BASE_URL = "https://api.swarm.services";
const DEFAULT_TIMEOUT_MS = 30_000;
const MIN_TIMEOUT_MS = 1_000;
const MAX_TIMEOUT_MS = 120_000;
const PROFILE_PATTERN = /^[a-z0-9][a-z0-9._-]{0,63}$/;

export function resolveRuntimeConfig(env = process.env) {
  const baseUrl = normalizeBaseURL(env.SWARM_API_BASE_URL || DEFAULT_BASE_URL);
  const profile = normalizeProfile(env.SWARM_MCP_PROFILE || "default");
  const serverName = boundedText(env.SWARM_MCP_SERVER_NAME || "Swarm", 80) || "Swarm";
  const defaultSpaceId = boundedText(env.SWARM_SPACE_ID || "", 160);
  const timeoutMs = boundedInteger(env.SWARM_MCP_TIMEOUT_MS, DEFAULT_TIMEOUT_MS, MIN_TIMEOUT_MS, MAX_TIMEOUT_MS);
  return {
    baseUrl,
    credentialAccount: credentialAccount(baseUrl, profile),
    defaultSpaceId,
    profile,
    serverName,
    timeoutMs
  };
}

export function normalizeBaseURL(value) {
  let parsed;
  try {
    parsed = new URL(String(value || "").trim());
  } catch {
    throw new Error("SWARM_API_BASE_URL must be a valid HTTPS URL");
  }
  if (parsed.username || parsed.password || parsed.search || parsed.hash || (parsed.pathname && parsed.pathname !== "/")) {
    throw new Error("SWARM_API_BASE_URL must contain only an origin");
  }
  if (parsed.protocol !== "https:" && !(parsed.protocol === "http:" && isLoopback(parsed.hostname))) {
    throw new Error("SWARM_API_BASE_URL must use HTTPS, except for explicit loopback development");
  }
  return parsed.origin;
}

export function normalizeProfile(value) {
  const profile = String(value || "").trim().toLowerCase();
  if (!PROFILE_PATTERN.test(profile)) {
    throw new Error("SWARM_MCP_PROFILE must use 1-64 lowercase letters, numbers, dots, underscores, or hyphens");
  }
  return profile;
}

export function credentialAccount(baseUrl, profile) {
  const digest = createHash("sha256").update(`${normalizeBaseURL(baseUrl)}\n${normalizeProfile(profile)}`).digest("hex");
  return `profile-${digest.slice(0, 32)}`;
}

function boundedInteger(value, fallback, minimum, maximum) {
  if (value === undefined || value === null || String(value).trim() === "") return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new Error(`SWARM_MCP_TIMEOUT_MS must be an integer from ${minimum} to ${maximum}`);
  }
  return parsed;
}

function boundedText(value, maximum) {
  const normalized = String(value || "").trim();
  if (normalized.length > maximum) throw new Error("Swarm MCP configuration value is too long");
  return normalized;
}

function isLoopback(hostname) {
  const host = String(hostname || "").trim().toLowerCase().replace(/^\[|\]$/g, "");
  return host === "localhost" || host.endsWith(".localhost") || host === "127.0.0.1" || host === "::1";
}
