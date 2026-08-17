import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const source = process.argv[2] || process.env.SWARM_OPENAPI_FILE;
if (!source) {
  throw new Error("usage: node scripts/update-openapi-paths.mjs /path/to/v1.yaml");
}

const methodPaths = parseMethodPaths(await readFile(resolve(source), "utf8"));
if (methodPaths.length === 0) {
  throw new Error("no /v1 OpenAPI operations found");
}

const output = {
  contract: "swarm-api-v1",
  method_paths: methodPaths
};
await writeFile(
  new URL("../contracts/swarm-api-paths.json", import.meta.url),
  `${JSON.stringify(output, null, 2)}\n`
);

function parseMethodPaths(sourceText) {
  const methods = new Set(["get", "post", "put", "patch", "delete"]);
  const found = new Set();
  let currentPath = "";
  for (const line of sourceText.split(/\r?\n/)) {
    const pathMatch = line.match(/^  (\/v1\/.*):(?:\s*(.*))?$/);
    if (pathMatch) {
      currentPath = pathMatch[1];
      const inline = pathMatch[2] || "";
      for (const match of inline.matchAll(/\b(get|post|put|patch|delete):/g)) {
        found.add(`${match[1].toUpperCase()} ${currentPath}`);
      }
      continue;
    }
    const methodMatch = line.match(/^    (get|post|put|patch|delete):/);
    if (currentPath && methodMatch && methods.has(methodMatch[1])) {
      found.add(`${methodMatch[1].toUpperCase()} ${currentPath}`);
    }
  }
  return [...found].sort();
}
