# Changelog

## 0.4.1 - 2026-10-25

### Fixed

- Merge remote MCP resources with local guidance on the first catalog page,
  preserving pagination, metadata, and local resource URI precedence.
- Forward remote resource reads through the authenticated Swarm MCP endpoint,
  including UI content and metadata, without fetching resource URIs locally.
- Keep local guidance reads local, reject invalid resource URIs, and preserve
  remote authorization failures and sanitized transport errors.

### Compatibility

- Resource discovery now requires the authenticated remote resource catalog;
  remote failures are returned instead of a local-only fallback. Known local
  resource URIs remain readable without a remote request.

## 0.4.0 - 2026-10-15

### Upgrade

- Stop older Swarm MCP processes before upgrading a shared origin/profile.
  Older versions do not participate in the new credential coordination protocol.
- Unix credential coordination requires `/usr/bin/perl`, its core modules and a
  local filesystem supporting `flock`. Windows uses an operating-system mutex.

### Fixed

- Serialize credential refresh and replacement across local processes, journal
  replacements in the operating-system credential store, and preserve unknown
  refresh outcomes without retrying a potentially consumed proof.
- Supply required native MCP metadata without claiming upstream client identity
  or unsupported capabilities.
- Bound stdio frames by bytes, reject invalid UTF-8 and oversized frames, and
  stop cleanly when protocol output closes or fails.
- Bound response reads and cancellation while preserving remote tool discovery,
  Permit checks, revocation and canonical server authority.

## 0.3.2 - 2026-10-10

- Apply the configured default Space only to tools whose current remote schema accepts a Space ID.
- Keep resource-specific commands, including task updates and Run controls, free of unsupported arguments.
- Preserve paginated tool discovery and reset cached schema information when refreshing the catalog.

## 0.3.1 - 2026-09-28

- Styled native OAuth callback outcomes to match Swarm sign-in, with responsive layout and no external assets.
- Clarified that receiving authorization is a handoff to the app, not proof that token exchange or secure credential storage has completed.
- Retained callback validation and restrictive security headers; inline styles are allowed only by their exact CSP hash.

## 0.3.0

- Added browser-based stdio pairing with PKCE and issuer-bound OAuth responses.
- Added macOS Keychain, Windows Credential Manager, and Linux Secret Service storage.
- Replaced the duplicated local REST tool runtime with a thin bridge to the canonical Permit-filtered remote MCP endpoint.
- Added multi-Space behavior and remote parity for trace, provenance, graph, and checkpoint tools.
- Removed plaintext token configuration.

## 0.2.0

- Added the bounded Swarm API tool catalog and stdio transport.
