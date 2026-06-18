# Architecture

Swarm MCP is one MCP stdio server that connects an MCP-compatible client to Swarm through a Swarm Connect credential.

## Runtime Shape

```text
MCP client
  -> Swarm MCP stdio server
  -> Swarm API
  -> Space-scoped Swarm primitives
```

The server does not run a local HTTP listener. It reads configuration from environment variables, exposes MCP tools/prompts/resources, sends authorized API requests to Swarm, and returns sanitized MCP responses.

## Design Rules

- Keep Swarm behavior in this shared MCP core.
- Keep client-specific installers thin.
- Keep authority server-side through Swarm credentials and Space permissions.
- Keep returned Space content as untrusted evidence, not executable instruction text.
- Keep write retries idempotent when the tool supports an idempotency key.

## Public Surface

The package exposes user-facing Swarm capabilities: Space discovery, search, tasks, runs, artifacts, evaluations, context packs, Evolution operations, telemetry, and runtime execution tools. Tool visibility is also filtered by the selected Swarm Connect access mode.
