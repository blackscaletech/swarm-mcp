import { CommandFailure, runCommand } from "../command-runner.mjs";

const SERVICE = "com.blackscale.swarm.mcp";
const MAX_ENCODED_CREDENTIAL_BYTES = 3_200;

export function macOSCredentialStore(config, runner = runCommand) {
  return {
    name: "macOS Keychain",
    async load() {
      try {
        const result = await runner("security", ["find-generic-password", "-a", config.credentialAccount, "-s", SERVICE, "-w"]);
        return decodeCredential(result.stdout);
      } catch (error) {
        if (error instanceof CommandFailure && error.code === 44) return null;
        throw unavailable(error);
      }
    },
    async save(serialized) {
      try {
        const encoded = Buffer.from(serialized, "utf8").toString("base64");
        await runner("security", ["-i"], {
          input: `add-generic-password -a ${config.credentialAccount} -s ${SERVICE} -U -w ${encoded}\n`
        });
      } catch (error) {
        throw unavailable(error);
      }
    },
    async remove() {
      try {
        await runner("security", ["delete-generic-password", "-a", config.credentialAccount, "-s", SERVICE]);
        return true;
      } catch (error) {
        if (error instanceof CommandFailure && error.code === 44) return false;
        throw unavailable(error);
      }
    }
  };
}

function decodeCredential(value) {
  const encoded = String(value || "").trim();
  if (!encoded) return null;
  if (encoded.length > MAX_ENCODED_CREDENTIAL_BYTES || !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) {
    throw new Error("macOS Keychain stored invalid Swarm access");
  }
  const decoded = Buffer.from(encoded, "base64");
  if (decoded.toString("base64") !== encoded || decoded.length > 2_400) {
    throw new Error("macOS Keychain stored invalid Swarm access");
  }
  return decoded.toString("utf8");
}

function unavailable(error) {
  return new Error(error?.unavailable ? "macOS Keychain is not available" : "macOS Keychain could not store Swarm access");
}
