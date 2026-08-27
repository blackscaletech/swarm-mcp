# Permission Model

OAuth scopes establish MCP resource and refresh eligibility. They do not authorize Swarm operations.

| Boundary | Authority |
| --- | --- |
| Browser sign-in | Authenticates the human approving setup. |
| OAuth grant | Creates the client Identity, Credential, selected-Space Access Assignments, and effective Permits. |
| Operating-system store | Proves continuity for one local profile; grants no Swarm authority itself. |
| `tools/list` | Filters tool definitions by the client Identity's current effective Permits. |
| `tools/call` | Rechecks Identity, Credential, Permit, Entity, Space, resource, lifecycle, policy, and idempotency. |
| Approval-gated action | Requires the canonical approval and Connection action path. |
| Local `SWARM_SPACE_ID` | Supplies a convenience argument only; it cannot broaden access. |

Default authorization is full Swarm operation access within the Spaces explicitly selected during setup. It does not imply staff access, Entity security administration, billing administration, credential administration, or unrelated Connection authority.

Revoking a Permit takes effect without waiting for the OAuth access token to expire. Disconnecting the client in Swarm revokes its Credential and effective Permits while retaining historical attribution.
