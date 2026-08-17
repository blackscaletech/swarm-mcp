import {
  identifier,
  pageProperties,
  readContract
} from "./tool-contracts-common.mjs";

const spaceId = identifier("Swarm Space ID. Uses SWARM_SPACE_ID when omitted.");
const threadId = identifier("Conversation thread ID.");

function spaceRead(contract) {
  return readContract({ ...contract, defaultSpace: true });
}

export const SPACE_READ_TOOL_CONTRACTS = [
  spaceRead({
    name: "swarm_get_space",
    title: "Get Space",
    description: "Read canonical metadata for one authorized Space.",
    path: "/v1/spaces/{spaceId}",
    properties: { space_id: spaceId },
    pathParams: { spaceId: "space_id" }
  }),
  spaceRead({
    name: "swarm_get_conversation",
    title: "Get Space conversation",
    description: "Resolve the primary conversation thread without creating it.",
    path: "/v1/spaces/{spaceId}/conversation",
    properties: { space_id: spaceId },
    pathParams: { spaceId: "space_id" }
  }),
  readContract({
    name: "swarm_list_conversation_entries",
    title: "List conversation entries",
    description: "Read one bounded page of authorized conversation entries.",
    path: "/v1/conversation-threads/{threadId}/entries",
    properties: { thread_id: threadId, ...pageProperties },
    required: ["thread_id"],
    pathParams: { threadId: "thread_id" },
    queryParams: { limit: "limit", cursor: "cursor" }
  }),
  readContract({
    name: "swarm_list_conversation_anchors",
    title: "List anchored discussions",
    description: "Read one bounded page of anchored discussion coordinates.",
    path: "/v1/conversation-threads/{threadId}/anchors",
    properties: { thread_id: threadId, ...pageProperties },
    required: ["thread_id"],
    pathParams: { threadId: "thread_id" },
    queryParams: { limit: "limit", cursor: "cursor" }
  }),
  spaceRead({
    name: "swarm_list_agent_participants",
    title: "List Space agents",
    description: "Read one bounded page of authorized Space agent participants.",
    path: "/v1/spaces/{spaceId}/agent-participants",
    properties: { space_id: spaceId, ...pageProperties },
    pathParams: { spaceId: "space_id" },
    queryParams: { limit: "limit", cursor: "cursor" }
  })
];
