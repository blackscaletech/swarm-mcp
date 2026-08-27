# Architecture

Swarm MCP has two transports over one backend authority:

```text
MCP app -> remote HTTPS /mcp -> Commands, Permits, services
MCP app -> local stdio bridge -> remote HTTPS /mcp -> Commands, Permits, services
```

Remote MCP is preferred. The package exists only for clients that require stdio. It translates local MCP framing into the stateless remote protocol and returns the backend response unchanged after bounded validation.

## Modules

- `src/auth`: browser authorization, PKCE, token rotation, and operating-system stores.
- `src/config`: non-secret endpoint and profile configuration.
- `src/protocol`: local MCP negotiation and request routing.
- `src/transports`: stdio framing.
- `src/swarm-api`: bounded remote MCP requests and canonical errors.
- `src/prompts`: continuity guidance.
- `src/resources`: sanitized local status and security guidance.

The package has no local tool registry. `tools/list` comes from the remote endpoint after current Permit resolution, so stdio and remote clients see the same capability-filtered definitions. `tools/call` is revalidated by Swarm even if a client bypasses local discovery.

One OAuth grant creates one client Identity and rotating refresh family. The user selects one or more Spaces during browser authorization. Each tool invocation remains scoped to one explicit Space unless Swarm exposes a separately registered cross-Space Command.

No transcript, Artifact body, model payload, provider credential, or Swarm bearer credential is authoritative in this process. Canonical state remains in Swarm services and storage.
