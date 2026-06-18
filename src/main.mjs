#!/usr/bin/env node

import { resolveCLIResponse } from "./cli.mjs";
import { resolveConfig } from "./config.mjs";
import { runStdio, SwarmMCPServer } from "./server.mjs";

try {
  const cliResponse = resolveCLIResponse(process.argv.slice(2));
  if (cliResponse) {
    process.stdout.write(cliResponse);
    process.exitCode = 0;
  } else {
    const config = resolveConfig();
    await runStdio(new SwarmMCPServer({ config }));
  }
} catch (error) {
  process.stderr.write(`Swarm MCP error: ${String(error?.message || error)}\n`);
  process.exitCode = 1;
}
