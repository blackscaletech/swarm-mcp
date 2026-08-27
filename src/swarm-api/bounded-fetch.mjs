const MAX_JSON_BYTES = 1024 * 1024;

export async function fetchJSONBounded(fetchImpl, url, options = {}, maximumBytes = MAX_JSON_BYTES) {
  let response;
  try {
    response = await fetchImpl(url, { ...options, redirect: "error" });
  } catch {
    throw new Error("Swarm could not be reached");
  }
  const mediaType = String(response.headers?.get?.("content-type") || "").split(";", 1)[0].trim().toLowerCase();
  if (mediaType !== "application/json") throw new Error("Swarm returned an invalid response");
  const body = await readResponseBounded(response, maximumBytes);
  let value;
  try {
    value = body ? JSON.parse(body) : null;
  } catch {
    throw new Error("Swarm returned an invalid response");
  }
  return { response, value };
}

export async function readResponseBounded(response, maximumBytes) {
  const declared = Number(response.headers?.get?.("content-length"));
  if (Number.isFinite(declared) && declared > maximumBytes) throw new Error("Swarm response exceeded the size limit");
  const reader = response.body?.getReader?.();
  if (!reader) {
    const text = await response.text();
    if (Buffer.byteLength(text, "utf8") > maximumBytes) throw new Error("Swarm response exceeded the size limit");
    return text;
  }
  const decoder = new TextDecoder();
  let bytes = 0;
  let text = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) return text + decoder.decode();
    bytes += value.byteLength;
    if (bytes > maximumBytes) {
      await reader.cancel();
      throw new Error("Swarm response exceeded the size limit");
    }
    text += decoder.decode(value, { stream: true });
  }
}

export function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
