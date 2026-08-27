import { STDIO_OAUTH_CLIENT_ID } from "../protocol/constants.mjs";

const SCHEMA_VERSION = "swarm.mcp.secure-credential.v1";
const MAX_CREDENTIAL_BYTES = 2400;
const TOKEN_PATTERN = /^[\x21-\x7e]{32,1024}$/;
const INSTALLATION_PATTERN = /^swi_[a-f0-9]{32}$/;

export function createCredential(value, config) {
  return validateCredential({ ...value, schemaVersion: SCHEMA_VERSION }, config);
}

export function parseCredential(serialized, config) {
  if (typeof serialized !== "string" || Buffer.byteLength(serialized, "utf8") > MAX_CREDENTIAL_BYTES) {
    throw new Error("Stored Swarm access is invalid");
  }
  let value;
  try {
    value = JSON.parse(serialized);
  } catch {
    throw new Error("Stored Swarm access is invalid");
  }
  return validateCredential(value, config);
}

export function serializeCredential(value, config) {
  const encoded = JSON.stringify(validateCredential(value, config));
  if (Buffer.byteLength(encoded, "utf8") > MAX_CREDENTIAL_BYTES) {
    throw new Error("Stored Swarm access is too large");
  }
  return encoded;
}

export function validateCredential(value, config) {
  if (!isRecord(value) || value.schemaVersion !== SCHEMA_VERSION) throw new Error("Stored Swarm access is invalid");
  const issuer = exactURL(value.issuer);
  const resource = exactURL(value.resource);
  const expiresAt = exactTime(value.expiresAt);
  const scopeKeys = stringList(value.scopeKeys, 8, 128);
  const credential = {
    schemaVersion: SCHEMA_VERSION,
    accessToken: token(value.accessToken),
    clientId: bounded(value.clientId, 512),
    createdAt: exactTime(value.createdAt),
    expiresAt,
    installationRef: bounded(value.installationRef, 64),
    issuer,
    profile: bounded(value.profile, 64),
    refreshToken: token(value.refreshToken),
    resource,
    scopeKeys,
    tokenEndpoint: sameOriginURL(value.tokenEndpoint, issuer),
    updatedAt: exactTime(value.updatedAt)
  };
  if (credential.clientId !== STDIO_OAUTH_CLIENT_ID || !INSTALLATION_PATTERN.test(credential.installationRef) ||
      credential.profile !== config.profile || issuer !== config.baseUrl || resource !== `${config.baseUrl}/mcp` ||
      credential.tokenEndpoint !== `${config.baseUrl}/oauth/token` ||
      !scopeKeys.includes("mcp") || !scopeKeys.includes("offline_access")) {
    throw new Error("Stored Swarm access does not match this profile");
  }
  return Object.freeze(credential);
}

function sameOriginURL(value, issuer) {
  const endpoint = exactURL(value);
  if (new URL(endpoint).origin !== new URL(issuer).origin) throw new Error("Stored Swarm access is invalid");
  return endpoint;
}

export function credentialExpiresSoon(credential, now = Date.now(), skewMs = 60_000) {
  return Date.parse(credential.expiresAt) <= now + skewMs;
}

function token(value) {
  const normalized = String(value || "").trim();
  if (!TOKEN_PATTERN.test(normalized)) throw new Error("Stored Swarm access is invalid");
  return normalized;
}

function exactURL(value) {
  const raw = bounded(value, 2048);
  try {
    const parsed = new URL(raw);
    if (parsed.username || parsed.password || parsed.search || parsed.hash || parsed.origin + parsed.pathname.replace(/\/$/, "") !== raw.replace(/\/$/, "")) {
      throw new Error("invalid URL");
    }
    return raw.replace(/\/$/, "");
  } catch {
    throw new Error("Stored Swarm access is invalid");
  }
}

function exactTime(value) {
  const raw = bounded(value, 64);
  const time = Date.parse(raw);
  if (!Number.isFinite(time) || new Date(time).toISOString() !== raw) throw new Error("Stored Swarm access is invalid");
  return raw;
}

function stringList(value, maxItems, maxLength) {
  if (!Array.isArray(value) || value.length === 0 || value.length > maxItems) throw new Error("Stored Swarm access is invalid");
  const result = Array.from(new Set(value.map((item) => bounded(item, maxLength)))).sort();
  if (result.length !== value.length || result.some((item) => !item)) throw new Error("Stored Swarm access is invalid");
  return result;
}

function bounded(value, maximum) {
  const normalized = String(value || "").trim();
  return normalized.length <= maximum ? normalized : "";
}

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
