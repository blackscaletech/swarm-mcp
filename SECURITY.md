# Security

Report vulnerabilities privately through the repository security advisory flow. Do not include access tokens, refresh tokens, provider credentials, Space content, or customer data in an issue.

Supported releases are listed in published package metadata. Keep Swarm MCP and the matching Swarm API revision aligned.

## Host Runtime

The host supplies Node.js and TLS. Use a supported, security-patched runtime in
production; Node 20 CI is legacy compatibility only. Keep effective CA trust
stores current and do not disable certificate or hostname verification. See the
[October 21, 2026 Node.js security releases](https://nodejs.org/en/blog/vulnerability/october-2026-security-releases)
for the Node 22.23.4 and 24.22.1 fixes.

The package never requests provider credentials and never reads Codex, Claude, browser, shell, or other local authentication stores. Swarm access is stored only through the operating-system credential service. If that service is unavailable, setup fails closed.

Before reporting an authentication problem, revoke the affected app in Swarm. Do not paste credential material into logs, screenshots, prompts, artifacts, or bug reports.
