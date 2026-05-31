import { BRIDGE_URL } from './config.js';

// Provisioning API endpoint paths (mautrix-go bridgev2 contract).
// Login is nested under /login/flows, /login/start/{flow},
// /login/step/{id}/{stepId}/{type}. If the bridge version changes a path,
// this map is the single place to edit.
export const API = {
  WHOAMI:       `${BRIDGE_URL}/_matrix/provision/v3/whoami`,
  LOGIN_FLOWS:  `${BRIDGE_URL}/_matrix/provision/v3/login/flows`,
  LOGIN_START:  (flowId)            => `${BRIDGE_URL}/_matrix/provision/v3/login/start/${encodeURIComponent(flowId)}`,
  LOGIN_STEP:   (id, stepId, type)  => `${BRIDGE_URL}/_matrix/provision/v3/login/step/${encodeURIComponent(id)}/${encodeURIComponent(stepId)}/${type}`,
  LOGIN_CANCEL: (id)                => `${BRIDGE_URL}/_matrix/provision/v3/login/cancel/${encodeURIComponent(id)}`,
  LOGOUT:       (id)                => `${BRIDGE_URL}/_matrix/provision/v3/logout/${encodeURIComponent(id)}`,
  CONTACTS:     `${BRIDGE_URL}/_matrix/provision/v3/contacts`,
  SEARCH:       `${BRIDGE_URL}/_matrix/provision/v3/search_users`,
  RESOLVE:      (q)                 => `${BRIDGE_URL}/_matrix/provision/v3/resolve_identifier/${encodeURIComponent(q)}`,
  CREATE_DM:    (id)                => `${BRIDGE_URL}/_matrix/provision/v3/create_dm/${encodeURIComponent(id)}`,
};

// Thin client over the bridge provisioning API.
//
// Authentication is handled by the same-origin auth proxy (server.js), not by
// this client. The client never holds the provisioning secret. Instead it sends
// the user's Matrix OpenID token as `Authorization: Bearer <token>` (plus the
// server name); the proxy verifies it, derives the real user_id, injects the
// secret, and forwards to the bridge.
//
// It is constructed with two callbacks:
//   getAuth():   async () => { token, server } | null   — OpenID token (Element)
//   getUserId(): ()       => string                     — only used in local dev,
//     where there is no Element host to issue an OpenID token, so the dev Vite
//     proxy (which injects the secret) still needs ?user_id= to know the user.
//     In production the proxy ignores any client user_id and uses the verified one.
//
// Every method resolves to { ok, status, data }.
export class BridgeClient {
  #getAuth;
  #getUserId;

  constructor({ getAuth, getUserId } = {}) {
    this.#getAuth = getAuth ?? (async () => null);
    this.#getUserId = getUserId ?? (() => '');
  }

  // Append ?user_id=... (dev only; harmless in prod — the proxy overrides it).
  #withUser(url) {
    const userId = this.#getUserId();
    if (!userId) return url;
    const sep = url.includes('?') ? '&' : '?';
    return `${url}${sep}user_id=${encodeURIComponent(userId)}`;
  }

  async #headers() {
    const headers = { 'Content-Type': 'application/json' };
    const auth = await this.#getAuth();
    if (auth?.token && auth?.server) {
      headers['Authorization'] = `Bearer ${auth.token}`;
      headers['X-Matrix-Server-Name'] = auth.server;
    }
    return headers;
  }

  // Core request: returns { ok, status, data }. `data` is the parsed JSON body
  // (or {} when the body is missing/invalid), so callers never have to await
  // res.json() themselves. Network failures throw, as with fetch().
  async #request(url, { method = 'GET', body } = {}) {
    const res = await fetch(this.#withUser(url), {
      method,
      headers: await this.#headers(),
      ...(body !== undefined ? { body } : {}),
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data };
  }

  whoami()                 { return this.#request(API.WHOAMI); }
  loginFlows()             { return this.#request(API.LOGIN_FLOWS); }
  startLogin(flowId)       { return this.#request(API.LOGIN_START(flowId), { method: 'POST' }); }

  // type is 'user_input' or 'display_and_wait'; body is a JSON string.
  submitStep(id, stepId, type, body) {
    return this.#request(API.LOGIN_STEP(id, stepId, type), { method: 'POST', body });
  }

  cancelLogin(id)          { return this.#request(API.LOGIN_CANCEL(id), { method: 'POST' }); }
  logout(id)               { return this.#request(API.LOGOUT(id), { method: 'POST' }); }
  contacts()               { return this.#request(API.CONTACTS); }
  search(query)            { return this.#request(API.SEARCH, { method: 'POST', body: JSON.stringify({ query }) }); }
  createDm(identifier)     { return this.#request(API.CREATE_DM(identifier), { method: 'POST' }); }
}
