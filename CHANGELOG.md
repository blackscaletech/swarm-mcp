# Changelog

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
