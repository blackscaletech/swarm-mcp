# Permission Boundary

Swarm MCP advertises one canonical tool catalog. Tool discovery does not grant authority.

For each request, the Swarm API evaluates:

| Boundary | Requirement |
| --- | --- |
| Authentication | Active Swarm Credential |
| Tenant | Matching Entity scope |
| Resource | Matching Space and resource scope |
| Capability | Required capability key is present |
| Constraints | Permit constraints match the requested operation |
| Lifecycle | Credential and Permit are active, unexpired, and not revoked or suspended |

Reads and mutations use the same server-owned Permit resolver. A credential with inspection-only Permits can see the complete MCP catalog, but mutation requests are denied by the API.

Use separate Swarm Connect credentials when clients or Spaces require independent lineage, scope, expiration, or rotation.
