import assert from "node:assert/strict";
import test from "node:test";
import { resolveCLIResponse } from "../src/cli.mjs";
import { PACKAGE_VERSION } from "../src/package-info.mjs";

test("CLI help is available before Swarm credentials are resolved", () => {
  const help = resolveCLIResponse(["--help"]);
  assert.match(help, new RegExp(`Swarm MCP ${PACKAGE_VERSION}`));
  assert.match(help, /SWARM_API_TOKEN/);
  assert.doesNotMatch(help, /access mode|operator|read-only/i);
});

test("CLI version is available before Swarm credentials are resolved", () => {
  assert.equal(resolveCLIResponse(["--version"]), `${PACKAGE_VERSION}\n`);
  assert.equal(resolveCLIResponse([]), null);
});
