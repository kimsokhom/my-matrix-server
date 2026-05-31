import { BRIDGE_URL, PROVISIONING_SECRET } from './config.js';

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
// It owns the two cross-cutting concerns that every call needs: the shared
// secret in the Authorization header, and the ?user_id= query param. The
// Matrix user ID can change at runtime (manual entry in a browser), so the
// client reads it fresh on each call via the `getUserId` function it is given.
//
// Every method resolves to { ok, status, data } so the caller keeps its
// existing branching (e.g. the 403 special-case in _checkStatus) unchanged.
export class BridgeClient {
  #getUserId;

  constructor(getUserId) {
    this.#getUserId = getUserId;
  }

  // Append ?user_id=... (or &user_id=...) to a URL.
  #withUser(url) {
    const userId = this.#getUserId();
    if (!userId) return url;
    const sep = url.includes('?') ? '&' : '?';
    return `${url}${sep}user_id=${encodeURIComponent(userId)}`;
  }

  #headers() {
    return {
      'Authorization': PROVISIONING_SECRET,
      'Content-Type': 'application/json',
    };
  }

  // Core request: returns { ok, status, data }. `data` is the parsed JSON body
  // (or {} when the body is missing/invalid), so callers never have to await
  // res.json() themselves. Network failures throw, as with fetch().
  async #request(url, { method = 'GET', body } = {}) {
    const res = await fetch(this.#withUser(url), {
      method,
      headers: this.#headers(),
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
