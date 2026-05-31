// Auth proxy for the Telegram bridge widget.
//
// Why this exists: the widget is a static frontend, so it cannot safely hold the
// bridge's provisioning shared secret, and the bridge trusts whatever `user_id`
// it is given. Calling the bridge straight from the browser therefore (a) leaks
// the secret into the JS bundle and (b) lets anyone act as any Matrix user.
//
// This server fixes both. It runs on the SAME origin as the widget and:
//   1. Serves the built static widget (dist/).
//   2. For every /_matrix/provision/* call, requires a Matrix OpenID token
//      (issued by Element via the Widget API), verifies it against the
//      homeserver, and derives the AUTHORITATIVE user_id from it.
//   3. Injects the provisioning secret (held only here, server-side) and the
//      verified ?user_id=, then forwards to the real bridge.
//
// The browser never sees the secret, and a client cannot specify someone else's
// user_id — the proxy overrides it with the verified one. See SECURITY.md.

import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.join(__dirname, 'dist');

// ── Server-only configuration (NEVER prefixed with VITE_, so it is never bundled
//    into the client). ──────────────────────────────────────────────────────────
const PORT                = process.env.PORT || 8080;
const PROVISIONING_SECRET = process.env.PROVISIONING_SECRET;
const BRIDGE_INTERNAL_URL = (process.env.BRIDGE_INTERNAL_URL || '').replace(/\/+$/, '');
const HOMESERVER_NAME     = process.env.HOMESERVER_NAME;
// How long to trust a verified token before re-checking with the homeserver.
const VERIFY_TTL_MS       = Number(process.env.OPENID_VERIFY_TTL_MS || 60_000);

for (const [name, val] of Object.entries({ PROVISIONING_SECRET, BRIDGE_INTERNAL_URL, HOMESERVER_NAME })) {
  if (!val) console.warn(`[proxy] WARNING: ${name} is not set — provisioning calls will fail.`);
}

const app = express();
app.disable('x-powered-by');

// ── OpenID token verification (with a small in-memory cache) ────────────────────
// token -> { sub, exp }
const verifyCache = new Map();

async function verifyOpenIdToken(token, serverName) {
  // Pin the homeserver: never verify a token against an attacker-supplied server.
  if (!token || serverName !== HOMESERVER_NAME) return null;

  const cached = verifyCache.get(token);
  if (cached && cached.exp > Date.now()) return cached.sub;

  try {
    const url = `https://${serverName}/_matrix/federation/v1/openid/userinfo`
      + `?access_token=${encodeURIComponent(token)}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json().catch(() => null);
    const sub = data?.sub;
    if (!sub) return null;
    verifyCache.set(token, { sub, exp: Date.now() + VERIFY_TTL_MS });
    return sub;
  } catch {
    return null;
  }
}

// ── Provisioning proxy ──────────────────────────────────────────────────────────
// Buffer the raw body so it can be forwarded to the bridge byte-for-byte.
app.use('/_matrix/provision', express.raw({ type: '*/*', limit: '2mb' }));

app.all('/_matrix/provision/*', async (req, res) => {
  const auth   = req.get('authorization') || '';
  const token  = auth.startsWith('Bearer ') ? auth.slice('Bearer '.length) : null;
  const server = req.get('x-matrix-server-name');

  const sub = await verifyOpenIdToken(token, server);
  if (!sub) {
    // No proof of identity → no access. This is what blocks impersonation and
    // anonymous browser access in production.
    return res.status(401).json({ error: 'Missing or invalid Matrix OpenID token' });
  }

  // Build the upstream URL: keep the original path + query, but drop any
  // client-supplied user_id and force the verified one.
  const target = new URL(BRIDGE_INTERNAL_URL + req.path);
  for (const [key, value] of Object.entries(req.query)) {
    if (key.toLowerCase() === 'user_id') continue;
    target.searchParams.set(key, Array.isArray(value) ? value[0] : value);
  }
  target.searchParams.set('user_id', sub);

  const headers = { 'Authorization': PROVISIONING_SECRET };
  const hasBody = !['GET', 'HEAD'].includes(req.method) && req.body && req.body.length > 0;
  if (hasBody) headers['Content-Type'] = req.get('content-type') || 'application/json';

  try {
    const upstream = await fetch(target, {
      method: req.method,
      headers,
      body: hasBody ? req.body : undefined,
    });
    const text = await upstream.text();
    res.status(upstream.status);
    const ct = upstream.headers.get('content-type');
    if (ct) res.set('content-type', ct);
    res.send(text);
  } catch {
    res.status(502).json({ error: 'Bridge unreachable' });
  }
});

// ── Static widget + SPA fallback ────────────────────────────────────────────────
app.use(express.static(distDir));
app.get('*', (_req, res) => res.sendFile(path.join(distDir, 'index.html')));

app.listen(PORT, () => {
  console.log(`[proxy] widget + provisioning proxy listening on :${PORT}`);
  console.log(`[proxy] forwarding verified calls to ${BRIDGE_INTERNAL_URL || '(unset)'}`);
});
