import { runCommand } from "../command-runner.mjs";
import { WINDOWS_LOAD_SCRIPT, WINDOWS_REMOVE_SCRIPT, WINDOWS_SAVE_SCRIPT } from "./windows-scripts.mjs";

const TARGET_PREFIX = "Swarm MCP:";

export function windowsCredentialStore(config, runner = runCommand) {
  const target = TARGET_PREFIX + config.credentialAccount;
  const invoke = (script, value = "") => runner("powershell.exe", [
    "-NoLogo", "-NoProfile", "-NonInteractive", "-Command", script
  ], { input: `${target}\n${value}` });
  return {
    name: "Windows Credential Manager",
    async load() {
      try {
        const result = await invoke(WINDOWS_LOAD_SCRIPT);
        return result.stdout || null;
      } catch (error) {
        throw unavailable(error);
      }
    },
    async save(serialized) {
      try {
        await invoke(WINDOWS_SAVE_SCRIPT, serialized);
      } catch (error) {
        throw unavailable(error);
      }
    },
    async remove() {
      try {
        await invoke(WINDOWS_REMOVE_SCRIPT);
        return true;
      } catch (error) {
        throw unavailable(error);
      }
    }
  };
}

function unavailable(error) {
  return new Error(error?.unavailable ? "Windows Credential Manager is not available" : "Windows Credential Manager could not store Swarm access");
}
