import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { TOOL_CONTRACTS } from "../src/tool-contracts.mjs";

const manifest = JSON.parse(await readFile(
  new URL("../contracts/swarm-api-paths.json", import.meta.url),
  "utf8"
));
const operations = new Set(manifest.method_paths);

test("every MCP endpoint exists in the canonical OpenAPI contract", () => {
  for (const contract of TOOL_CONTRACTS) {
    assert.ok(
      operations.has(`${contract.method} ${contract.path}`),
      `${contract.name}: ${contract.method} ${contract.path}`
    );
  }
});

test("machine catalog excludes identity-owned and human Experience routes", () => {
  for (const contract of TOOL_CONTRACTS) {
    assert.doesNotMatch(contract.path, /^\/v1\/me\//, contract.name);
    assert.doesNotMatch(contract.path, /\/view(?:\/|$)/, contract.name);
    assert.doesNotMatch(
      contract.path,
      /\/(?:settings|bookmarks|context-links)(?:\/|$)/,
      contract.name
    );
  }
});
