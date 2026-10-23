# MCP Discovery

This repository is the public source for Swarm's MCP discovery metadata. The
hosted server remains at `https://api.swarm.services/mcp`; this repository's
stdio package is a separate compatibility path for clients that require it.

| Surface | Source | Publication |
| --- | --- | --- |
| Official MCP Registry | [`server.json`](../server.json) | Publish with the official `mcp-publisher` CLI using the `blackscaletech` GitHub namespace. |
| Cursor Marketplace | [`.cursor-plugin/plugin.json`](../.cursor-plugin/plugin.json) and [`mcp.json`](../mcp.json) | Submit this public repository to Cursor after testing the OAuth connection. |
| Glama | [`glama.json`](../glama.json) | The public package is already indexed. Claim it with the listed maintainer account; list the hosted connector separately if supported. |

The registry and Cursor manifest versions track their listing changes, not the
npm package or Swarm platform version. Keep all three surfaces pointed at the
canonical HTTPS endpoint. The client discovers OAuth and the user's approved
Spaces during sign-in; no credential, static client secret, Space ID, or
private service detail belongs in these files.

`assets/swarm-logo.png` is a public copy of the reviewed Swarm brand mark used
for directory artwork. Its canonical design source remains in the private
Swarm product; it is not a separate logo to edit here.

Before updating a listing, run `npm test` and `npm pack --dry-run` locally,
check the hosted endpoint's OAuth challenge, and verify the published page.
Do not claim publication or approval from the presence of a manifest alone.
