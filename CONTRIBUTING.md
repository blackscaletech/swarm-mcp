# Contributing

## Maintainer Commit Identity

For Blackscale maintainer work, configure each new checkout explicitly rather
than inheriting an unrelated machine-wide Git identity:

```sh
git config --local user.name Blackscale
git config --local user.email hello@blackscale.tech
git config --local core.hooksPath .githooks
sh scripts/check-attribution.sh identity
```

The hooks and CI reject the known unrelated inherited identity in authors,
committers and co-author trailers. Required attribution CI protects the default
branch. Genuine outside contributors retain their own identity.
Never retarget published release tags to repair display attribution; those tags
anchor registry provenance.

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
