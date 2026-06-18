# Contributing

Contributions should keep Swarm MCP small, auditable, and client-neutral.

## Local Checks

```sh
npm test
```

## Guidelines

- Keep MCP logic in the shared server instead of adding client-specific forks.
- Keep prompts provider-neutral.
- Do not add secrets, example tokens, cookies, or real customer data.
- Do not log bearer tokens or raw API responses that may contain sensitive data.
- Add tests for new tools, access modes, redaction behavior, and error handling.
- Prefer small modules over large catch-all files.

## Public API Surface

Tools should map to documented Swarm user capabilities and avoid account-wide operations that belong in the Swarm web UI.
