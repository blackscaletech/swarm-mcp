# Security

Report suspected vulnerabilities to hello@swarm.services.

Include:

- affected package version
- MCP client and operating system
- reproduction steps
- expected impact
- any relevant Swarm request ID

Do not include bearer tokens, private keys, raw credentials, cookies, or sensitive customer data in the report.

## Supported Versions

Security fixes target the latest published `@blackscaletech/swarm-mcp` release. Upgrade to the latest version before reporting an issue that may already be fixed.

## Token Handling

`SWARM_MCP_TOKEN` is a bearer token. Store it in your MCP client environment or secret store. Rotate or revoke it from Swarm when it is no longer needed.
