import { createHash } from "node:crypto";

// Mirrors Swarm's public auth surface without fetching assets during the OAuth callback.
const STYLE = `
:root {
  color-scheme: light;
  --ink: #121923;
  --muted: #3f4c5d;
  --panel: rgba(247, 249, 251, .84);
  --control: rgba(235, 241, 247, .58);
  --background: #fcfdff;
}
* { box-sizing: border-box; }
body {
  margin: 0;
  min-height: 100vh;
  min-height: 100svh;
  display: grid;
  place-items: center;
  padding: 32px 20px;
  color: var(--ink);
  background: radial-gradient(ellipse at 15% 20%, rgba(28, 39, 54, .04), transparent 60%),
    radial-gradient(ellipse at 85% 80%, rgba(24, 53, 45, .035), transparent 60%), var(--background);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
}
.panel {
  width: min(100%, 480px);
  padding: 44px 40px 48px;
  border: 1px solid rgba(18, 25, 35, .058);
  border-radius: 26px;
  background: var(--panel);
  box-shadow: 0 34px 96px rgba(17, 24, 39, .11), inset 0 1px 0 rgba(255, 255, 255, .62);
  -webkit-backdrop-filter: blur(34px) saturate(116%);
  backdrop-filter: blur(34px) saturate(116%);
  text-align: center;
}
.brand { margin: 0 0 36px; font-size: 28px; font-weight: 400; letter-spacing: -.9px; }
.heading { display: flex; align-items: center; justify-content: center; gap: 10px; }
.symbol {
  display: grid;
  place-items: center;
  flex: 0 0 32px;
  height: 32px;
  border-radius: 8px;
  background: var(--control);
  color: var(--muted);
}
.symbol svg { width: 17px; height: 17px; }
h1 { margin: 0; font-size: 24px; line-height: 1.3; font-weight: 500; letter-spacing: -.5px; overflow-wrap: anywhere; }
.message { color: var(--muted); font-size: 15px; line-height: 1.65; max-width: 320px; margin: 16px auto 0; }
@media (max-width: 420px) {
  body { padding: 24px 16px; }
  .panel { border-radius: 24px; padding: 36px 24px 40px; }
  h1 { font-size: 22px; }
}
`;
const STYLE_HASH = createHash("sha256").update(STYLE).digest("base64");
const STATES = Object.freeze({
  received: {
    title: "Authorization received",
    message: "Return to your AI app to finish connecting. You can close this tab.",
    icon: '<path d="m7 12 3 3 7-7"/><path d="M12 3 4 6v6c0 4 8 9 8 9s8-5 8-9V6l-8-3Z"/>'
  },
  canceled: {
    title: "Connection canceled",
    message: "Your app was not connected. Return to your app to try again, or close this tab.",
    icon: '<circle cx="12" cy="12" r="9"/><path d="m9 9 6 6m0-6-6 6"/>'
  },
  failed: {
    title: "Unable to verify request",
    message: "Return to your app and start a new connection. You can close this tab.",
    icon: '<path d="M12 3 4 6v6c0 4 8 9 8 9s8-5 8-9V6l-8-3Z"/><path d="M12 8v5m0 3v.01"/>'
  }
});

export function writeCallbackPage(response, status, state) {
  // Only fixed copy is rendered. Never reflect OAuth query values or error descriptions.
  const page = Object.hasOwn(STATES, state) ? STATES[state] : STATES.failed;
  const body = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="referrer" content="no-referrer">
<meta name="color-scheme" content="light">
<title>${page.title} | Swarm</title>
<style>${STYLE}</style>
</head>
<body>
<main class="panel" aria-labelledby="connection-title">
  <p class="brand">Swarm</p>
  <header class="heading">
    <span class="symbol" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${page.icon}</svg></span>
    <h1 id="connection-title">${page.title}</h1>
  </header>
  <p class="message">${page.message}</p>
</main>
</body>
</html>`;
  response.writeHead(status, {
    "Cache-Control": "no-store",
    "Content-Security-Policy": `default-src 'none'; style-src 'sha256-${STYLE_HASH}'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`,
    "Content-Type": "text/html; charset=utf-8",
    "Cross-Origin-Opener-Policy": "same-origin",
    "Cross-Origin-Resource-Policy": "same-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    "Referrer-Policy": "no-referrer",
    "X-Frame-Options": "DENY",
    "X-Content-Type-Options": "nosniff"
  });
  response.end(body);
}
