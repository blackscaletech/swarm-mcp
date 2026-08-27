# Contributing

Contributions should keep Swarm MCP small, auditable, and client-neutral.

## Local Checks

```sh
npm ci
npm test
```

## Guidelines

- Keep tool and authorization authority in Swarm instead of adding a local catalog or client-specific fork.
- Keep prompts provider-neutral.
- Do not add secrets, example tokens, cookies, or real customer data.
- Do not log bearer tokens or raw API responses that may contain sensitive data.
- Add tests for transport bounds, Permit-denial propagation, redaction, and failure handling.
- Prefer small modules over large catch-all files.

## Public API Surface

Tools should map to documented Swarm user capabilities and avoid account-wide operations that belong in the Swarm web UI.
