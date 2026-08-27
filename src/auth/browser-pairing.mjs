import { createHash, randomBytes } from "node:crypto";
import { PACKAGE_VERSION } from "../package-info.mjs";
import { STDIO_OAUTH_CLIENT_ID } from "../protocol/constants.mjs";
import { withRequestTimeout } from "../swarm-api/request-timeout.mjs";
import { createCredential } from "./credential.mjs";
import { openBrowser } from "./browser-open.mjs";
import { createLoopbackCallback } from "./loopback-callback.mjs";
import { discoverOAuth } from "./oauth-discovery.mjs";
import { exchangeAuthorizationCode } from "./oauth-token.mjs";

export async function connectBrowser(config, store, options = {}) {
  const fetchImpl = options.fetchImpl || fetch;
  const metadata = await withRequestTimeout(config.timeoutMs,
    (signal) => discoverOAuth(config, fetchImpl, signal), options.signal);
  const state = randomBytes(32).toString("base64url");
  const verifier = randomBytes(48).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  const callback = await (options.createCallback || createLoopbackCallback)({ issuer: metadata.issuer, state });
  try {
    const authorizationURL = new URL(metadata.authorizationEndpoint);
    for (const [key, value] of Object.entries({
      client_id: STDIO_OAUTH_CLIENT_ID,
      code_challenge: challenge,
      code_challenge_method: "S256",
      redirect_uri: callback.redirectUri,
      resource: metadata.resource,
      response_type: "code",
      scope: metadata.scope,
      state
    })) authorizationURL.searchParams.set(key, value);
    const opened = await (options.openBrowser || openBrowser)(authorizationURL.toString(), options.browserOptions);
    if (!opened && options.onManualURL) options.onManualURL(authorizationURL.toString());
    const code = await callback.waitForCode();
    const token = await withRequestTimeout(config.timeoutMs, (signal) => exchangeAuthorizationCode({
      clientId: STDIO_OAUTH_CLIENT_ID, code, metadata, redirectUri: callback.redirectUri, verifier
    }, fetchImpl, signal), options.signal);
    const now = new Date();
    const credential = createCredential({
      accessToken: token.accessToken,
      clientId: STDIO_OAUTH_CLIENT_ID,
      createdAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + token.expiresIn * 1000).toISOString(),
      installationRef: `swi_${randomBytes(16).toString("hex")}`,
      issuer: metadata.issuer,
      profile: config.profile,
      refreshToken: token.refreshToken,
      resource: metadata.resource,
      scopeKeys: token.scopeKeys,
      tokenEndpoint: metadata.tokenEndpoint,
      updatedAt: now.toISOString()
    }, config);
    await store.save(credential);
    return Object.freeze({ profile: config.profile, secureStore: store.name });
  } catch (error) {
    callback.close();
    throw error;
  }
}

export function browserPairingClientMetadata() {
  return Object.freeze({ name: "@blackscaletech/swarm-mcp", version: PACKAGE_VERSION });
}
