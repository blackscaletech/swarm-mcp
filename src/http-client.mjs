import { DEFAULT_TIMEOUT_MS, MAX_HTTP_RESPONSE_BYTES } from "./constants.mjs";

const SAFE_ERROR_HEADERS = new Set([
  "content-type",
  "retry-after",
  "x-correlation-id",
  "x-request-id",
  "x-trace-id"
]);

export class SwarmAPIError extends Error {
  constructor(status, headers = {}) {
    super(`Swarm API request failed (${status})`);
    this.name = "SwarmAPIError";
    this.status = status;
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

  async request(method, path, { query, body, signal, idempotencyKey } = {}) {
    const url = new URL(`${this.baseUrl}${path}`);
    appendQuery(url, query);

    const controller = new AbortController();
    const abort = () => controller.abort();
    if (signal?.aborted) {
      controller.abort();
    } else {
      signal?.addEventListener("abort", abort, { once: true });
    }
    const timeout = setTimeout(abort, this.timeoutMs);
    try {
      const response = await this.fetchImpl(url, {
        method,
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${this.token}`,
          Accept: "application/json",
          ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
          ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {})
        },
        body: body !== undefined ? JSON.stringify(body) : undefined
      });
      const text = await readBoundedResponseText(response);
      if (!response.ok) {
        throw new SwarmAPIError(response.status, safeHeaders(response.headers));
      }
      return withPageMetadata(parseJSON(text), response.headers);
    } finally {
      clearTimeout(timeout);
      signal?.removeEventListener("abort", abort);
    }
  }
}

export function pathSegment(value) {
  const normalized = String(value || "").trim();
  if (!normalized) {
    throw new Error("required path parameter is missing");
  }
  return encodeURIComponent(normalized);
}

function appendQuery(url, query = {}) {
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      url.searchParams.set(key, String(value));
    }
  }
}

async function readBoundedResponseText(response) {
  const declaredLength = Number(response.headers?.get?.("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_HTTP_RESPONSE_BYTES) {
    throw new Error("Swarm API response exceeded the local size limit");
  }
  const reader = response.body?.getReader?.();
  if (!reader) {
    const text = await response.text();
    if (Buffer.byteLength(text, "utf8") > MAX_HTTP_RESPONSE_BYTES) {
      throw new Error("Swarm API response exceeded the local size limit");
    }
    return text;
  }
  const decoder = new TextDecoder();
  let bytesRead = 0;
  let text = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      return text + decoder.decode();
    }
    bytesRead += value.byteLength;
    if (bytesRead > MAX_HTTP_RESPONSE_BYTES) {
      await reader.cancel();
      throw new Error("Swarm API response exceeded the local size limit");
    }
    text += decoder.decode(value, { stream: true });
  }
}

function parseJSON(text) {
  if (!text) {
    return {};
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new Error("Swarm returned an invalid response");
  }
}

function withPageMetadata(value, headers) {
  const nextCursor = headers?.get?.("x-next-cursor")?.trim();
  const order = headers?.get?.("x-order")?.trim();
  if (!nextCursor && !order) {
    return value;
  }
  const page = {
    ...(value && !Array.isArray(value) && typeof value.page === "object" ? value.page : {}),
    ...(nextCursor ? { next_cursor: nextCursor } : {}),
    ...(order ? { order } : {})
  };
  if (value && !Array.isArray(value) && typeof value === "object") {
    return { ...value, page };
  }
  return { items: Array.isArray(value) ? value : [], page };
}

function safeHeaders(headers) {
  const result = {};
  for (const [key, value] of headers.entries()) {
    const normalized = key.toLowerCase();
    if (SAFE_ERROR_HEADERS.has(normalized)) {
      result[normalized] = value;
    }
  }
  return result;
}
