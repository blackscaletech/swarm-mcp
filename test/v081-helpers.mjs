import { createCredential } from "../src/auth/credential.mjs";
import { resolveRuntimeConfig } from "../src/config/runtime.mjs";

export function testConfig(overrides = {}) {
  return { ...resolveRuntimeConfig({ SWARM_API_BASE_URL: "https://api.example", SWARM_MCP_PROFILE: "test" }), ...overrides };
}

export function testCredential(config = testConfig(), overrides = {}) {
  return createCredential({
    accessToken: "swa_" + "a".repeat(64),
    clientId: "https://swarm.services/clients/swarm-mcp",
    createdAt: "2026-08-25T12:00:00.000Z",
    expiresAt: "2026-08-25T12:10:00.000Z",
    installationRef: "swi_" + "1".repeat(32),
    issuer: config.baseUrl,
    profile: config.profile,
    refreshToken: "swr_" + "r".repeat(64),
    resource: `${config.baseUrl}/mcp`,
    scopeKeys: ["mcp", "offline_access"],
    tokenEndpoint: `${config.baseUrl}/oauth/token`,
    updatedAt: "2026-08-25T12:00:00.000Z",
    ...overrides
  }, config);
}

export function jsonResponse(value, status = 200, headers = {}) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json", ...headers }
  });
}

export function oauthMetadata(config = testConfig()) {
  return [
    jsonResponse({
      authorization_servers: [config.baseUrl],
      bearer_methods_supported: ["header"],
      resource: `${config.baseUrl}/mcp`,
      scopes_supported: ["mcp", "offline_access"]
    }),
    jsonResponse({
      authorization_endpoint: `${config.baseUrl}/oauth/authorize`,
      authorization_response_iss_parameter_supported: true,
      client_id_metadata_document_supported: true,
      code_challenge_methods_supported: ["S256"],
      grant_types_supported: ["authorization_code", "refresh_token"],
      issuer: config.baseUrl,
      registration_endpoint: `${config.baseUrl}/oauth/register`,
      resource_indicators_supported: true,
      scopes_supported: ["mcp", "offline_access"],
      token_endpoint: `${config.baseUrl}/oauth/token`,
      token_endpoint_auth_methods_supported: ["none"]
    })
  ];
}
