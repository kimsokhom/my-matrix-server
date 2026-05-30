import { LitElement, html, css } from 'lit';
import * as MatrixWidget from 'matrix-widget-api';
import QRCode from 'qrcode';

// In dev, leave VITE_BRIDGE_URL empty so paths are relative — Vite proxy forwards them.
// In production, set VITE_BRIDGE_URL to the full Railway URL.
const BRIDGE_URL = import.meta.env.VITE_BRIDGE_URL ?? '';
const PROVISIONING_SECRET = import.meta.env.VITE_PROVISIONING_SECRET;

// Provisioning API endpoint paths (mautrix-go bridgev2 contract).
// Login is nested under /login/flows, /login/start/{flow}, /login/step/{id}/{stepId}/{type}.
const API = {
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

const VIEWS = { HOME: 'home', LOGIN: 'login', CHATS: 'chats', SEARCH: 'search' };

export class TelegramBridgeWidget extends LitElement {

  static properties = {
    view:           { type: String },
    status:         { type: String },   // 'checking' | 'connected' | 'disconnected' | 'error'
    telegramUser:   { type: Object },
    loginFlows:     { type: Array },    // available flows from GET /login/flows
    loginProcessId: { type: String },   // login_id returned by /login/start
    loginStep:      { type: Object },   // current step object from the API
    stepInputs:     { type: Object },   // { fieldId: value } for the current user_input step
    qrDataUrl:      { type: String },   // rendered QR image for display_and_wait steps
    chats:          { type: Array },
    searchQuery:    { type: String },
    searchResults:  { type: Array },
    isLoading:      { type: Boolean },
    notification:   { type: Object },
    _needsUserId:   { type: Boolean },
    _manualUserId:  { type: String },
    _confirmingLogout: { type: Boolean },
  };

  constructor() {
    super();
    this.view = VIEWS.HOME;
    this.status = 'checking';
    this.telegramUser = null;
    this.loginFlows = null;
    this.loginProcessId = null;
    this.loginStep = null;
    this.stepInputs = {};
    this.qrDataUrl = '';
    this.chats = [];
    this.searchQuery = '';
    this.searchResults = [];
    this.isLoading = false;
    this.notification = { message: '', type: '' };
    this._matrixUserId = '';
    this._statusError = '';
    this._needsUserId = false;
    this._manualUserId = '';
    this._confirmingLogout = false;

    // Resolves true when Element Web completes the widget handshake, false on timeout.
    // We must wait for 'ready' before calling requestOpenIDConnectToken().
    this._widgetApiReady = new Promise((resolve) => {
      try {
        this.widgetApi = new MatrixWidget.WidgetApi();
        this.widgetApi.once('ready', () => resolve(true));
        // Ask Element for permission to open matrix.to links from inside the widget.
        try { this.widgetApi.requestCapability(MatrixWidget.MatrixCapabilities.MSC2931Navigate); } catch { /* ignore */ }
        this.widgetApi.start();
        setTimeout(() => resolve(false), 2000); // not in Element Web
      } catch {
        resolve(false);
      }
    });
  }

  async firstUpdated() {
    this._matrixUserId = await this._resolveUserId();
    if (!this._matrixUserId) {
      this._needsUserId = true;
      this.status = 'disconnected';
      return;
    }
    await this._checkStatus();
  }

  // Resolves the Matrix user ID from four sources in priority order:
  // 1. ?user_id= URL param  (Element Web template substitution)
  // 2. Widget API OpenID    (waits for 'ready' event — works when embedded in Element Web)
  // 3. localStorage         (persisted from a previous manual entry — works for any browser user)
  // 4. VITE_MATRIX_USER_ID (dev-only build-time fallback)
  async _resolveUserId() {
    const fromUrl = new URLSearchParams(location.search).get('user_id');
    if (fromUrl) return fromUrl;

    // Wait for the Widget API handshake before requesting OpenID token.
    // Without waiting, this always fails with "Not ready or unknown widget ID".
    const ready = await this._widgetApiReady;
    if (ready) {
      try {
        const token = await this.widgetApi.requestOpenIDConnectToken();
        if (token?.access_token && token?.matrix_server_name) {
          const res = await fetch(
            `https://${token.matrix_server_name}/_matrix/federation/v1/openid/userinfo?access_token=${token.access_token}`
          );
          if (res.ok) {
            const { sub } = await res.json();
            if (sub) return sub;
          }
        }
      } catch { /* OpenID failed — fall through */ }
    }

    const saved = localStorage.getItem('telegram_widget_user_id');
    if (saved) return saved;

    return import.meta.env.VITE_MATRIX_USER_ID ?? '';
  }

  async _confirmUserId() {
    const id = this._manualUserId.trim();
    if (!id.startsWith('@') || !id.includes(':')) {
      this._showNotification('Enter a valid Matrix ID like @user:server.com', 'error');
      return;
    }
    localStorage.setItem('telegram_widget_user_id', id);
    this._matrixUserId = id;
    this._needsUserId = false;
    await this._checkStatus();
  }

  // Appends ?user_id=... to a provisioning API URL.
  _u(url) {
    if (!this._matrixUserId) return url;
    const sep = url.includes('?') ? '&' : '?';
    return `${url}${sep}user_id=${encodeURIComponent(this._matrixUserId)}`;
  }

  // ─── API helpers ────────────────────────────────────────────────────────────

  _authHeaders() {
    return {
      'Authorization': PROVISIONING_SECRET,
      'Content-Type': 'application/json',
    };
  }

  async _checkStatus() {
    this.status = 'checking';
    this._statusError = '';
    try {
      const res = await fetch(this._u(API.WHOAMI), { headers: this._authHeaders() });
      if (res.status === 403) {
        this._statusError = '403 — Wrong provisioning secret or missing user ID.';
        this.status = 'error'; return;
      }
      if (!res.ok) {
        this._statusError = `Bridge returned ${res.status}.`;
        this.status = 'error'; return;
      }
      const data = await res.json();
      // bridgev2 whoami returns a `logins` array. One or more entries = connected.
      const login = data.logins?.[0];
      if (login) {
        this.telegramUser = {
          full_name: login.profile?.name ?? login.name,
          phone:     login.profile?.phone,
          avatar:    login.profile?.avatar,
          login_id:  login.id,            // needed to log out: POST /logout/{id}
        };
        this.status = 'connected';
      } else {
        this.telegramUser = null;
        this.status = 'disconnected';
      }
    } catch {
      this._statusError = 'Could not reach the bridge. Check VITE_BRIDGE_URL.';
      this.status = 'error';
    }
  }

  // Open the login view and load the available flows (phone / QR / bot token).
  async _startLogin() {
    this.isLoading = true;
    this.loginFlows = null;
    this.loginStep = null;
    this.loginProcessId = null;
    this.view = VIEWS.LOGIN;
    try {
      const res = await fetch(this._u(API.LOGIN_FLOWS), { headers: this._authHeaders() });
      if (!res.ok) {
        this._showNotification(`Bridge returned ${res.status} on GET /login/flows`, 'error');
        this.view = VIEWS.HOME;
        return;
      }
      const data = await res.json();
      this.loginFlows = data.flows ?? [];
    } catch {
      this._showNotification('Could not reach the bridge. Check VITE_BRIDGE_URL.', 'error');
      this.view = VIEWS.HOME;
    } finally {
      this.isLoading = false;
    }
  }

  // Start one chosen flow: POST /login/start/{flowId} → first step.
  async _beginFlow(flowId) {
    this.isLoading = true;
    try {
      const res = await fetch(this._u(API.LOGIN_START(flowId)), {
        method: 'POST',
        headers: this._authHeaders(),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        this._showNotification(err.error ?? `Failed to start login (${res.status})`, 'error');
        return;
      }
      await this._advance(await res.json());
    } catch {
      this._showNotification('Connection failed', 'error');
    } finally {
      this.isLoading = false;
    }
  }

  // Route a step object by its `type`. This is the generic engine that replaces
  // the old hardcoded phone/code/2FA wizard, so every flow works the same way.
  async _advance(step) {
    this.loginProcessId = step.login_id ?? this.loginProcessId;
    this.loginStep = step;
    this.stepInputs = {};
    this.qrDataUrl = '';

    if (step.type === 'complete') return this._finishLogin();
    if (step.type === 'display_and_wait') {
      if (step.display_and_wait?.type === 'qr' && step.display_and_wait?.data) {
        try { this.qrDataUrl = await QRCode.toDataURL(step.display_and_wait.data); } catch { /* show link instead */ }
      }
      this._waitStep(step);   // long-poll until the user scans / confirms
    }
    // user_input and cookies just render and wait for the user
  }

  // Submit a user_input step: body is { fieldId: value, ... }.
  async _submitUserInput() {
    this.isLoading = true;
    try {
      const url = API.LOGIN_STEP(this.loginProcessId, this.loginStep.step_id, 'user_input');
      const res = await fetch(this._u(url), {
        method: 'POST',
        headers: this._authHeaders(),
        body: JSON.stringify(this.stepInputs),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        this._showNotification(err.error ?? 'Invalid input — try again', 'error');
        return;
      }
      await this._advance(await res.json());
    } catch {
      this._showNotification('Connection failed', 'error');
    } finally {
      this.isLoading = false;
    }
  }

  // Acknowledge a display_and_wait step (empty body). The bridge holds the request
  // open until the QR is scanned, then returns the next step. QR tokens expire, so
  // if the bridge hands back another display_and_wait we simply wait again.
  async _waitStep(step) {
    const processId = this.loginProcessId;   // capture so a cancel can stop the loop
    try {
      const url = API.LOGIN_STEP(processId, step.step_id, 'display_and_wait');
      const res = await fetch(this._u(url), {
        method: 'POST',
        headers: this._authHeaders(),
        body: '{}',
      });
      // The user cancelled (or moved on) while we were waiting — stop quietly.
      if (this.loginProcessId !== processId) return;
      if (!res.ok) {
        // A timeout/refresh is normal for a long-poll — retry after a short pause.
        if (this.loginStep?.type === 'display_and_wait') {
          setTimeout(() => {
            if (this.loginProcessId === processId && this.loginStep?.type === 'display_and_wait') {
              this._waitStep(this.loginStep);
            }
          }, 1500);
        }
        return;
      }
      await this._advance(await res.json());
    } catch {
      if (this.loginProcessId === processId) this._showNotification('Login timed out — try again', 'error');
    }
  }

  _finishLogin() {
    this.loginFlows = null;
    this.loginProcessId = null;
    this.loginStep = null;
    this.stepInputs = {};
    this.qrDataUrl = '';
    this._showNotification('Telegram connected!', 'success');
    this.view = VIEWS.HOME;
    this._checkStatus();
  }

  // Open the in-widget confirm dialog. We can't use window.confirm() because
  // Element runs the widget in a sandboxed iframe that blocks native modals.
  _logout() {
    this._confirmingLogout = true;
  }

  _dismissLogout() {
    this._confirmingLogout = false;
  }

  async _doLogout() {
    this.isLoading = true;
    try {
      const id = this.telegramUser?.login_id ?? 'all';
      const res = await fetch(this._u(API.LOGOUT(id)), { method: 'POST', headers: this._authHeaders() });
      if (!res.ok) { this._showNotification(`Logout failed (${res.status})`, 'error'); return; }
      this.telegramUser = null;
      this.status = 'disconnected';
      this._showNotification('Disconnected from Telegram', 'success');
    } catch {
      this._showNotification('Logout failed', 'error');
    } finally {
      this.isLoading = false;
      this._confirmingLogout = false;
    }
  }

  async _fetchChats() {
    this.isLoading = true;
    this.chats = [];
    try {
      const res = await fetch(this._u(API.CONTACTS), { headers: this._authHeaders() });
      if (!res.ok) { this._showNotification('Failed to load chats', 'error'); return; }
      const data = await res.json();
      this.chats = data.contacts ?? [];
    } catch {
      this._showNotification('Connection failed', 'error');
    } finally {
      this.isLoading = false;
    }
  }

  async _searchUser() {
    if (!this.searchQuery.trim()) return;
    this.isLoading = true;
    this.searchResults = [];
    try {
      // search_users does a network-side search by free-text query.
      const res = await fetch(this._u(API.SEARCH), {
        method: 'POST',
        headers: this._authHeaders(),
        body: JSON.stringify({ query: this.searchQuery.trim() }),
      });
      if (!res.ok) { this._showNotification('Search failed', 'error'); return; }
      const data = await res.json();
      // bridgev2 returns { results: [...] }.
      const list = data.results ?? data.contacts ?? data.users ?? [];
      if (!list.length) { this._showNotification('No user found', 'error'); return; }
      this.searchResults = list;
    } catch {
      this._showNotification('Connection failed', 'error');
    } finally {
      this.isLoading = false;
    }
  }

  async _startDM(identifier) {
    this.isLoading = true;
    try {
      const res = await fetch(this._u(API.CREATE_DM(identifier)), {
        method: 'POST',
        headers: this._authHeaders(),
      });
      if (!res.ok) { this._showNotification('Failed to open chat', 'error'); return; }
      const data = await res.json().catch(() => ({}));
      const roomId = data.dm_room_mxid ?? data.room_id ?? data.room_mxid ?? data.mxid;
      this._showNotification('Chat opened in Matrix!', 'success');
      this.searchQuery = '';
      this.searchResults = [];
      // Jump straight to the room (works in Element via the widget API, and in a browser tab).
      if (roomId) this._openMatrixTo(`https://matrix.to/#/${roomId}`);
    } catch {
      this._showNotification('Connection failed', 'error');
    } finally {
      this.isLoading = false;
    }
  }

  // Open a matrix.to link safely in both contexts: ask Element to navigate when
  // embedded (window.open is blocked in its sandbox), else open a normal browser tab.
  async _openMatrixTo(uri) {
    const inElement = await this._widgetApiReady;
    if (inElement) {
      try { await this.widgetApi.navigateTo(uri); return; } catch { /* fall through */ }
    }
    try { window.open(uri, '_blank', 'noopener'); } catch { /* ignore */ }
  }

  // ─── Login step helpers ─────────────────────────────────────────────────────

  // Pick a sensible <input> type for a bridgev2 login field type.
  _inputTypeFor(fieldType) {
    switch (fieldType) {
      case 'phone_number': return 'tel';
      case 'password':     return 'password';
      case 'email':        return 'email';
      case '2fa_code':
      case 'code':         return 'text';   // numeric, but kept as text for flexibility
      default:             return 'text';
    }
  }

  _setStepInput(fieldId, value) {
    this.stepInputs = { ...this.stepInputs, [fieldId]: value };
  }

  // True once every visible field has a non-empty value.
  _stepReady() {
    const fields = this.loginStep?.user_input?.fields ?? [];
    return fields.every(f => (this.stepInputs[f.id] ?? '').trim().length > 0);
  }

  async _cancelLogin() {
    if (this.loginProcessId) {
      try {
        await fetch(this._u(API.LOGIN_CANCEL(this.loginProcessId)), {
          method: 'POST',
          headers: this._authHeaders(),
        });
      } catch { /* best-effort cancel */ }
    }
    this.loginFlows = null;
    this.loginProcessId = null;
    this.loginStep = null;
    this.stepInputs = {};
    this.qrDataUrl = '';
    this.view = VIEWS.HOME;
  }

  // ─── Notification ───────────────────────────────────────────────────────────

  _showNotification(message, type) {
    this.notification = { message, type };
    setTimeout(() => { this.notification = { message: '', type: '' }; }, 4000);
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  render() {
    return html`
      <div class="container">

        <header class="header">
          <div class="header-row">
            <div class="brand">
              <span class="brand-icon">✈</span>
              <h1>Telegram Bridge</h1>
            </div>
            ${this.view !== VIEWS.HOME ? html`
              <button class="btn-back" @click=${() => { this.view = VIEWS.HOME; }}>← Back</button>
            ` : ''}
          </div>
          ${this._renderStatusBadge()}
        </header>

        ${this.notification.message ? html`
          <div class="notification ${this.notification.type}">${this.notification.message}</div>
        ` : ''}

        <main>
          ${this._needsUserId         ? this._renderUserIdPrompt() :
            this.view === VIEWS.HOME  ? this._renderHome()   :
            this.view === VIEWS.LOGIN ? this._renderLogin()  :
            this.view === VIEWS.CHATS ? this._renderChats()  :
                                        this._renderSearch()}
        </main>

        ${this._confirmingLogout ? this._renderLogoutConfirm() : ''}

      </div>
    `;
  }

  // In-widget confirm dialog (replaces window.confirm, which Element's sandbox blocks).
  _renderLogoutConfirm() {
    return html`
      <div class="modal-overlay" @click=${this._dismissLogout}>
        <div class="modal-card" @click=${e => e.stopPropagation()}>
          <h2>Disconnect Telegram?</h2>
          <p class="welcome-desc">
            This will unlink your Telegram account from the bridge.
            You will need to log in again to use it.
          </p>
          <div class="modal-actions">
            <button class="btn-secondary" @click=${this._dismissLogout} ?disabled=${this.isLoading}>
              Cancel
            </button>
            <button class="btn-danger" @click=${this._doLogout} ?disabled=${this.isLoading}>
              ${this.isLoading ? html`<span class="spinner"></span>` : 'Disconnect'}
            </button>
          </div>
        </div>
      </div>
    `;
  }

  _renderStatusBadge() {
    const map = {
      checking:     { cls: 'checking',     label: 'Checking…' },
      connected:    { cls: 'connected',    label: this.telegramUser?.full_name ?? 'Connected' },
      disconnected: { cls: 'disconnected', label: 'Not connected' },
      error:        { cls: 'error',        label: 'Bridge error' },
    };
    const { cls, label } = map[this.status] ?? map.error;
    return html`
      <div class="status-badge ${cls}">
        <span class="status-dot"></span>${label}
      </div>
    `;
  }

  // ─── Matrix ID prompt (browser direct access) ───────────────────────────────

  _renderUserIdPrompt() {
    return html`
      <div class="card center-card">
        <div class="welcome-icon">✈</div>
        <h2>Enter Your Matrix ID</h2>
        <p class="welcome-desc">
          Could not detect your Matrix account automatically.<br>
          Enter your Matrix ID to connect to the bridge.
        </p>
        <div class="form-group">
          <label>Matrix ID</label>
          <input type="text" placeholder="@user:matrix.example.com"
            .value=${this._manualUserId}
            @input=${e => this._manualUserId = e.target.value}
            @keydown=${e => e.key === 'Enter' && this._confirmUserId()} />
          <p class="field-hint">Format: @username:server.com</p>
        </div>
        <button class="btn-primary full-width"
          @click=${this._confirmUserId}
          ?disabled=${!this._manualUserId.trim()}>
          Continue →
        </button>
      </div>
    `;
  }

  // ─── Home view ───────────────────────────────────────────────────────────────

  _renderHome() {
    if (this.status === 'checking') {
      return html`
        <div class="card center-card">
          <span class="spinner-lg"></span>
          <p class="muted">Connecting to bridge…</p>
        </div>
      `;
    }

    if (this.status === 'connected') {
      const initial = (this.telegramUser?.full_name ?? 'T')[0].toUpperCase();
      return html`
        <div class="card profile-card">
          <div class="avatar">${initial}</div>
          <div class="profile-info">
            <p class="profile-name">${this.telegramUser?.full_name ?? 'Telegram User'}</p>
            ${this.telegramUser?.phone ? html`<p class="profile-sub">${this.telegramUser.phone}</p>` : ''}
          </div>
        </div>

        <div class="action-grid">
          <button class="action-btn"
            @click=${() => { this.view = VIEWS.CHATS; this._fetchChats(); }}>
            <span class="action-icon">💬</span>
            <span>My Chats</span>
          </button>
          <button class="action-btn"
            @click=${() => { this.view = VIEWS.SEARCH; this.searchQuery = ''; this.searchResults = []; }}>
            <span class="action-icon">🔍</span>
            <span>Find User</span>
          </button>
          <button class="action-btn action-btn--danger"
            @click=${this._logout} ?disabled=${this.isLoading}>
            <span class="action-icon">🔌</span>
            <span>Disconnect</span>
          </button>
        </div>
      `;
    }

    // disconnected or error
    return html`
      <div class="card welcome-card">
        <div class="welcome-icon">✈</div>
        <h2>Connect Your Telegram</h2>
        <p class="welcome-desc">
          Link your Telegram account to send and receive messages
          directly from Matrix Element.
        </p>
        <button class="btn-primary full-width"
          @click=${this._startLogin} ?disabled=${this.isLoading}>
          ${this.isLoading ? html`<span class="spinner"></span>` : 'Connect Telegram Account'}
        </button>
        ${this.status === 'error' ? html`
          <p class="error-hint">⚠ ${this._statusError || 'Bridge error.'}</p>
        ` : ''}
      </div>
    `;
  }

  // ─── Login wizard view ───────────────────────────────────────────────────────

  _renderLogin() {
    // 1) No step yet → show the flow chooser (or a loading spinner while flows load).
    if (!this.loginStep) {
      if (!this.loginFlows) {
        return html`
          <div class="card center-card">
            <span class="spinner-lg"></span>
            <p class="muted">Loading login options…</p>
          </div>
        `;
      }
      return html`
        <div class="card">
          <h2>Choose a login method</h2>
          <p class="muted" style="margin:8px 0 18px">Pick how you want to connect Telegram.</p>
          <div class="flow-list">
            ${this.loginFlows.map(flow => html`
              <button class="flow-btn" @click=${() => this._beginFlow(flow.id)} ?disabled=${this.isLoading}>
                <span class="flow-icon">${this._flowIcon(flow.id)}</span>
                <span class="flow-text">
                  <span class="flow-name">${flow.name}</span>
                  <span class="flow-desc">${flow.description}</span>
                </span>
              </button>
            `)}
          </div>
          <button class="btn-secondary full-width" style="margin-top:12px"
            @click=${this._cancelLogin} ?disabled=${this.isLoading}>Cancel</button>
        </div>
      `;
    }

    // 2) A step is active → render it generically by type.
    return html`
      <div class="card">
        ${this.loginStep.instructions ? html`
          <p class="step-instructions">${this.loginStep.instructions}</p>
        ` : ''}

        ${this.loginStep.type === 'user_input'       ? this._renderUserInputStep()  : ''}
        ${this.loginStep.type === 'display_and_wait'  ? this._renderWaitStep()        : ''}
        ${this.loginStep.type === 'cookies'           ? html`
          <p class="error-hint">This login method needs a browser cookie step that this widget
          does not support. Please choose a different method.</p>` : ''}

        <button class="btn-secondary full-width" style="margin-top:12px"
          @click=${this._cancelLogin} ?disabled=${this.isLoading}>Cancel</button>
      </div>
    `;
  }

  _flowIcon(id) {
    if (id === 'qr')  return '📱';
    if (id === 'bot') return '🤖';
    return '📞'; // phone / default
  }

  // Render one input per field in the current user_input step.
  _renderUserInputStep() {
    const fields = this.loginStep.user_input?.fields ?? [];
    return html`
      ${fields.map(f => html`
        <div class="form-group">
          <label>${f.name}</label>
          <input
            type=${this._inputTypeFor(f.type)}
            .value=${this.stepInputs[f.id] ?? f.default_value ?? ''}
            placeholder=${f.name}
            @input=${e => this._setStepInput(f.id, e.target.value)}
            @keydown=${e => e.key === 'Enter' && this._stepReady() && this._submitUserInput()}
            ?disabled=${this.isLoading} />
          ${f.description ? html`<p class="field-hint">${f.description}</p>` : ''}
        </div>
      `)}
      <button class="btn-primary full-width"
        @click=${this._submitUserInput}
        ?disabled=${this.isLoading || !this._stepReady()}>
        ${this.isLoading ? html`<span class="spinner"></span>` : 'Continue →'}
      </button>
    `;
  }

  // Render a QR code (or image) and wait for the user to scan it.
  _renderWaitStep() {
    return html`
      <div class="qr-wrap">
        ${this.qrDataUrl
          ? html`<img class="qr-img" src=${this.qrDataUrl} alt="Login QR code" />`
          : this.loginStep.display_and_wait?.image_url
            ? html`<img class="qr-img" src=${this.loginStep.display_and_wait.image_url} alt="Login image" />`
            : html`<code class="qr-fallback">${this.loginStep.display_and_wait?.data ?? ''}</code>`}
        <div class="qr-status"><span class="spinner-sm"></span> Waiting for you to scan…</div>
        <p class="field-hint">Telegram → Settings → Devices → Link Desktop Device, then scan.</p>
      </div>
    `;
  }

  // ─── Chats view ──────────────────────────────────────────────────────────────

  _renderChats() {
    return html`
      <div class="card">

        <div class="section-header">
          <h2>My Telegram Chats</h2>
          <button class="btn-icon" @click=${this._fetchChats}
            ?disabled=${this.isLoading} title="Refresh">
            ${this.isLoading ? html`<span class="spinner-sm"></span>` : '↺ Refresh'}
          </button>
        </div>

        ${this.isLoading ? html`
          <div class="center-card"><span class="spinner-lg"></span></div>
        ` : ''}

        ${!this.isLoading && this.chats.length === 0 ? html`
          <div class="empty-state">
            <p>No chats found.</p>
            <p class="muted">Your Telegram contacts appear here once the bridge syncs them.</p>
          </div>
        ` : ''}

        <div class="chat-list">
          ${this.chats.map(chat => this._renderChatItem(chat))}
        </div>

      </div>
    `;
  }

  _renderChatItem(chat) {
    const name    = chat.name ?? chat.mxid ?? '?';
    const initial = name[0].toUpperCase();
    // identifiers look like "tel:+855..." or "telegram:username"
    const handle  = (chat.identifiers ?? [])
      .map(i => i.startsWith('telegram:') ? '@' + i.slice('telegram:'.length)
              : i.startsWith('tel:')      ? i.slice('tel:'.length)
              : i)
      .join(' · ');
    return html`
      <div class="chat-item">
        <div class="chat-avatar">${initial}</div>
        <div class="chat-info">
          <p class="chat-name">${name}</p>
          ${handle ? html`<p class="chat-sub">${handle}</p>` : ''}
        </div>
        <button class="btn-open" @click=${() => this._startDM(chat.id)} ?disabled=${this.isLoading}>
          Open chat →
        </button>
      </div>
    `;
  }

  // ─── Search view ─────────────────────────────────────────────────────────────

  _renderSearch() {
    return html`
      <div class="card">

        <h2>Find Telegram User</h2>
        <p class="muted" style="margin-bottom:16px">
          Search by Telegram username (e.g. <code>@username</code>) or phone number.
        </p>

        <div class="search-row">
          <input type="text" placeholder="@username or +855..."
            .value=${this.searchQuery}
            @input=${e => this.searchQuery = e.target.value}
            @keydown=${e => e.key === 'Enter' && this._searchUser()}
            ?disabled=${this.isLoading} />
          <button class="btn-primary"
            @click=${this._searchUser}
            ?disabled=${this.isLoading || !this.searchQuery.trim()}>
            ${this.isLoading ? html`<span class="spinner"></span>` : 'Search'}
          </button>
        </div>

        ${this.searchResults.length ? html`
          <div class="chat-list">
            ${this.searchResults.map(user => html`
              <div class="result-card">
                <div class="chat-avatar">${(user.name ?? user.id ?? '?')[0].toUpperCase()}</div>
                <div class="chat-info">
                  <p class="chat-name">${user.name ?? user.id}</p>
                  ${user.identifiers?.length ? html`
                    <p class="chat-sub">${user.identifiers.join(' · ')}</p>
                  ` : ''}
                </div>
                <button class="btn-primary"
                  @click=${() => this._startDM(user.id ?? this.searchQuery)}
                  ?disabled=${this.isLoading}>
                  ${this.isLoading ? html`<span class="spinner"></span>` : 'Start DM'}
                </button>
              </div>
            `)}
          </div>
        ` : ''}

      </div>
    `;
  }

  // ─── Styles ──────────────────────────────────────────────────────────────────

  static styles = css`
    *, *::before, *::after {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    :host {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      display: block;
      min-height: 100vh;
      background: #f0f4f8;
      color: #17191c;
    }

    /* ── Layout ── */
    .container {
      max-width: 560px;
      margin: 0 auto;
      padding: 20px;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    /* ── Header ── */
    .header {
      background: white;
      border-radius: 14px;
      padding: 18px 20px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.07);
    }

    .header-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 12px;
    }

    .brand {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .brand-icon {
      font-size: 1.6rem;
      background: #2AABEE;
      color: white;
      border-radius: 10px;
      width: 40px;
      height: 40px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-style: normal;
      flex-shrink: 0;
    }

    h1 {
      font-size: 1.25rem;
      font-weight: 700;
      color: #17191c;
    }

    .btn-back {
      background: #f0f4f8;
      border: none;
      border-radius: 8px;
      padding: 6px 14px;
      font-size: 0.875rem;
      color: #525760;
      cursor: pointer;
      font-weight: 500;
      transition: background 0.15s;
    }
    .btn-back:hover { background: #e2e8f0; }

    /* ── Status badge ── */
    .status-badge {
      display: inline-flex;
      align-items: center;
      gap: 7px;
      padding: 5px 12px;
      border-radius: 20px;
      font-size: 0.8rem;
      font-weight: 600;
    }

    .status-badge.connected    { background: #e8f5f0; color: #03b381; }
    .status-badge.disconnected { background: #f5f5f5; color: #737780; }
    .status-badge.checking     { background: #e8f0ff; color: #2B7EDB; }
    .status-badge.error        { background: #fff0f0; color: #d32f2f; }

    .status-dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: currentColor;
      animation: pulse 2s infinite;
    }

    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50%       { opacity: 0.4; }
    }

    /* ── Cards ── */
    .card {
      background: white;
      border-radius: 14px;
      padding: 24px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.07);
    }

    .center-card {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 14px;
      padding: 40px 24px;
    }

    /* ── Profile card ── */
    .profile-card {
      display: flex;
      align-items: center;
      gap: 16px;
    }

    .avatar {
      width: 56px;
      height: 56px;
      border-radius: 50%;
      background: #2AABEE;
      color: white;
      font-size: 1.4rem;
      font-weight: 700;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .profile-name {
      font-weight: 700;
      font-size: 1.05rem;
      color: #17191c;
    }

    .profile-sub {
      font-size: 0.875rem;
      color: #737780;
      margin-top: 2px;
    }

    /* ── Action grid ── */
    .action-grid {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 12px;
    }

    .action-btn {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      padding: 18px 10px;
      background: white;
      border: 2px solid #e8edf2;
      border-radius: 14px;
      cursor: pointer;
      font-size: 0.875rem;
      font-weight: 600;
      color: #17191c;
      transition: all 0.15s;
    }

    .action-btn:hover:not(:disabled) {
      border-color: #2AABEE;
      background: #f0f9ff;
      transform: translateY(-2px);
    }

    .action-btn--danger { color: #d32f2f; }
    .action-btn--danger:hover:not(:disabled) {
      border-color: #d32f2f;
      background: #fff5f5;
    }

    .action-btn:disabled { opacity: 0.5; cursor: not-allowed; }

    .action-icon { font-size: 1.6rem; }

    /* ── Welcome card ── */
    .welcome-card {
      text-align: center;
      padding: 36px 28px;
    }

    .welcome-icon {
      font-size: 3rem;
      background: #2AABEE;
      color: white;
      width: 72px;
      height: 72px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 20px;
      font-style: normal;
    }

    .welcome-card h2 {
      font-size: 1.3rem;
      font-weight: 700;
      margin-bottom: 10px;
    }

    .welcome-desc {
      color: #737780;
      font-size: 0.95rem;
      line-height: 1.6;
      margin-bottom: 24px;
    }

    .error-hint {
      margin-top: 14px;
      font-size: 0.8rem;
      color: #d32f2f;
    }

    /* ── Login wizard ── */
    .step-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 20px;
    }

    .step-label {
      font-weight: 700;
      font-size: 1rem;
      color: #17191c;
    }

    .step-dots {
      display: flex;
      gap: 6px;
    }

    .step-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #d1d5db;
      transition: background 0.2s;
    }

    .step-dot.active { background: #2AABEE; }

    .step-instructions {
      font-size: 0.9rem;
      color: #737780;
      margin-bottom: 20px;
      line-height: 1.5;
    }

    /* ── Flow chooser ── */
    .flow-list { display: flex; flex-direction: column; gap: 10px; }

    .flow-btn {
      display: flex;
      align-items: center;
      gap: 14px;
      width: 100%;
      text-align: left;
      padding: 14px 16px;
      background: white;
      border: 2px solid #e8edf2;
      border-radius: 12px;
      cursor: pointer;
      transition: all 0.15s;
    }
    .flow-btn:hover:not(:disabled) {
      border-color: #2AABEE;
      background: #f0f9ff;
      transform: translateY(-1px);
    }
    .flow-btn:disabled { opacity: 0.55; cursor: not-allowed; }

    .flow-icon { font-size: 1.5rem; flex-shrink: 0; }
    .flow-text { display: flex; flex-direction: column; gap: 2px; }
    .flow-name { font-weight: 700; font-size: 0.95rem; color: #17191c; }
    .flow-desc { font-size: 0.8rem; color: #737780; }

    /* ── QR / display-and-wait ── */
    .qr-wrap {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 14px;
      padding: 8px 0 4px;
    }
    .qr-img {
      width: 220px;
      height: 220px;
      border-radius: 12px;
      border: 1px solid #e8edf2;
      background: white;
    }
    .qr-fallback {
      display: block;
      word-break: break-all;
      max-width: 100%;
      padding: 10px 12px;
    }
    .qr-status {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      font-size: 0.9rem;
      font-weight: 600;
      color: #2B7EDB;
    }

    /* ── Form ── */
    .form-group { margin-bottom: 18px; }

    label {
      display: block;
      font-weight: 600;
      font-size: 0.875rem;
      color: #525760;
      margin-bottom: 8px;
    }

    input[type="tel"],
    input[type="text"],
    input[type="password"] {
      width: 100%;
      padding: 12px 14px;
      border: 2px solid #e2e8f0;
      border-radius: 10px;
      font-size: 1rem;
      font-family: inherit;
      background: #fafafa;
      color: #17191c;
      transition: all 0.15s;
    }

    input:focus {
      outline: none;
      border-color: #2AABEE;
      background: white;
      box-shadow: 0 0 0 3px rgba(42, 171, 238, 0.12);
    }

    input:disabled {
      opacity: 0.6;
      cursor: not-allowed;
      background: #f5f5f5;
    }

    input::placeholder { color: #a0aab4; }

    .code-input {
      font-size: 1.6rem !important;
      letter-spacing: 0.5em;
      text-align: center;
    }

    .field-hint {
      font-size: 0.8rem;
      color: #a0aab4;
      margin-top: 6px;
    }

    /* ── Buttons ── */
    .btn-primary,
    .btn-secondary {
      border: none;
      border-radius: 10px;
      font-size: 0.95rem;
      font-weight: 700;
      padding: 12px 20px;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      transition: all 0.15s;
      font-family: inherit;
    }

    .btn-primary {
      background: #2AABEE;
      color: white;
    }

    .btn-primary:hover:not(:disabled) {
      background: #1e96d8;
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(42,171,238,0.3);
    }

    .btn-secondary {
      background: #f0f4f8;
      color: #525760;
    }

    .btn-secondary:hover:not(:disabled) { background: #e2e8f0; }

    .btn-danger {
      background: #d32f2f;
      color: white;
    }
    .btn-danger:hover:not(:disabled) {
      background: #b71c1c;
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(211,47,47,0.3);
    }

    /* ── Modal ── */
    .modal-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.4);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
      z-index: 100;
      animation: fadeIn 0.15s ease;
    }

    .modal-card {
      background: white;
      border-radius: 14px;
      padding: 24px;
      max-width: 380px;
      width: 100%;
      box-shadow: 0 10px 40px rgba(0,0,0,0.25);
    }

    .modal-card h2 { margin-bottom: 10px; }

    .modal-actions {
      display: flex;
      gap: 10px;
      margin-top: 20px;
    }
    .modal-actions button { flex: 1; }

    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

    button:disabled { opacity: 0.55; cursor: not-allowed; transform: none !important; }

    .full-width { width: 100%; }

    /* ── Section header ── */
    .section-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 18px;
    }

    .section-header h2 { font-size: 1.1rem; font-weight: 700; }

    .btn-icon {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 14px;
      background: #f0f4f8;
      border: none;
      border-radius: 8px;
      font-size: 0.875rem;
      font-weight: 600;
      color: #525760;
      cursor: pointer;
      transition: background 0.15s;
    }
    .btn-icon:hover:not(:disabled) { background: #e2e8f0; }

    /* ── Chat list ── */
    .chat-list { display: flex; flex-direction: column; gap: 10px; }

    .chat-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px;
      border: 1px solid #f0f4f8;
      border-radius: 10px;
      transition: background 0.1s;
    }
    .chat-item:hover { background: #f8fafc; }

    .chat-avatar {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      background: #2AABEE;
      color: white;
      font-weight: 700;
      font-size: 1rem;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .chat-info { flex: 1; min-width: 0; }

    .chat-name {
      font-weight: 600;
      font-size: 0.95rem;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .chat-sub {
      font-size: 0.8rem;
      color: #737780;
      margin-top: 2px;
    }

    .btn-open {
      padding: 6px 12px;
      background: #f0f9ff;
      color: #2AABEE;
      border-radius: 8px;
      font-size: 0.8rem;
      font-weight: 700;
      text-decoration: none;
      white-space: nowrap;
      transition: background 0.15s;
    }
    .btn-open:hover { background: #dbeeff; }

    /* ── Empty state ── */
    .empty-state {
      text-align: center;
      padding: 32px 0;
      color: #737780;
      font-size: 0.95rem;
      line-height: 1.6;
    }

    /* ── Search ── */
    .search-row {
      display: flex;
      gap: 10px;
      margin-bottom: 16px;
    }

    .search-row input { flex: 1; }

    .result-card {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 14px;
      border: 2px solid #e8f5ff;
      border-radius: 10px;
      background: #f8fafc;
    }

    /* ── Notification ── */
    .notification {
      padding: 12px 16px;
      border-radius: 10px;
      font-weight: 600;
      font-size: 0.9rem;
      animation: slideDown 0.25s ease;
    }

    .notification.success { background: #e8f5f0; color: #03b381; border: 1px solid #c6eed8; }
    .notification.error   { background: #fff0f0; color: #d32f2f; border: 1px solid #ffc5c5; }

    @keyframes slideDown {
      from { opacity: 0; transform: translateY(-8px); }
      to   { opacity: 1; transform: translateY(0); }
    }

    /* ── Spinners ── */
    .spinner, .spinner-sm, .spinner-lg {
      border-radius: 50%;
      border-style: solid;
      border-color: rgba(255,255,255,0.3);
      border-top-color: currentColor;
      animation: spin 0.65s linear infinite;
      display: inline-block;
      flex-shrink: 0;
    }

    .spinner    { width: 16px; height: 16px; border-width: 2px; }
    .spinner-sm { width: 14px; height: 14px; border-width: 2px; color: #525760; border-color: #d1d5db; border-top-color: #2AABEE; }
    .spinner-lg { width: 32px; height: 32px; border-width: 3px; color: #2AABEE; border-color: #d1d5db; border-top-color: #2AABEE; }

    @keyframes spin { to { transform: rotate(360deg); } }

    /* ── Misc ── */
    .muted { color: #737780; font-size: 0.9rem; }

    h2 { font-size: 1.1rem; font-weight: 700; color: #17191c; }

    code {
      background: #f0f4f8;
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 0.875em;
    }

    /* ── Responsive ── */
    @media (max-width: 480px) {
      .container { padding: 12px; }
      .action-grid { grid-template-columns: 1fr 1fr 1fr; gap: 8px; }
      .action-btn { padding: 14px 6px; font-size: 0.8rem; }
      .search-row { flex-direction: column; }
    }
  `;
}

customElements.define('telegram-bridge-widget', TelegramBridgeWidget);
