import { fetchJSONBounded, isRecord } from "../swarm-api/bounded-fetch.mjs";

const TOKEN_RESPONSE_LIMIT_BYTES = 64 * 1024;

export async function exchangeAuthorizationCode({ code, clientId, metadata, redirectUri, verifier }, fetchImpl = fetch, signal) {
  return requestToken(metadata.tokenEndpoint, new URLSearchParams({
    client_id: clientId,
    code,
    code_verifier: verifier,
    grant_type: "authorization_code",
    redirect_uri: redirectUri,
    resource: metadata.resource
  }), fetchImpl, signal);
}

export async function refreshAccess({ credential }, fetchImpl = fetch, signal) {
  return requestToken(credential.tokenEndpoint, new URLSearchParams({
    client_id: credential.clientId,
    grant_type: "refresh_token",
    refresh_token: credential.refreshToken,
    resource: credential.resource,
    scope: credential.scopeKeys.join(" ")
  }), fetchImpl, signal);
}

async function requestToken(endpoint, form, fetchImpl, signal) {
  const result = await fetchJSONBounded(fetchImpl, endpoint, {
    body: form.toString(),
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded"
    },
    method: "POST",
    signal
  }, TOKEN_RESPONSE_LIMIT_BYTES);
  if (!result.response.ok || !isRecord(result.value)) throw new Error("Swarm access could not be issued");
  const accessToken = boundedToken(result.value.access_token);
  const refreshToken = boundedToken(result.value.refresh_token);
  const expiresIn = Number(result.value.expires_in);
  const scopeKeys = String(result.value.scope || "").trim().split(/\s+/).filter(Boolean);
  if (!accessToken || !refreshToken || result.value.token_type !== "Bearer" ||
      !Number.isInteger(expiresIn) || expiresIn < 60 || expiresIn > 900 ||
      scopeKeys.length !== 2 || !scopeKeys.includes("mcp") || !scopeKeys.includes("offline_access")) {
    throw new Error("Swarm returned invalid access credentials");
  }
  return Object.freeze({ accessToken, expiresIn, refreshToken, scopeKeys: Array.from(new Set(scopeKeys)).sort() });
}

function boundedToken(value) {
  const token = String(value || "").trim();
  return /^[\x21-\x7e]{32,1024}$/.test(token) ? token : "";
}
