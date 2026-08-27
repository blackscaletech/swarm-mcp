import { CommandFailure, runCommand } from "../command-runner.mjs";

const SERVICE = "com.blackscale.swarm.mcp";

export function linuxCredentialStore(config, runner = runCommand) {
  const attributes = ["service", SERVICE, "account", config.credentialAccount];
  return {
    name: "Linux Secret Service",
    async load() {
      try {
        const result = await runner("secret-tool", ["lookup", ...attributes]);
        return result.stdout.trim() || null;
      } catch (error) {
        if (error instanceof CommandFailure && error.code === 1) return null;
        throw unavailable(error);
      }
    },
    async save(serialized) {
      try {
        await runner("secret-tool", ["store", "--label=Swarm MCP", ...attributes], { input: serialized });
      } catch (error) {
        throw unavailable(error);
      }
    },
    async remove() {
      try {
        await runner("secret-tool", ["clear", ...attributes]);
        return true;
      } catch (error) {
        if (error instanceof CommandFailure && error.code === 1) return false;
        throw unavailable(error);
      }
    }
  };
}

function unavailable(error) {
  return new Error(error?.unavailable ? "Linux Secret Service is not available" : "Linux Secret Service could not store Swarm access");
}
