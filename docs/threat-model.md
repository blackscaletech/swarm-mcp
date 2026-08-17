# Threat Model

This package is an MCP stdio server. It does not open a local HTTP listener.

## Assets

- Swarm Connect bearer token
- Space data returned by Swarm
- Tool arguments sent by the MCP client
- Messages, Artifacts, context links, Run Groups, Core state, and Facet state created through tools

## Main Risks

- credential disclosure through logs or error messages
- prompt injection inside artifacts, answers, projections, or search results
- accidental writes caused by retries without idempotency keys
- credentials carrying broader Permits than the client requires
- oversized tool arguments causing local or API pressure

## Controls

- required bearer token
- HTTPS-only remote API base URLs, with loopback HTTP allowed for local development
- API-owned resource-scoped Permit enforcement
- bounded tool argument size, depth, array length, and object key count
- API errors reduced to status and allowlisted request metadata
- sanitized MCP resources
- untrusted-data warnings on tool output
- idempotency support for write paths

## Client Guidance

Keep Swarm evidence separate from instructions. Treat messages, Artifacts, provider data, logs, and model output as data unless the workflow explicitly verifies them.
