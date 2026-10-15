import { createCredential, credentialExpiresSoon } from "./credential.mjs";
import { withRequestTimeout } from "../swarm-api/request-timeout.mjs";
import { refreshAccess } from "./oauth-token.mjs";
import { CredentialStateError } from "./secure-store.mjs";

export class TokenManager {
  constructor({ config, store, fetchImpl = fetch, now = () => Date.now() }) {
    this.config = config;
    this.store = store;
    this.fetchImpl = fetchImpl;
    this.now = now;
    this.credential = null;
    if (typeof store.transaction !== "function") throw new Error("Swarm requires a coordinated secure credential store");
  }

  async accessToken({ forceRefresh = false, rejectedToken, signal } = {}) {
    const observed = rejectedToken || this.credential?.accessToken;
    return this.store.transaction(async (tx) => {
      const current = tx.load();
      if (!current) {
        this.credential = null;
        throw new CredentialStateError("Swarm is not connected. Run `swarm-mcp connect` first.");
      }
      // A newer generation already resolves a 401 for an older access token.
      const needsRefresh = credentialExpiresSoon(current, this.now()) ||
        (forceRefresh && (!observed || observed === current.accessToken));
      this.credential = needsRefresh ? await this.refreshCredential(tx, current) : current;
      if (tx.signal.aborted) throw new CredentialStateError("Swarm credential operation was cancelled.");
      return this.credential.accessToken;
    }, { signal });
  }

  async refresh(options = {}) {
    await this.accessToken({ ...options, forceRefresh: true });
    return this.credential;
  }

  async refreshCredential(tx, current) {
    await tx.beginRefresh();
    let token;
    try {
      token = await withRequestTimeout(this.config.timeoutMs,
        (signal) => refreshAccess({ credential: current }, this.fetchImpl, signal), tx.signal);
      if (token.refreshToken === current.refreshToken) throw new Error("refresh credential did not rotate");
    } catch (error) {
      throw new CredentialStateError(error?.kind === "revoked"
        ? "Swarm access is no longer active. Explicitly run `swarm-mcp disconnect`, then `swarm-mcp connect`."
        : "Swarm refresh outcome could not be verified. Retry local recovery; if unavailable, explicitly disconnect and connect again. No consumed proof will be retried.");
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
    return tx.replace(next);
  }
}
