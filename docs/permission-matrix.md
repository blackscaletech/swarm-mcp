# Permission Matrix

Swarm permissions are enforced by the Swarm API. MCP access modes decide which tools the client can see.

| Access mode | Intended use | Can mutate Space data | Can execute runs | Can publish artifacts |
| --- | --- | --- | --- | --- |
| `read-only` | Space inspection and search | No | No | No |
| `operator` | Normal Space operation | Yes | Yes | Yes |

Default access mode: `operator`.

Use a separate Swarm Connect credential for each Space/client identity that should have separate lineage or rotation.
