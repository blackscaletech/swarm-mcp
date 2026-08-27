# Threat Model

## Protected assets

- Swarm access and refresh credentials.
- Space, Entity, Run, Artifact, approval, intelligence, trace, and provenance data.
- Provider and Connection credentials that must never reach MCP.
- Correct client Identity lineage and operation attribution.

## Trust boundaries

The browser authenticates the human. The OAuth grant authenticates the MCP client. Permits authorize every Swarm operation. The local credential store protects grant continuity. Retrieved Space content remains untrusted.

The package does not trust MCP client metadata, tool arguments, Space content, model output, local environment labels, or a configured default Space as authority.

## Controls

- Authorization Code + PKCE S256 with random verifier and state.
- Exact protected-resource, issuer, endpoint-origin, loopback host/path/port, and authorization-response issuer validation.
- Short-lived access credentials and rotating refresh credentials.
- Credential material sent to platform stores over stdin, never command arguments.
- No plaintext credential file or token environment-variable fallback.
- Remote HTTPS only, except explicit loopback development.
- Redirect refusal and bounded metadata, request, response, timeout, and stdio limits.
- One refresh operation per process under concurrency and one retry after an authenticated 401.
- Generic local errors; raw credentials, provider responses, and backend diagnostics are never returned.
- Backend Permit, BOLA, lifecycle, policy, budget, approval, idempotency, and rate-limit enforcement on every call.
- Trusted tool metadata remains separate from untrusted tool results.

## Platform notes

macOS uses Keychain generic passwords. Windows uses a generic Credential Manager record through the native Credential API. Linux uses Secret Service through `secret-tool`. If the required facility or executable is missing, startup fails closed and directs the user to remote MCP.

The Windows PowerShell adapter receives the credential on stdin and invokes only the native Credential API. The credential never appears in the PowerShell command arguments. macOS sends a base64-encoded credential through the `security` interactive stdin channel; Linux Secret Service reads the secret from stdin.

## Exclusions

The package does not read browser cookies, personal subscription sessions, `auth.json`, provider API keys, shell history, project files, or third-party transcripts. It does not execute arbitrary HTTP, SQL, shell, provider, or Connection actions.
