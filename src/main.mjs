#!/usr/bin/env node

import { connectBrowser } from "./auth/browser-pairing.mjs";
import { createSecureCredentialStore } from "./auth/secure-store.mjs";
import { TokenManager } from "./auth/token-manager.mjs";
import { resolveCLICommand } from "./cli.mjs";
import { resolveRuntimeConfig } from "./config/runtime.mjs";
import { SwarmMCPServer } from "./protocol/server.mjs";
import { RemoteMCPClient } from "./swarm-api/remote-mcp-client.mjs";
import { runStdio } from "./transports/stdio.mjs";

try {
  const command = resolveCLICommand(process.argv.slice(2));
  if (command.kind === "output") {
    process.stdout.write(command.text);
  } else {
    const config = resolveRuntimeConfig();
    const store = createSecureCredentialStore(config);
    if (command.kind === "connect") {
      if (await store.load()) throw new Error("This profile is already connected. Manage or revoke it in Swarm before replacing local access.");
      const connected = await connectBrowser(config, store, {
        onManualURL: (url) => process.stderr.write(`Open this Swarm authorization URL:\n${url}\n`)
      });
      process.stdout.write(`Swarm is connected using ${connected.secureStore}.\n`);
    } else if (command.kind === "disconnect") {
      const removed = await store.remove();
      process.stdout.write(removed
        ? "Local Swarm access was removed. Revoke the client in Swarm to end server-side access.\n"
        : "No local Swarm access was found.\n");
    } else if (command.kind === "status") {
      const credential = await store.load();
      process.stdout.write(credential
        ? `Connected to ${config.baseUrl} using ${store.name}.\n`
        : "Not connected. Run `swarm-mcp connect`.\n");
    } else {
      const tokenManager = new TokenManager({ config, store });
      await tokenManager.accessToken();
      const remoteClient = new RemoteMCPClient({ config, tokenManager });
      await runStdio(new SwarmMCPServer({ config, remoteClient, secureStoreName: store.name }));
    }
  }
  process.exitCode = 0;
} catch (error) {
  process.stderr.write(`Swarm MCP: ${safeMessage(error)}\n`);
  process.exitCode = 1;
}

function safeMessage(error) {
  const message = String(error?.message || "Swarm MCP could not complete the request.");
  return message.length <= 320 && !/swa_|swr_|bearer|token[=:]|credentialblob/i.test(message)
    ? message
    : "Swarm MCP could not complete the request.";
}
