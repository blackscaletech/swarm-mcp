import { createHash } from "node:crypto";
import { credentialAccount } from "../config/runtime.mjs";
import { parseCredential, serializeCredential } from "./credential.mjs";
import { withCredentialLock } from "./credential-lock.mjs";
import { linuxCredentialStore } from "./stores/linux.mjs";
import { macOSCredentialStore } from "./stores/macos.mjs";
import { windowsCredentialStore } from "./stores/windows.mjs";

export function createSecureCredentialStore(config, options = {}) {
  if (config.credentialAccount !== credentialAccount(config.baseUrl, config.profile)) {
    throw new Error("Swarm credential ownership does not match this profile");
  }
  const platform = options.platform || process.platform;
  const factory = options.adapterFactory || (platform === "darwin" ? macOSCredentialStore
    : platform === "win32" ? windowsCredentialStore : platform === "linux" ? linuxCredentialStore : null);
  if (!factory) {
    throw new Error("No supported operating-system credential store is available. Use Swarm's remote MCP URL instead.");
  }
  const name = factory(config, options.runner).name;
  let retained = null;
  const transaction = async (operation, { signal, waitMs = config.timeoutMs, recover = true } = {}) => {
    return withCredentialLock(config.credentialAccount, async (lease) => {
      const runner = async (...args) => {
        lease.assertOwned();
        const result = await (options.runner || lease.runCommand)(...args);
        lease.assertOwned();
        return result;
      };
      const currentStore = factory(config, runner);
      const intentStore = factory({ ...config, credentialAccount: `${config.credentialAccount}-rotation` }, runner);
      const pendingStore = factory({ ...config, credentialAccount: `${config.credentialAccount}-pending` }, runner);
      const readCurrent = async () => {
        lease.assertOwned();
        const value = await currentStore.load();
        lease.assertOwned();
        return value ? parseCredential(value, config) : null;
      };
      const readIntent = async () => parseIntent(await intentStore.load());
      const readPending = async () => {
        const value = await pendingStore.load();
        return value ? parseCredential(value, config) : null;
      };
      const generation = (value) => value ? createHash("sha256").update(serializeCredential(value, config)).digest("hex") : null;
      const clearReplacement = async () => {
        await pendingStore.remove();
        await intentStore.remove();
        retained = null;
      };
      const commit = async (next, from) => {
        // Retain before any potentially failing secure-store write. Never return
        // or use the replacement until its durable promotion completes.
        retained = { next, from };
        await pendingStore.save(serializeCredential(next, config));
        await intentStore.save(JSON.stringify({ v: 1, kind: "replace", from, to: generation(next) }));
        await currentStore.save(serializeCredential(next, config));
        await clearReplacement();
        return next;
      };
      const removeAll = async () => {
        retained = null;
        await currentStore.remove();
        await pendingStore.remove();
        await intentStore.remove();
      };
      try {
        let current = recover ? await readCurrent() : Boolean(await currentStore.load());
        let intent = recover ? await readIntent() : Boolean(await intentStore.load());
        if (recover && intent) {
          if (intent.kind === "disconnect") {
            await removeAll();
            current = null;
          } else if (intent.kind === "replace" && generation(current) === intent.to) {
            await clearReplacement();
          } else {
            const from = generation(current);
            if (from !== intent.from) throw new CredentialStateError("Swarm local access changed during recovery. Explicitly disconnect, then connect again.");
            const next = retained?.from === from ? retained.next : await readPending();
            if (!next || (intent.kind === "replace" && generation(next) !== intent.to) ||
                (intent.kind === "refresh" && (!current || next.installationRef !== current.installationRef ||
                  next.createdAt !== current.createdAt || next.refreshToken === current.refreshToken))) {
              throw new CredentialStateError("Swarm refresh outcome is unknown. Explicitly run `swarm-mcp disconnect`, then `swarm-mcp connect`; no consumed proof was retried.");
            }
            current = await commit(next, from);
          }
          intent = null;
        }
        // A retained value is fenced by its durable intent, not by process memory.
        if (!intent) retained = null;
        if (lease.signal.aborted) throw new CredentialStateError("Swarm credential operation was cancelled.");
        const tx = {
          signal: lease.signal,
          load: () => current,
          async beginRefresh() {
            lease.assertOwned();
            if (!current || intent) throw new CredentialStateError("Swarm is not connected. Run `swarm-mcp connect` first.");
            if (lease.signal.aborted) throw new CredentialStateError("Swarm credential operation was cancelled.");
            await pendingStore.remove();
            intent = { v: 1, kind: "refresh", from: generation(current) };
            await intentStore.save(JSON.stringify(intent));
          },
          async replace(next) {
            lease.assertOwned();
            if (!intent) {
              if (current) throw new CredentialStateError(ALREADY_CONNECTED);
              await pendingStore.remove();
              intent = { v: 1, kind: "replace", from: null, to: generation(next) };
              // No provider refresh proof is consumed by a new installation.
              retained = { next, from: null };
              await intentStore.save(JSON.stringify(intent));
            }
            current = await commit(next, generation(current));
            intent = null;
            return current;
          },
          async disconnect() {
            lease.assertOwned();
            const found = Boolean(current || intent);
            await intentStore.save(JSON.stringify({ v: 1, kind: "disconnect" }));
            await removeAll();
            current = null;
            intent = null;
            return found;
          }
        };
        return await operation(tx);
      } catch (error) {
        if (error instanceof CredentialStateError) throw error;
        throw new CredentialStateError("Swarm secure credential store is unavailable or local recovery could not be persisted. Retry later; if recovery remains unavailable, explicitly disconnect and connect again.");
      }
    }, { signal, waitMs, directory: options.lockDirectory });
  };
  return {
    name,
    transaction,
    load(options) {
      return transaction((tx) => tx.load(), options);
    },
    save(credential, options) {
      return transaction((tx) => tx.replace(credential), options);
    },
    remove(options) {
      return transaction((tx) => tx.disconnect(), { ...options, recover: false });
    },
    connect(operation, options) {
      return transaction(async (tx) => {
        if (tx.load()) throw new CredentialStateError(ALREADY_CONNECTED);
        return operation({ name, save: (value) => tx.replace(value) }, tx.signal);
      }, options);
    }
  };
}

export class CredentialStateError extends Error {}

const ALREADY_CONNECTED = "This profile is already connected. To replace local access, explicitly run `swarm-mcp disconnect`, then `swarm-mcp connect`. Revoke old access in Swarm if required.";

function parseIntent(serialized) {
  if (!serialized) return null;
  try {
    if (typeof serialized !== "string" || Buffer.byteLength(serialized) > 512) throw new Error();
    const value = JSON.parse(serialized);
    const digest = (item) => typeof item === "string" && /^[a-f0-9]{64}$/.test(item);
    if (value.v !== 1 || !["disconnect", "refresh", "replace"].includes(value.kind) ||
        (value.kind === "refresh" && !digest(value.from)) ||
        (value.kind === "replace" && (!(value.from === null || digest(value.from)) || !digest(value.to)))) throw new Error();
    return value;
  } catch {
    throw new CredentialStateError("Swarm secure recovery state is invalid. Explicitly disconnect, then connect again.");
  }
}
