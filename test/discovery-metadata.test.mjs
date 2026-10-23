import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readJSON(path) {
  return JSON.parse(readFileSync(new URL(path, import.meta.url), "utf8"));
}

test("directory metadata points only to the canonical remote MCP endpoint", () => {
  const registry = readJSON("../server.json");
  const cursor = readJSON("../mcp.json");
  const plugin = readJSON("../.cursor-plugin/plugin.json");
  const glama = readJSON("../glama.json");

  assert.equal(registry.name, "io.github.blackscaletech/swarm");
  assert.ok(registry.description.length <= 100);
  assert.deepEqual(registry.remotes, [
    { type: "streamable-http", url: "https://api.swarm.services/mcp" },
  ]);
  assert.equal(cursor.mcpServers.swarm.url, registry.remotes[0].url);
  assert.deepEqual(Object.keys(cursor.mcpServers.swarm), ["url"]);
  assert.equal(plugin.name, "swarm");
  assert.equal(plugin.repository, registry.repository.url);
  assert.equal(plugin.displayName, "Swarm");
  assert.equal(plugin.publisher, "Blackscale");
  assert.equal(plugin.logo, "assets/swarm-logo.png");
  assert.deepEqual(glama.maintainers, ["blackscaletech"]);
});
