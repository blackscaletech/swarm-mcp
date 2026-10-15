const MAX_JSON_BYTES = 1024 * 1024;

export async function fetchJSONBounded(fetchImpl, url, options = {}, maximumBytes = MAX_JSON_BYTES) {
  let response;
  try {
    response = await boundedAwait(async () => {
      const received = await fetchImpl(url, { ...options, redirect: "error" });
      if (options.signal?.aborted) { cancel(received.body); throw new Error("Swarm request was cancelled or timed out"); }
      return received;
    }, options.signal);
  } catch {
    throw new Error("Swarm could not be reached");
  }
  const mediaType = String(response.headers?.get?.("content-type") || "").split(";", 1)[0].trim().toLowerCase();
  if (mediaType !== "application/json") { cancel(response.body); throw new Error("Swarm returned an invalid response"); }
  const body = await readResponseBounded(response, maximumBytes, options.signal);
  let value;
  try {
    value = body ? JSON.parse(body) : null;
  } catch {
    throw new Error("Swarm returned an invalid response");
  }
  return { response, value };
}

export async function readResponseBounded(response, maximumBytes, signal) {
  const declared = Number(response.headers?.get?.("content-length"));
  if (Number.isFinite(declared) && declared > maximumBytes) { cancel(response.body); throw new Error("Swarm response exceeded the size limit"); }
  const reader = response.body?.getReader?.();
  if (!reader) {
    const text = await boundedAwait(() => response.text(), signal);
    if (Buffer.byteLength(text, "utf8") > maximumBytes) throw new Error("Swarm response exceeded the size limit");
    return text;
  }
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let bytes = 0;
  let text = "";
  let finished = false;
  try {
    while (true) {
      const { done, value } = await boundedAwait(() => reader.read(), signal);
      if (done) { finished = true; return text + decoder.decode(); }
      if (!(value instanceof Uint8Array)) throw new Error("Swarm returned an invalid response");
      bytes += value.byteLength;
      if (bytes > maximumBytes) throw new Error("Swarm response exceeded the size limit");
      text += decoder.decode(value, { stream: true });
    }
  } finally {
    if (!finished) cancel(reader);
    try { reader.releaseLock(); } catch { /* A failed custom reader may already be closed. */ }
  }
}

function cancel(body) {
  try { Promise.resolve(body?.cancel()).catch(() => {}); } catch { /* Never wait on an uncooperative cancel. */ }
}

function boundedAwait(operation, signal) {
  if (!signal) return Promise.resolve().then(operation);
  if (signal.aborted) return Promise.reject(new Error("Swarm request was cancelled or timed out"));
  return new Promise((resolve, reject) => {
    const cleanup = () => signal.removeEventListener("abort", abort);
    const abort = () => { cleanup(); reject(new Error("Swarm request was cancelled or timed out")); };
    signal.addEventListener("abort", abort, { once: true });
    Promise.resolve().then(() => {
      if (signal.aborted) throw new Error("Swarm request was cancelled or timed out");
      return operation();
    }).then(value => { cleanup(); resolve(value); }, error => { cleanup(); reject(error); });
  });
}

export function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
