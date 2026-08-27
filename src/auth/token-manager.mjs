import { createCredential, credentialExpiresSoon } from "./credential.mjs";
import { withRequestTimeout } from "../swarm-api/request-timeout.mjs";
import { refreshAccess } from "./oauth-token.mjs";

export class TokenManager {
  constructor({ config, store, fetchImpl = fetch, now = () => Date.now() }) {
    this.config = config;
    this.store = store;
    this.fetchImpl = fetchImpl;
    this.now = now;
    this.credential = null;
    this.refreshPromise = null;
  }

  async accessToken({ forceRefresh = false } = {}) {
    if (!this.credential) this.credential = await this.store.load();
    if (!this.credential) throw new Error("Swarm is not connected. Run `swarm-mcp connect` first.");
    if (forceRefresh || credentialExpiresSoon(this.credential, this.now())) await this.refresh();
    return this.credential.accessToken;
  }

  async refresh() {
    if (this.refreshPromise) return this.refreshPromise;
    this.refreshPromise = this.refreshCredential();
    try {
      return await this.refreshPromise;
    } finally {
      this.refreshPromise = null;
    }
  }

  async refreshCredential() {
    const current = this.credential || await this.store.load();
    if (!current) throw new Error("Swarm is not connected. Run `swarm-mcp connect` first.");
    let token;
    try {
      token = await withRequestTimeout(this.config.timeoutMs,
        (signal) => refreshAccess({ credential: current }, this.fetchImpl, signal));
      if (token.refreshToken === current.refreshToken) throw new Error("refresh credential did not rotate");
    } catch {
      throw new Error("Swarm access could not be refreshed. Run `swarm-mcp connect` again.");
    }
    const now = new Date(this.now());
    const next = createCredential({
      ...current,
      accessToken: token.accessToken,
      expiresAt: new Date(now.getTime() + token.expiresIn * 1000).toISOString(),
      refreshToken: token.refreshToken,
      scopeKeys: token.scopeKeys,
      updatedAt: now.toISOString()
    }, this.config);
    await this.store.save(next);
    this.credential = next;
    return next;
  }
}
