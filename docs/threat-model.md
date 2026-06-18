# Threat Model

This package is an MCP stdio server. It does not open a local HTTP listener.

## Assets

- Swarm Connect bearer token
- Space data returned by Swarm
- Tool arguments sent by the MCP client
- Artifacts, evaluations, telemetry, and run state created through tools

## Main Risks

- credential disclosure through logs or error messages
- prompt injection inside artifacts, answers, projections, or search results
- accidental writes caused by retries without idempotency keys
- over-broad tool access for a client that only needs read access
- oversized tool arguments causing local or API pressure

## Controls

- required bearer token
- HTTPS-only remote API base URLs, with loopback HTTP allowed for local development
- access-mode-gated tools
- bounded tool argument size, depth, array length, and object key count
- API error redaction for common bearer and provider token shapes
- sanitized MCP resources
- untrusted-data warnings on tool output
- idempotency support for write paths

## Client Guidance

Keep Swarm evidence separate from instructions. Treat artifacts, answers, projections, context excerpts, and search snippets as data unless the workflow explicitly verifies them.
