import { parseCredential, serializeCredential } from "./credential.mjs";
import { linuxCredentialStore } from "./stores/linux.mjs";
import { macOSCredentialStore } from "./stores/macos.mjs";
import { windowsCredentialStore } from "./stores/windows.mjs";

export function createSecureCredentialStore(config, options = {}) {
  const platform = options.platform || process.platform;
  const runner = options.runner;
  const adapter = platform === "darwin"
    ? macOSCredentialStore(config, runner)
    : platform === "win32"
      ? windowsCredentialStore(config, runner)
      : platform === "linux"
        ? linuxCredentialStore(config, runner)
        : null;
  if (!adapter) {
    throw new Error("No supported operating-system credential store is available. Use Swarm's remote MCP URL instead.");
  }
  return {
    name: adapter.name,
    async load() {
      const serialized = await adapter.load();
      return serialized ? parseCredential(serialized, config) : null;
    },
    async save(credential) {
      await adapter.save(serializeCredential(credential, config));
    },
    async remove() {
      return adapter.remove();
    }
  };
}
