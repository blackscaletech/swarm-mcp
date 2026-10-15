import assert from "node:assert/strict";
import test from "node:test";
import { getEventListeners } from "node:events";
import { fetchJSONBounded } from "../src/swarm-api/bounded-fetch.mjs";
import { withRequestTimeout } from "../src/swarm-api/request-timeout.mjs";

test("network deadlines abort hung operations without retaining timers", async () => {
  const started = Date.now();
  await assert.rejects(withRequestTimeout(20, (signal) => new Promise((_resolve, reject) => {
    signal.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
  })), /aborted/);
  assert.ok(Date.now() - started < 500);
});

test("caller cancellation propagates through the bounded request signal", async () => {
  const parent = new AbortController();
  const pending = withRequestTimeout(5_000, (signal) => new Promise((_resolve, reject) => {
    signal.addEventListener("abort", () => reject(new Error("cancelled")), { once: true });
  }), parent.signal);
  parent.abort();
  await assert.rejects(pending, /cancelled/);
});

test("JSON endpoints reject media-type confusion and oversized bodies", async () => {
  await assert.rejects(fetchJSONBounded(async () => new Response("{}", {
    headers: { "Content-Type": "text/html" }
  }), "https://api.example/mcp"), /invalid response/);
  await assert.rejects(fetchJSONBounded(async () => new Response(JSON.stringify({ value: "x".repeat(64) }), {
    headers: { "Content-Type": "application/json" }
  }), "https://api.example/mcp", {}, 16), /size limit/);
});

test("bounded JSON requests cannot weaken redirect rejection", async () => {
  let observed;
  await fetchJSONBounded(async (_url, options) => {
    observed = options.redirect;
    return new Response("{}", { headers: { "Content-Type": "application/json" } });
  }, "https://api.example/mcp", { redirect: "follow" });
  assert.equal(observed, "error");
});

test("uncooperative fetch and body reads cannot extend the bounded deadline", async () => {
  for (const stage of ["headers", "body"]) {
    let cancelled = 0;
    const parent = new AbortController();
    const body = new ReadableStream({ cancel() { cancelled++; } });
    const response = new Response(body, { headers: { "Content-Type": "application/json" } });
    let finish;
    const late = new Promise(resolve => { finish = resolve; });
    await assert.rejects(withRequestTimeout(10, signal => fetchJSONBounded(
      () => stage === "headers" ? late : response, "https://api.example/mcp", { signal }), parent.signal), /cancelled|could not be reached/);
    if (stage === "headers") { finish(response); await new Promise(resolve => setImmediate(resolve)); }
    assert.equal(cancelled, 1);
    assert.equal(body.locked, false);
    assert.equal(getEventListeners(parent.signal, "abort").length, 0);
  }
});

test("rejected media type and declared oversize release the response", async () => {
  for (const headers of [{ "Content-Type": "text/html" }, { "Content-Type": "application/json", "Content-Length": "100" }]) {
    let cancelled = 0;
    const body = new ReadableStream({ cancel() { cancelled++; } });
    await assert.rejects(fetchJSONBounded(() => new Response(body, { headers }), "https://api.example/mcp", {}, 8));
    assert.equal(cancelled, 1);
    assert.equal(body.locked, false);
  }
});
