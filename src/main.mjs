#!/usr/bin/env node

import { resolveConfig } from "./config.mjs";
import { runStdio, SwarmMCPServer } from "./server.mjs";

try {
  const config = resolveConfig();
  await runStdio(new SwarmMCPServer({ config }));
} catch (error) {
  process.stderr.write(`Swarm MCP error: ${String(error?.message || error)}\n`);
  process.exitCode = 1;
}
