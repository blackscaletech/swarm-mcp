import { readFileSync } from "node:fs";

export const PACKAGE_VERSION = readPackageVersion();

function readPackageVersion() {
  try {
    const packageJson = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
    return typeof packageJson.version === "string" && packageJson.version.trim() !== ""
      ? packageJson.version
      : "0.0.0";
  } catch {
    return "0.0.0";
  }
}
