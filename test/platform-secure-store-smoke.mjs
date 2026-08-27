import { randomBytes } from "node:crypto";
import { createCredential } from "../src/auth/credential.mjs";
import { createSecureCredentialStore } from "../src/auth/secure-store.mjs";
import { resolveRuntimeConfig } from "../src/config/runtime.mjs";

const config = resolveRuntimeConfig({
  SWARM_API_BASE_URL: "https://api.example",
  SWARM_MCP_PROFILE: `smoke-${randomBytes(6).toString("hex")}`
});
const store = createSecureCredentialStore(config);
const now = new Date();
const credential = createCredential({
  accessToken: `swa_${randomBytes(48).toString("base64url")}`,
  clientId: "https://swarm.services/clients/swarm-mcp",
  createdAt: now.toISOString(),
  expiresAt: new Date(now.getTime() + 600_000).toISOString(),
  installationRef: `swi_${randomBytes(16).toString("hex")}`,
  issuer: config.baseUrl,
  profile: config.profile,
  refreshToken: `swr_${randomBytes(48).toString("base64url")}`,
  resource: `${config.baseUrl}/mcp`,
  scopeKeys: ["mcp", "offline_access"],
  tokenEndpoint: `${config.baseUrl}/oauth/token`,
  updatedAt: now.toISOString()
}, config);

try {
  if (await store.load()) throw new Error("Disposable credential profile already exists");
  await store.save(credential);
  const loaded = await store.load();
  if (!loaded || loaded.installationRef !== credential.installationRef) {
    throw new Error("Operating-system credential store round trip failed");
  }
  if (!await store.remove() || await store.load()) {
    throw new Error("Operating-system credential store cleanup failed");
  }
  process.stdout.write(`${store.name} round trip passed; disposable record removed.\n`);
} finally {
  await store.remove().catch(() => {});
}
