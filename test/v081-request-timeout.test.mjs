import assert from "node:assert/strict";
import test from "node:test";
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
