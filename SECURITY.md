# Security

Report vulnerabilities privately through the repository security advisory flow. Do not include access tokens, refresh tokens, provider credentials, Space content, or customer data in an issue.

Supported releases are listed in published package metadata. Keep Swarm MCP and the matching Swarm API revision aligned.

The package never requests provider credentials and never reads Codex, Claude, browser, shell, or other local authentication stores. Swarm access is stored only through the operating-system credential service. If that service is unavailable, setup fails closed.

Before reporting an authentication problem, revoke the affected app in Swarm. Do not paste credential material into logs, screenshots, prompts, artifacts, or bug reports.
