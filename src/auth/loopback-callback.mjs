import { timingSafeEqual } from "node:crypto";
import { createServer } from "node:http";

const CALLBACK_PATH = "/swarm-mcp/callback";
const CALLBACK_TIMEOUT_MS = 5 * 60_000;
const MAX_INVALID_CALLBACKS = 8;

export async function createLoopbackCallback({ issuer, state, timeoutMs = CALLBACK_TIMEOUT_MS }) {
  if (!Number.isInteger(timeoutMs) || timeoutMs < 10_000 || timeoutMs > CALLBACK_TIMEOUT_MS) {
    throw new Error("Browser authorization timeout is invalid");
  }
  let complete;
  let fail;
  let timer;
  const completion = new Promise((resolve, reject) => { complete = resolve; fail = reject; });
  let invalidCallbacks = 0;
  let settled = false;
  const server = createServer({ maxHeaderSize: 8 * 1024, requestTimeout: 10_000 }, (request, response) => {
    const reject = (status) => {
      safePage(response, status, "Swarm connection could not be verified. You may close this tab.");
      invalidCallbacks += 1;
      if (invalidCallbacks >= MAX_INVALID_CALLBACKS) settle(new Error("Swarm could not verify the browser authorization response"));
    };
    if (request.method !== "GET" || !request.url || request.url.length > 4096 || request.headers.host !== new URL(redirectUri).host) return reject(400);
    let callback;
    try {
      callback = new URL(request.url, redirectUri);
    } catch {
      return reject(400);
    }
    if (callback.pathname !== CALLBACK_PATH || callback.origin !== new URL(redirectUri).origin || !exactQuery(callback.searchParams)) return reject(400);
    if (!safeEqual(callback.searchParams.get("state"), state) || callback.searchParams.get("iss") !== issuer) return reject(400);
    if (callback.searchParams.get("error")) {
      safePage(response, 200, "Swarm access was not connected. You may close this tab.");
      settle(new Error("Swarm access was not approved"));
      return;
    }
    const code = callback.searchParams.get("code") || "";
    if (!/^[A-Za-z0-9._~-]{43,512}$/.test(code)) return reject(400);
    safePage(response, 200, "Swarm is connected. You may close this tab.");
    settle(null, code);
  });
  server.keepAliveTimeout = 1_000;
  server.headersTimeout = 10_000;
  server.maxRequestsPerSocket = 2;
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  const redirectUri = `http://127.0.0.1:${address.port}${CALLBACK_PATH}`;
  timer = setTimeout(() => settle(new Error("Browser authorization timed out")), timeoutMs);

  function settle(error, code) {
    if (settled) return;
    settled = true;
    if (timer) clearTimeout(timer);
    server.close();
    if (error) fail(error);
    else complete(code);
  }

  return Object.freeze({
    redirectUri,
    waitForCode: () => completion,
    close: () => settle(new Error("Browser authorization was cancelled"))
  });
}

function exactQuery(values) {
  const keys = Array.from(values.keys());
  const allowed = new Set(values.has("error") ? ["error", "iss", "state"] : ["code", "iss", "state"]);
  return keys.length === allowed.size && keys.every((key) => allowed.has(key) && values.getAll(key).length === 1);
}

function safeEqual(left, right) {
  const leftBuffer = Buffer.from(String(left || ""));
  const rightBuffer = Buffer.from(String(right || ""));
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function safePage(response, status, message) {
  const body = `<!doctype html><html><head><meta charset="utf-8"><meta name="referrer" content="no-referrer"><title>Swarm</title></head><body><main><h1>${message}</h1></main></body></html>`;
  response.writeHead(status, {
    "Cache-Control": "no-store",
    "Content-Security-Policy": "default-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
    "Content-Type": "text/html; charset=utf-8",
    "Cross-Origin-Opener-Policy": "same-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    "Referrer-Policy": "no-referrer",
    "X-Frame-Options": "DENY",
    "X-Content-Type-Options": "nosniff"
  });
  response.end(body);
}
