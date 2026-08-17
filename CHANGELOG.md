# Changelog

## 0.2.0

- Replaces client-side access-mode filtering with one canonical tool catalog.
- Makes API Permits the sole authorization authority for reads and mutations.
- Canonicalizes connector configuration to `SWARM_API_BASE_URL`, `SWARM_API_TOKEN`, and optional `SWARM_SPACE_ID`.
- Preserves local tool validation, bounded HTTP behavior, redaction, and unknown-tool rejection.

## 0.1.1

- Adds credential-free `--help` and `--version` output for first-run setup checks.
- Keeps release publishing idempotent when a package version is already live on npm.

## 0.1.0

- Initial public Swarm MCP server.
- Supports Space discovery, search, runs, tasks, artifacts, evaluations, context packs, answers, Evolution operations, learning queues, projections, telemetry, and runtime execution tools.
- Includes bounded tool arguments, idempotency headers, sanitized MCP resources, reusable MCP prompts, and API error redaction.
