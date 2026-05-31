# Security model

This document explains how the Telegram Bridge Widget authenticates users and
why it is built the way it is. It is the reference for the project defense.

## The problem with calling the bridge from the browser

The widget drives the mautrix-telegram **provisioning API**. That API trusts two
things on every request:

- `Authorization: <provisioning shared secret>` — a single global secret.
- `?user_id=<@user:server>` — *which* Matrix user the call acts on.

The bridge does **not** independently verify that the caller really is that user.
It was designed to sit behind a trusted server that authenticates users first.

If the widget (a static frontend) calls the bridge directly, two things break:

1. **The secret leaks.** Anything a browser needs at runtime is in the JS bundle.
   `VITE_PROVISIONING_SECRET` would be readable by anyone via DevTools.
2. **Anyone can impersonate anyone.** With the secret in hand, a user can send any
   `user_id` and act as that account — list their contacts, start DMs, disconnect
   them. The old "type your Matrix ID" browser screen had **no authentication at
   all**; even the `?user_id=` URL parameter was attacker-controllable.

The only trustworthy signal is a **Matrix OpenID token**: Element asks the user's
homeserver to issue a short-lived token that proves who they are. The homeserver
vouches for it; a client cannot forge it.

## The fix: a same-origin auth proxy

`server.js` runs on the same origin as the widget and is the only component that
holds the secret. For every `/_matrix/provision/*` request it:

1. Reads the caller's OpenID token (`Authorization: Bearer …` +
   `X-Matrix-Server-Name`), sent by the widget from Element's Widget API.
2. **Verifies** it against the homeserver:
   `GET https://<server>/_matrix/federation/v1/openid/userinfo` → returns the real
   `sub` (the Matrix user ID). It **pins** the homeserver — a token presented for
   any other server name is rejected.
3. **Derives `user_id` from the verified `sub`** and ignores any `user_id` the
   client tried to send.
4. Injects the secret (held only here) and forwards to the bridge.

```
Browser (Element iframe)              Auth proxy (server.js)                Bridge
─ Bearer <OpenID token> ───────►  verify @ homeserver/openid/userinfo
  (no secret, no user_id)         derive user_id = sub  (ignore client user_id)
                                  inject Authorization:<SECRET> + ?user_id=<sub> ──►
```

Result:

- **The secret never reaches the browser.** Verified by grepping `dist/` after a
  build — the secret value is absent (it is `PROVISIONING_SECRET`, *not* a `VITE_`
  variable, so it is never bundled).
- **Impersonation is impossible.** The acting `user_id` is always the verified one;
  a forged or swapped `user_id` has no effect.

## Defense in depth

- **Identity is OpenID-only in production.** The "type your Matrix ID" screen and
  the `localStorage` / URL-param identity paths are **dev-only** (`import.meta.env.DEV`).
  A production build opened outside Element shows an "Open in Element" message — it
  never accepts a typed Matrix ID.
- **No account switcher.** Switching accounts = logging into Element as that
  account; the widget follows automatically via the verified token. There is no
  in-widget way to assume another identity.
- **Same origin.** The proxy serves the widget and the API from one origin, so the
  token is never sent cross-origin and there is no CORS surface.

## Operational requirement (important)

The bridge's provisioning endpoint must be reachable **only through this proxy** —
e.g. over the Railway private network via `BRIDGE_INTERNAL_URL` — and **never
exposed publicly**. If the bridge's provisioning port is public, an attacker who
obtains the secret could call it directly and bypass the proxy entirely.

## Local development

There is no Element host locally to issue OpenID tokens, so dev uses a manually
entered Matrix ID and the Vite dev proxy (`vite.config.js`), which injects the
secret server-side just like `server.js`. The client never holds the secret in dev
either. This path is compiled out of production builds.

## Residual risks / future work

- **Token-cache TTL.** Verified tokens are cached briefly (`OPENID_VERIFY_TTL_MS`,
  default 60s) to avoid hammering the homeserver. A revoked token stays usable for
  at most that window.
- **Rate limiting / audit logging.** Not yet implemented on the proxy; recommended
  before wider production exposure.
- **The bridge still trusts the secret.** Network isolation (above) is what keeps
  that trust safe.
