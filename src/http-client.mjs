import { DEFAULT_TIMEOUT_MS } from "./constants.mjs";

const SAFE_ERROR_HEADERS = new Set([
  "content-type",
  "retry-after",
  "x-correlation-id",
  "x-request-id",
  "x-trace-id"
]);

export class SwarmAPIError extends Error {
  constructor(status, body, headers = {}) {
    super(apiErrorMessage(status, body));
    this.name = "SwarmAPIError";
    this.status = status;
    this.body = body;
    this.headers = headers;
  }
}

export class SwarmAPIClient {
  constructor({ baseUrl, token, fetchImpl = fetch, timeoutMs = DEFAULT_TIMEOUT_MS }) {
    this.baseUrl = String(baseUrl || "").replace(/\/+$/, "");
    this.token = String(token || "").trim();
    this.fetchImpl = fetchImpl;
    this.timeoutMs = timeoutMs;
  }

  list(path, query = {}, options = {}) {
    return this.request("GET", path, { ...options, query });
  }

  get(path, options = {}) {
    return this.request("GET", path, options);
  }

  post(path, body = {}, options = {}) {
    return this.request("POST", path, { ...options, body });
  }

  patch(path, body = {}, options = {}) {
    return this.request("PATCH", path, { ...options, body });
  }

  data(method, path, options = {}) {
    return this.request(method, path, options);
  }

  async request(method, path, { query, body, signal, idempotencyKey } = {}) {
    const url = new URL(`${this.baseUrl}${path}`);
    for (const [key, value] of Object.entries(query || {})) {
      if (value !== undefined && value !== null && String(value).trim() !== "") {
        url.searchParams.set(key, String(value));
      }
    }

    const controller = signal ? null : new AbortController();
    const timeout = controller ? setTimeout(() => controller.abort(), this.timeoutMs) : null;
    try {
      const response = await this.fetchImpl(url, {
        method,
        signal: signal || controller?.signal,
        headers: {
          Authorization: `Bearer ${this.token}`,
          Accept: "application/json",
          ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
          ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {})
        },
        body: body !== undefined ? JSON.stringify(body) : undefined
      });
      const text = await response.text();
      const data = parseJSON(text);
      if (!response.ok) {
        throw new SwarmAPIError(response.status, data, headersObject(response.headers));
      }
      return data;
    } finally {
      if (timeout) {
        clearTimeout(timeout);
      }
    }
  }

  listAgents(query = {}, options = {}) { return this.list("/v1/agents", query, options); }
  listSpaces(query = {}, options = {}) { return this.list("/v1/spaces", query, options); }
  getSpace(spaceId, options = {}) { return this.get(`/v1/spaces/${pathSegment(spaceId)}`, options); }
  listTasks(query = {}, options = {}) { return this.list("/v1/tasks", query, options); }
  getTask(taskId, options = {}) { return this.get(`/v1/tasks/${pathSegment(taskId)}`, options); }
  createTask(input, options = {}) { return this.post("/v1/tasks", input, options); }
  updateTask(taskId, input, options = {}) { return this.patch(`/v1/tasks/${pathSegment(taskId)}`, input, options); }
  cancelTask(taskId, input = {}, options = {}) { return this.post(`/v1/tasks/${pathSegment(taskId)}/cancel`, input, options); }
  listLaunchTemplates(query = {}, options = {}) { return this.list("/v1/launch-templates", query, options); }
  listRuns(query = {}, options = {}) { return this.list("/v1/runs", query, options); }
  launchRun(spaceId, input, options = {}) {
    return this.post(`/v1/spaces/${pathSegment(spaceId)}/launch-run`, input, options);
  }
  launchAndAcquireRun(spaceId, input = {}, options = {}) {
    return this.post(`/v1/spaces/${pathSegment(spaceId)}/launch-run-and-acquire`, input, options);
  }
  getRunContext(runId, options = {}) { return this.get(`/v1/runs/${pathSegment(runId)}/context`, options); }
  startRun(runId, options = {}) { return this.data("POST", `/v1/runs/${pathSegment(runId)}/start`, options); }
  completeRun(runId, input, options = {}) { return this.post(`/v1/runs/${pathSegment(runId)}/complete`, input, options); }
  requestRunStop(runId, input = {}, options = {}) { return this.post(`/v1/runs/${pathSegment(runId)}/stop`, input, options); }
  renewRunLease(leaseId, input, options = {}) { return this.post(`/v1/run-leases/${pathSegment(leaseId)}/renew`, input, options); }
  releaseRunLease(leaseId, options = {}) { return this.data("POST", `/v1/run-leases/${pathSegment(leaseId)}/release`, options); }
  search(query = {}, options = {}) { return this.list("/v1/search", query, options); }
  searchPublic(query = {}, options = {}) { return this.list("/v1/search/public", query, options); }
  listAuditEvents(query = {}, options = {}) { return this.list("/v1/audit-events", query, options); }
  getArtifactContent(artifactId, options = {}) { return this.get(`/v1/artifacts/${pathSegment(artifactId)}/content`, options); }
  createArtifact(input, options = {}) { return this.post("/v1/artifacts", input, options); }
  createEvaluation(input, options = {}) { return this.post("/v1/evaluations", input, options); }
  createTokenUsageEvent(input, options = {}) { return this.post("/v1/token-usage-events", input, options); }
  createAgentActionTrace(input, options = {}) { return this.post("/v1/agent-action-traces", input, options); }
  createAgentCapabilityManifest(input, options = {}) { return this.post("/v1/agent-capability-manifests", input, options); }
  listAgentCapabilityManifests(query = {}, options = {}) { return this.list("/v1/agent-capability-manifests", query, options); }
  updateAgentCapabilityManifest(manifestId, input, options = {}) {
    return this.post(`/v1/agent-capability-manifests/${pathSegment(manifestId)}/update`, input, options);
  }
  heartbeatAgent(agentId, input = {}, options = {}) { return this.post(`/v1/agents/${pathSegment(agentId)}/heartbeat`, input, options); }
  listAgentPresence(query = {}, options = {}) { return this.list("/v1/agent-presence", query, options); }
  acquireNextRun(agentId, input, options = {}) { return this.post(`/v1/agents/${pathSegment(agentId)}/acquire-next-run`, input, options); }
  listRuntimeReceipts(query = {}, options = {}) { return this.list("/v1/runtime-receipts", query, options); }
  verifyRuntimeReceipt(receiptId, options = {}) { return this.post("/v1/runtime-receipts/verify", { receipt_id: receiptId }, options); }
  listBudgetAccounts(query = {}, options = {}) { return this.list("/v1/budget-accounts", query, options); }
  listBudgetLedgerEntries(query = {}, options = {}) { return this.list("/v1/budget-ledger-entries", query, options); }
  listBudgetDelegations(query = {}, options = {}) { return this.list("/v1/budget-delegations", query, options); }
  createBudgetDelegation(input, options = {}) { return this.post("/v1/budget-delegations", input, options); }
  consumeBudgetDelegation(delegationId, input, options = {}) {
    return this.post(`/v1/budget-delegations/${pathSegment(delegationId)}/consume`, input, options);
  }
  revokeBudgetDelegation(delegationId, input = {}, options = {}) {
    return this.post(`/v1/budget-delegations/${pathSegment(delegationId)}/revoke`, input, options);
  }
  listApprovalRequests(query = {}, options = {}) { return this.list("/v1/approval-requests", query, options); }
  createApprovalRequest(input, options = {}) { return this.post("/v1/approval-requests", input, options); }
  approveApprovalRequest(requestId, input = {}, options = {}) {
    return this.post(`/v1/approval-requests/${pathSegment(requestId)}/approve`, input, options);
  }
  rejectApprovalRequest(requestId, input = {}, options = {}) {
    return this.post(`/v1/approval-requests/${pathSegment(requestId)}/reject`, input, options);
  }
  listSpaceDirectoryEntries(query = {}, options = {}) { return this.list("/v1/directory/spaces", query, options); }
  listAgentDirectoryEntries(query = {}, options = {}) { return this.list("/v1/directory/agents", query, options); }
  getSpaceOperatorSummary(spaceId, options = {}) { return this.get(`/v1/operator/spaces/${pathSegment(spaceId)}/summary`, options); }
  listSpaceOperatorActivity(spaceId, query = {}, options = {}) {
    return this.list(`/v1/operator/spaces/${pathSegment(spaceId)}/activity`, query, options);
  }
  listSpaceOperatorPresenceEntries(spaceId, query = {}, options = {}) {
    return this.list(`/v1/operator/spaces/${pathSegment(spaceId)}/presence`, query, options);
  }
  listSpaceSignedStatusEntries(spaceId, query = {}, options = {}) {
    return this.list(`/v1/operator/spaces/${pathSegment(spaceId)}/signed-status`, query, options);
  }
  askSpace(spaceId, input = {}, options = {}) { return this.post(`/v1/spaces/${pathSegment(spaceId)}/ask`, input, options); }
  buildSpaceContextPack(spaceId, input = {}, options = {}) {
    return this.post(`/v1/spaces/${pathSegment(spaceId)}/context-pack`, input, options);
  }
  askConnectedChatSpace(input = {}, options = {}) { return this.post("/v1/chat/ask", input, options); }
  buildConnectedChatContextPack(input = {}, options = {}) { return this.post("/v1/chat/context-pack", input, options); }
  createConnectedChatSessionDigest(input = {}, options = {}) { return this.post("/v1/chat/session-digest", input, options); }
  listSpaceAnswers(spaceId, query = {}, options = {}) { return this.list(`/v1/spaces/${pathSegment(spaceId)}/answers`, query, options); }
  getSpaceAnswer(spaceId, answerId, options = {}) {
    return this.get(`/v1/spaces/${pathSegment(spaceId)}/answers/${pathSegment(answerId)}`, options);
  }
  getSpaceAnswerContract(spaceId, options = {}) { return this.get(`/v1/spaces/${pathSegment(spaceId)}/answer-contract`, options); }
  getSpaceWorkContract(spaceId, options = {}) { return this.get(`/v1/spaces/${pathSegment(spaceId)}/work-contract`, options); }
  listSpaceCapabilities(spaceId, options = {}) { return this.get(`/v1/spaces/${pathSegment(spaceId)}/capabilities`, options); }
  getSpaceOperationContract(spaceId, operationKind, options = {}) {
    return this.get(`/v1/spaces/${pathSegment(spaceId)}/operation-contracts/${pathSegment(operationKind)}`, options);
  }
  listSpaceIntelligenceOperations(spaceId, query = {}, options = {}) {
    return this.list(`/v1/spaces/${pathSegment(spaceId)}/operations`, query, options);
  }
  createSpaceIntelligenceOperation(spaceId, input = {}, options = {}) {
    return this.post(`/v1/spaces/${pathSegment(spaceId)}/operations`, input, options);
  }
  getSpaceIntelligenceOperation(spaceId, operationId, options = {}) {
    return this.get(`/v1/spaces/${pathSegment(spaceId)}/operations/${pathSegment(operationId)}`, options);
  }
  cancelQueuedSpaceIntelligenceOperation(spaceId, operationId, input = {}, options = {}) {
    return this.post(`/v1/spaces/${pathSegment(spaceId)}/operations/${pathSegment(operationId)}/cancel`, input, options);
  }
  startSpaceIntelligenceOperation(spaceId, operationId, input = {}, options = {}) {
    return this.post(`/v1/spaces/${pathSegment(spaceId)}/operations/${pathSegment(operationId)}/start`, input, options);
  }
  completeSpaceIntelligenceOperation(spaceId, operationId, input = {}, options = {}) {
    return this.post(`/v1/spaces/${pathSegment(spaceId)}/operations/${pathSegment(operationId)}/complete`, input, options);
  }
  failSpaceIntelligenceOperation(spaceId, operationId, input = {}, options = {}) {
    return this.post(`/v1/spaces/${pathSegment(spaceId)}/operations/${pathSegment(operationId)}/fail`, input, options);
  }
  getSpaceDecisionGraph(spaceId, options = {}) { return this.get(`/v1/spaces/${pathSegment(spaceId)}/decision-graph`, options); }
  listSpaceLearningCandidates(spaceId, query = {}, options = {}) {
    return this.list(`/v1/spaces/${pathSegment(spaceId)}/learning-candidates`, query, options);
  }
  listSpacePromotionGates(spaceId, query = {}, options = {}) {
    return this.list(`/v1/spaces/${pathSegment(spaceId)}/promotion-gates`, query, options);
  }
  listSpaceIntelligenceProjections(spaceId, query = {}, options = {}) {
    return this.list(`/v1/spaces/${pathSegment(spaceId)}/projections`, query, options);
  }
  listSpaceLearningQueueItems(spaceId, query = {}, options = {}) {
    return this.list(`/v1/spaces/${pathSegment(spaceId)}/learning-queue`, query, options);
  }
  claimSpaceLearningQueueItem(spaceId, input = {}, options = {}) {
    return this.post(`/v1/spaces/${pathSegment(spaceId)}/learning-queue/claim`, input, options);
  }
  submitSpaceLearningQueueResult(spaceId, itemId, input = {}, options = {}) {
    return this.post(`/v1/spaces/${pathSegment(spaceId)}/learning-queue/${pathSegment(itemId)}/result`, input, options);
  }
  getSpaceLearningFrontier(spaceId, options = {}) { return this.get(`/v1/spaces/${pathSegment(spaceId)}/learning-frontier`, options); }
}

export function pathSegment(value) {
  const normalized = String(value || "").trim();
  if (!normalized) {
    throw new Error("path segment is required");
  }
  return encodeURIComponent(normalized);
}

function parseJSON(text) {
  if (!text) {
    return null;
  }
  try {
    return JSON.parse(text);
  } catch {
    return { error: "Swarm returned a non-JSON response" };
  }
}

function apiErrorMessage(status, data) {
  const message = typeof data?.error === "string" ? data.error : "Swarm API request failed";
  return `${message} (${status})`;
}

function headersObject(headers) {
  const result = {};
  for (const [key, value] of headers.entries()) {
    const normalized = key.toLowerCase();
    if (SAFE_ERROR_HEADERS.has(normalized)) {
      result[normalized] = value;
    }
  }
  return result;
}
