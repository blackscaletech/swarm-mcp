import { fetchJSONBounded, isRecord } from "../swarm-api/bounded-fetch.mjs";

const METADATA_LIMIT_BYTES = 64 * 1024;

export async function discoverOAuth(config, fetchImpl = fetch, signal) {
  const resource = `${config.baseUrl}/mcp`;
  const protectedMetadataURL = `${config.baseUrl}/.well-known/oauth-protected-resource/mcp`;
  const protectedResult = await fetchJSONBounded(fetchImpl, protectedMetadataURL, {
    headers: { Accept: "application/json" }, signal
  }, METADATA_LIMIT_BYTES);
  if (!protectedResult.response.ok || !isRecord(protectedResult.value)) throw new Error("Swarm authorization metadata is unavailable");
  const authorizationServers = stringList(protectedResult.value.authorization_servers, 4, 2048);
  if (protectedResult.value.resource !== resource || authorizationServers.length !== 1 || authorizationServers[0] !== config.baseUrl) {
    throw new Error("Swarm authorization metadata does not match this endpoint");
  }
  const authorizationMetadataURL = `${config.baseUrl}/.well-known/oauth-authorization-server`;
  const authorizationResult = await fetchJSONBounded(fetchImpl, authorizationMetadataURL, {
    headers: { Accept: "application/json" }, signal
  }, METADATA_LIMIT_BYTES);
  if (!authorizationResult.response.ok || !isRecord(authorizationResult.value)) throw new Error("Swarm authorization metadata is unavailable");
  const metadata = authorizationResult.value;
  const issuer = exactEndpoint(metadata.issuer, config.baseUrl);
  const authorizationEndpoint = exactEndpoint(metadata.authorization_endpoint, config.baseUrl);
  const tokenEndpoint = exactEndpoint(metadata.token_endpoint, config.baseUrl);
  const scopes = stringList(metadata.scopes_supported, 8, 128);
  const challenges = stringList(metadata.code_challenge_methods_supported, 4, 32);
  const grants = stringList(metadata.grant_types_supported, 4, 64);
  if (issuer !== config.baseUrl || !scopes.includes("mcp") || !scopes.includes("offline_access") ||
      !challenges.includes("S256") || !grants.includes("authorization_code") || !grants.includes("refresh_token") ||
      metadata.resource_indicators_supported !== true || metadata.authorization_response_iss_parameter_supported !== true) {
    throw new Error("Swarm authorization metadata is incompatible");
  }
  return Object.freeze({ authorizationEndpoint, issuer, resource, scope: "mcp offline_access", tokenEndpoint });
}

function exactEndpoint(value, expectedOrigin) {
  const raw = String(value || "").trim();
  if (!raw || raw.length > 2048) throw new Error("Swarm authorization metadata is invalid");
  try {
    const parsed = new URL(raw);
    if (parsed.username || parsed.password || parsed.search || parsed.hash || parsed.origin !== expectedOrigin) {
      throw new Error("invalid endpoint");
    }
    return raw.replace(/\/$/, "");
  } catch {
    throw new Error("Swarm authorization metadata is invalid");
  }
}

function stringList(value, maximumItems, maximumLength) {
  if (!Array.isArray(value) || value.length > maximumItems) return [];
  const result = value.map((item) => String(item || "").trim());
  return result.some((item) => !item || item.length > maximumLength) ? [] : Array.from(new Set(result));
}
