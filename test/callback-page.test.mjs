import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { createLoopbackCallback } from "../src/auth/loopback-callback.mjs";

const state = "s".repeat(43);
const issuer = "https://api.example";
const code = "c".repeat(64);

function callbackURL(listener, values) {
  const url = new URL(listener.redirectUri);
  url.search = new URLSearchParams({ iss: issuer, state, ...values }).toString();
  return url;
}

async function assertSafePage(response, expectedTitle) {
  const html = await response.text();
  assert.ok(html.includes(`<h1 id="connection-title">${expectedTitle}</h1>`));
  assert.match(html, /<html lang="en">/);
  assert.match(html, /name="viewport" content="width=device-width, initial-scale=1"/);
  assert.match(html, /class="brand">Swarm/);
  assert.match(html, /name="color-scheme" content="light"/);
  assert.doesNotMatch(html, /Swarm Connect|Local app authorization|class="context"/);
  const css = html.match(/<style>([\s\S]*?)<\/style>/)?.[1];
  assert.ok(css, "Every outcome must include its local styles");
  const styleHash = createHash("sha256").update(css).digest("base64");
  const csp = response.headers.get("content-security-policy");
  assert.ok(csp.includes(`style-src 'sha256-${styleHash}'`));
  for (const directive of ["default-src 'none'", "base-uri 'none'", "form-action 'none'", "frame-ancestors 'none'"]) assert.ok(csp.includes(directive));
  assert.doesNotMatch(csp, /unsafe-inline|unsafe-eval/);
  assert.doesNotMatch(html, /<script\b|<form\b|<link\b|\bsrc=|\bhref=|url\(/i);
  for (const secret of [code, state, issuer, "swa_", "swr_"]) assert.ok(!html.includes(secret));
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(response.headers.get("referrer-policy"), "no-referrer");
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.equal(response.headers.get("x-frame-options"), "DENY");
  assert.equal(response.headers.get("cross-origin-resource-policy"), "same-origin");
  return html;
}

test("valid authorization shows the Swarm handoff page without prematurely claiming connection", async () => {
  const listener = await createLoopbackCallback({ issuer, state });
  const completion = listener.waitForCode();
  try {
    const response = await fetch(callbackURL(listener, { code }));
    assert.equal(response.status, 200);
    const html = await assertSafePage(response, "Authorization received");
    assert.match(html, /Return to your AI app to finish connecting/);
    assert.doesNotMatch(html, /Swarm is connected/);
    assert.equal(await completion, code);
  } finally {
    listener.close();
    await completion.catch(() => {});
  }
});

test("denied authorization uses the same styled page without returning a code", async () => {
  const listener = await createLoopbackCallback({ issuer, state });
  const completion = listener.waitForCode().then(() => assert.fail("denial returned a code"), (error) => error);
  try {
    const response = await fetch(callbackURL(listener, { error: "access_denied" }));
    assert.equal(response.status, 200);
    await assertSafePage(response, "Connection canceled");
    assert.match((await completion).message, /not approved/);
  } finally {
    listener.close();
    await completion;
  }
});

test("invalid callbacks show a fixed error page and cannot consume a valid authorization", async () => {
  const listener = await createLoopbackCallback({ issuer, state });
  const completion = listener.waitForCode();
  try {
    for (const values of [{ code, state: "<script>untrusted</script>" }, { code, iss: "https://other.example" }, { code, extra: "unexpected" }]) {
      const response = await fetch(callbackURL(listener, values));
      assert.equal(response.status, 400);
      const html = await assertSafePage(response, "Unable to verify request");
      assert.doesNotMatch(html, /untrusted|unexpected|other\.example/);
    }
    const response = await fetch(callbackURL(listener, { code }));
    assert.equal(response.status, 200);
    assert.equal(await completion, code);
  } finally {
    listener.close();
    await completion.catch(() => {});
  }
});
