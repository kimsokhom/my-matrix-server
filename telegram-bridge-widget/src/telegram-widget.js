import { LitElement, html } from 'lit';
import * as MatrixWidget from 'matrix-widget-api';
import QRCode from 'qrcode';

import { VIEWS, STORAGE_KEY, DEV_MATRIX_USER_ID, ELEMENT_BASE_URL } from './config.js';
import { BridgeClient } from './api.js';
import { ICONS } from './icons.js';
import { styles } from './styles.js';

export class TelegramBridgeWidget extends LitElement {

  static styles = styles;

  static properties = {
    view:           { type: String },
    status:         { type: String },   // 'checking' | 'connected' | 'disconnected' | 'error'
    telegramUser:   { type: Object },
    loginFlows:     { type: Array },    // available flows from GET /login/flows
    loginProcessId: { type: String },   // login_id returned by /login/start
    loginStep:      { type: Object },   // current step object from the API
    stepInputs:     { type: Object },   // { fieldId: value } for the current user_input step
    qrDataUrl:      { type: String },   // rendered QR image for display_and_wait steps
    contacts:       { type: Array },
    contactFilter:  { type: String },   // client-side filter for the contacts list
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
    this.contacts = [];
    this.contactFilter = '';
    this.searchQuery = '';
    this.searchResults = [];
    this.isLoading = false;
    this.notification = { message: '', type: '' };
    this._matrixUserId = '';
    this._statusError = '';
    this._needsUserId = false;
    this._manualUserId = '';
    this._confirmingLogout = false;

    // The API client reads the Matrix user ID fresh on each call (it can change
    // at runtime when the user types it manually in a plain browser).
    this.api = new BridgeClient(() => this._matrixUserId);

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

    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return saved;

    return DEV_MATRIX_USER_ID;
  }

  async _confirmUserId() {
    const id = this._manualUserId.trim();
    if (!id.startsWith('@') || !id.includes(':')) {
      this._showNotification('Enter a valid Matrix ID like @user:server.com', 'error');
      return;
    }
    localStorage.setItem(STORAGE_KEY, id);
    this._matrixUserId = id;
    this._needsUserId = false;
    await this._checkStatus();
  }

  // ─── API-backed actions ───────────────────────────────────────────────────────

  async _checkStatus() {
    this.status = 'checking';
    this._statusError = '';
    try {
      const { ok, status, data } = await this.api.whoami();
      if (status === 403) {
        this._statusError = '403 — Wrong provisioning secret or missing user ID.';
        this.status = 'error'; return;
      }
      if (!ok) {
        this._statusError = `Bridge returned ${status}.`;
        this.status = 'error'; return;
      }
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
      const { ok, status, data } = await this.api.loginFlows();
      if (!ok) {
        this._showNotification(`Bridge returned ${status} on GET /login/flows`, 'error');
        this.view = VIEWS.HOME;
        return;
      }
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
      const { ok, status, data } = await this.api.startLogin(flowId);
      if (!ok) {
        this._showNotification(data.error ?? `Failed to start login (${status})`, 'error');
        return;
      }
      await this._advance(data);
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
      const { ok, data } = await this.api.submitStep(
        this.loginProcessId, this.loginStep.step_id, 'user_input', JSON.stringify(this.stepInputs)
      );
      if (!ok) {
        this._showNotification(data.error ?? 'Invalid input — try again', 'error');
        return;
      }
      await this._advance(data);
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
      const { ok, data } = await this.api.submitStep(processId, step.step_id, 'display_and_wait', '{}');
      // The user cancelled (or moved on) while we were waiting — stop quietly.
      if (this.loginProcessId !== processId) return;
      if (!ok) {
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
      await this._advance(data);
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
      const { ok, status } = await this.api.logout(id);
      if (!ok) { this._showNotification(`Logout failed (${status})`, 'error'); return; }
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

  async _fetchContacts() {
    this.isLoading = true;
    this.contacts = [];
    this.contactFilter = '';
    try {
      const { ok, data } = await this.api.contacts();
      if (!ok) { this._showNotification('Failed to load contacts', 'error'); return; }
      this.contacts = data.contacts ?? [];
    } catch {
      this._showNotification('Connection failed', 'error');
    } finally {
      this.isLoading = false;
    }
  }

  // Contacts that match the current filter (case-insensitive, matches name and
  // any identifier like a phone number or @username). Purely client-side — the
  // full list is already loaded, so filtering is instant with no extra request.
  get _visibleContacts() {
    const q = this.contactFilter.trim().toLowerCase();
    if (!q) return this.contacts;
    return this.contacts.filter(c => {
      const name = (c.name ?? c.mxid ?? '').toLowerCase();
      const ids  = (c.identifiers ?? []).join(' ').toLowerCase();
      return name.includes(q) || ids.includes(q);
    });
  }

  async _searchUser() {
    if (!this.searchQuery.trim()) return;
    this.isLoading = true;
    this.searchResults = [];
    try {
      // search_users does a network-side search by free-text query.
      const { ok, data } = await this.api.search(this.searchQuery.trim());
      if (!ok) { this._showNotification('Search failed', 'error'); return; }
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
      const { ok, data } = await this.api.createDm(identifier);
      if (!ok) { this._showNotification('Failed to open chat', 'error'); return; }
      // bridgev2 may name the room field differently across versions.
      const roomId = data.dm_room_mxid ?? data.room_id ?? data.room_mxid
                   ?? data.mxid ?? data.room?.id;
      this.searchQuery = '';
      this.searchResults = [];
      if (roomId) {
        await this._openRoom(roomId);
      } else {
        // The bridge created the DM but did not return a room id — it still
        // shows up in the room list, so point the user there.
        this._showNotification('Chat created — find it in your room list', 'success');
      }
    } catch {
      this._showNotification('Connection failed', 'error');
    } finally {
      this.isLoading = false;
    }
  }

  // Open a Matrix room from the widget.
  async _openRoom(roomId) {
    // Are we embedded (Element runs widgets in an iframe)? This is synchronous
    // and always correct, unlike waiting on the widget 'ready' handshake which
    // may have timed out by now.
    const embedded = window.self !== window.top;

    if (embedded) {
      // Inside Element: ONLY ask the host to navigate. Never call window.open —
      // the sandbox turns it into the external matrix.to "choose an app" page
      // (the bad redirect). If navigation is not granted, the DM still exists
      // in the room list, so just point the user there.
      try {
        await this.widgetApi.navigateTo(`https://matrix.to/#/${roomId}`);
        this._showNotification('Opening chat…', 'success');
      } catch {
        this._showNotification('Chat is ready — open it from your room list.', 'success');
      }
      return;
    }

    // Standalone browser tab. Prefer OUR own hosted Element (deep link into the
    // user's existing homeserver session) so they don't get dumped on the public
    // matrix.to / app.element.io page. Fall back to matrix.to only if no Element
    // URL is configured.
    const url = ELEMENT_BASE_URL
      ? `${ELEMENT_BASE_URL}/#/room/${roomId}`
      : `https://matrix.to/#/${roomId}`;
    try { window.open(url, '_blank', 'noopener'); } catch { /* ignore */ }
  }

  async _cancelLogin() {
    if (this.loginProcessId) {
      try { await this.api.cancelLogin(this.loginProcessId); } catch { /* best-effort cancel */ }
    }
    this.loginFlows = null;
    this.loginProcessId = null;
    this.loginStep = null;
    this.stepInputs = {};
    this.qrDataUrl = '';
    this.view = VIEWS.HOME;
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
              <span class="brand-icon">${ICONS.send}</span>
              <h1>Telegram Bridge</h1>
            </div>
            ${this.view !== VIEWS.HOME ? html`
              <button class="btn-back" @click=${() => { this.view = VIEWS.HOME; }}>${ICONS.chevronLeft} Back</button>
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
            this.view === VIEWS.CONTACTS ? this._renderContacts()  :
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
        <div class="welcome-icon">${ICONS.send}</div>
        <h2>Enter Your Matrix ID</h2>
        <p class="welcome-desc">
          Could not detect your Matrix account automatically.<br>
          Enter your Matrix ID to connect to the bridge.
        </p>
        <div class="form-group full-width">
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
            @click=${() => { this.view = VIEWS.CONTACTS; this._fetchContacts(); }}>
            <span class="action-icon">${ICONS.users}</span>
            <span>My Contacts</span>
          </button>
          <button class="action-btn"
            @click=${() => { this.view = VIEWS.SEARCH; this.searchQuery = ''; this.searchResults = []; }}>
            <span class="action-icon">${ICONS.search}</span>
            <span>Find User</span>
          </button>
          <button class="action-btn action-btn--danger"
            @click=${this._logout} ?disabled=${this.isLoading}>
            <span class="action-icon">${ICONS.logout}</span>
            <span>Disconnect</span>
          </button>
        </div>
      `;
    }

    // disconnected or error
    return html`
      <div class="card welcome-card">
        <div class="welcome-icon">${ICONS.send}</div>
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
          <p class="error-hint">${this._statusError || 'Bridge error.'}</p>
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
    if (id === 'qr')  return ICONS.qrCode;
    if (id === 'bot') return ICONS.bot;
    return ICONS.smartphone; // phone / default
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

  // ─── Contacts view ─────────────────────────────────────────────────────────────

  _renderContacts() {
    const visible = this._visibleContacts;
    const hasContacts = this.contacts.length > 0;
    return html`
      <div class="card">

        <div class="section-header">
          <h2>My Telegram Contacts</h2>
          <button class="btn-icon" @click=${this._fetchContacts}
            ?disabled=${this.isLoading} title="Refresh">
            ${this.isLoading ? html`<span class="spinner-sm"></span>` : html`${ICONS.refresh} Refresh`}
          </button>
        </div>

        ${!this.isLoading && hasContacts ? html`
          <div class="filter-field">
            <span class="filter-icon">${ICONS.search}</span>
            <input type="text" placeholder="Filter contacts by name or number…"
              .value=${this.contactFilter}
              @input=${e => this.contactFilter = e.target.value}
              aria-label="Filter contacts" />
            ${this.contactFilter ? html`
              <button class="filter-clear" title="Clear filter"
                @click=${() => this.contactFilter = ''}>&times;</button>
            ` : ''}
          </div>
        ` : ''}

        ${this.isLoading ? html`
          <div class="center-card"><span class="spinner-lg"></span></div>
        ` : ''}

        ${!this.isLoading && !hasContacts ? html`
          <div class="empty-state">
            <p>No contacts found.</p>
            <p class="muted">Your Telegram contacts appear here once the bridge syncs them.</p>
          </div>
        ` : ''}

        ${!this.isLoading && hasContacts && visible.length === 0 ? html`
          <div class="empty-state">
            <p>No contacts match “${this.contactFilter}”.</p>
            <p class="muted">Try a different name or number.</p>
          </div>
        ` : ''}

        <div class="chat-list">
          ${visible.map(contact => this._renderContactItem(contact))}
        </div>

      </div>
    `;
  }

  _renderContactItem(chat) {
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
}

customElements.define('telegram-bridge-widget', TelegramBridgeWidget);
