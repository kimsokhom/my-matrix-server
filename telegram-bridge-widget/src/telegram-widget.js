import { LitElement, html, css } from 'lit';
import * as MatrixWidget from 'matrix-widget-api';

// In dev, leave VITE_BRIDGE_URL empty so paths are relative — Vite proxy forwards them.
// In production, set VITE_BRIDGE_URL to the full Railway URL.
const BRIDGE_URL = import.meta.env.VITE_BRIDGE_URL ?? '';
const PROVISIONING_SECRET = import.meta.env.VITE_PROVISIONING_SECRET;

// Provisioning API endpoint paths — update here if your bridge version differs
const API = {
  WHOAMI:       `${BRIDGE_URL}/_matrix/provision/v3/whoami`,
  LOGIN_NEW:    `${BRIDGE_URL}/_matrix/provision/v3/login/new`,
  LOGIN_STEP:   (id) => `${BRIDGE_URL}/_matrix/provision/v3/login/${id}/step`,
  LOGIN_CANCEL: (id) => `${BRIDGE_URL}/_matrix/provision/v3/login/${id}`,
  LOGOUT:       `${BRIDGE_URL}/_matrix/provision/v3/logout`,
  PORTALS:      `${BRIDGE_URL}/_matrix/provision/v3/portals`,
  RESOLVE:      (q) => `${BRIDGE_URL}/_matrix/provision/v3/resolve_identifier/${encodeURIComponent(q)}`,
  PM:           `${BRIDGE_URL}/_matrix/provision/v3/pm`,
};

const VIEWS = { HOME: 'home', LOGIN: 'login', CHATS: 'chats', SEARCH: 'search' };

export class TelegramBridgeWidget extends LitElement {

  static properties = {
    view:          { type: String },
    status:        { type: String },   // 'checking' | 'connected' | 'disconnected' | 'error'
    telegramUser:  { type: Object },
    loginFlowId:   { type: String },
    loginStep:     { type: Object },   // current step from API
    phoneInput:    { type: String },
    codeInput:     { type: String },
    passwordInput: { type: String },
    chats:         { type: Array },
    searchQuery:   { type: String },
    searchResult:  { type: Object },
    isLoading:     { type: Boolean },
    notification:  { type: Object },
  };

  constructor() {
    super();
    this.view = VIEWS.HOME;
    this.status = 'checking';
    this.telegramUser = null;
    this.loginFlowId = null;
    this.loginStep = null;
    this.phoneInput = '';
    this.codeInput = '';
    this.passwordInput = '';
    this.chats = [];
    this.searchQuery = '';
    this.searchResult = null;
    this.isLoading = false;
    this.notification = { message: '', type: '' };
    this._matrixUserId = '';
    this._statusError = '';

    try {
      this.widgetApi = new MatrixWidget.WidgetApi();
      this.widgetApi.start();
    } catch (err) {
      console.warn('Matrix Widget API not available (running outside Element?):', err);
    }
  }

  async firstUpdated() {
    this._matrixUserId = await this._resolveUserId();
    await this._checkStatus();
  }

  // Resolves the Matrix user ID from three sources in priority order:
  // 1. ?user_id= URL param  (Element Web template substitution)
  // 2. Widget API OpenID    (automatic, no URL param needed)
  // 3. VITE_MATRIX_USER_ID (local dev fallback)
  async _resolveUserId() {
    const fromUrl = new URLSearchParams(location.search).get('user_id');
    if (fromUrl) return fromUrl;

    if (this.widgetApi) {
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
      } catch { /* not in Element Web — fall through */ }
    }

    return import.meta.env.VITE_MATRIX_USER_ID ?? '';
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
      if (data.telegram || data.remote_id) {
        this.telegramUser = data.telegram ?? data;
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

  async _startLogin() {
    this.isLoading = true;
    try {
      const res = await fetch(this._u(API.LOGIN_NEW), {
        method: 'POST',
        headers: this._authHeaders(),
        body: JSON.stringify({}),
      });
      if (!res.ok) { this._showNotification('Failed to start login', 'error'); return; }
      const data = await res.json();
      this.loginFlowId = data.id ?? data.login_id;
      this.loginStep = data.next_step ?? data.steps?.[0];
      this.view = VIEWS.LOGIN;
    } catch {
      this._showNotification('Could not reach the bridge. Check VITE_BRIDGE_URL.', 'error');
    } finally {
      this.isLoading = false;
    }
  }

  async _submitStep(stepData) {
    this.isLoading = true;
    try {
      const res = await fetch(this._u(API.LOGIN_STEP(this.loginFlowId)), {
        method: 'POST',
        headers: this._authHeaders(),
        body: JSON.stringify({ step_id: this.loginStep.step_id, ...stepData }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        this._showNotification(err.message ?? 'Invalid input — try again', 'error');
        return;
      }
      const data = await res.json();
      if (data.next_step) {
        this.loginStep = data.next_step;
        this.codeInput = '';
        this.passwordInput = '';
      } else {
        // Login complete
        this.loginFlowId = null;
        this.loginStep = null;
        this.phoneInput = '';
        await this._checkStatus();
        this._showNotification('Telegram connected!', 'success');
        this.view = VIEWS.HOME;
      }
    } catch {
      this._showNotification('Connection failed', 'error');
    } finally {
      this.isLoading = false;
    }
  }

  async _logout() {
    if (!confirm('Disconnect your Telegram account from this bridge?')) return;
    this.isLoading = true;
    try {
      await fetch(this._u(API.LOGOUT), { method: 'POST', headers: this._authHeaders() });
      this.telegramUser = null;
      this.status = 'disconnected';
      this._showNotification('Disconnected from Telegram', 'success');
    } catch {
      this._showNotification('Logout failed', 'error');
    } finally {
      this.isLoading = false;
    }
  }

  async _fetchChats() {
    this.isLoading = true;
    this.chats = [];
    try {
      const res = await fetch(this._u(API.PORTALS), { headers: this._authHeaders() });
      if (!res.ok) { this._showNotification('Failed to load chats', 'error'); return; }
      const data = await res.json();
      this.chats = data.portals ?? data ?? [];
    } catch {
      this._showNotification('Connection failed', 'error');
    } finally {
      this.isLoading = false;
    }
  }

  async _searchUser() {
    if (!this.searchQuery.trim()) return;
    this.isLoading = true;
    this.searchResult = null;
    try {
      const res = await fetch(this._u(API.RESOLVE(this.searchQuery.trim())), {
        headers: this._authHeaders(),
      });
      if (res.status === 404) { this._showNotification('User not found', 'error'); return; }
      if (!res.ok) { this._showNotification('Search failed', 'error'); return; }
      this.searchResult = await res.json();
    } catch {
      this._showNotification('Connection failed', 'error');
    } finally {
      this.isLoading = false;
    }
  }

  async _startDM(identifier) {
    this.isLoading = true;
    try {
      const res = await fetch(this._u(API.PM), {
        method: 'POST',
        headers: this._authHeaders(),
        body: JSON.stringify({ identifier }),
      });
      if (!res.ok) { this._showNotification('Failed to open DM', 'error'); return; }
      this._showNotification('DM room created — check your Matrix rooms!', 'success');
      this.searchQuery = '';
      this.searchResult = null;
    } catch {
      this._showNotification('Connection failed', 'error');
    } finally {
      this.isLoading = false;
    }
  }

  // ─── Login step helpers ─────────────────────────────────────────────────────

  _isPhoneStep() {
    return this.loginStep?.step_id?.toLowerCase().includes('phone');
  }
  _isCodeStep() {
    const id = this.loginStep?.step_id?.toLowerCase() ?? '';
    return id.includes('code') || id.includes('otp') || id.includes('verif');
  }
  _is2FAStep() {
    const id = this.loginStep?.step_id?.toLowerCase() ?? '';
    return id.includes('password') || id.includes('2fa') || id.includes('two');
  }

  _stepNumber() {
    if (this._isPhoneStep()) return 1;
    if (this._isCodeStep())  return 2;
    if (this._is2FAStep())   return 3;
    return 1;
  }

  _fieldId(fallback) {
    return this.loginStep?.fields?.[0]?.id ?? fallback;
  }

  _submitPhoneStep() {
    this._submitStep({ [this._fieldId('phone_number')]: this.phoneInput.trim() });
  }
  _submitCodeStep() {
    this._submitStep({ [this._fieldId('code')]: this.codeInput.trim() });
  }
  _submit2FAStep() {
    this._submitStep({ [this._fieldId('password')]: this.passwordInput });
  }

  async _cancelLogin() {
    if (this.loginFlowId) {
      try {
        await fetch(this._u(API.LOGIN_CANCEL(this.loginFlowId)), {
          method: 'DELETE',
          headers: this._authHeaders(),
        });
      } catch { /* best-effort cancel */ }
    }
    this.loginFlowId = null;
    this.loginStep = null;
    this.phoneInput = '';
    this.codeInput = '';
    this.passwordInput = '';
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
          ${this.view === VIEWS.HOME   ? this._renderHome()   : ''}
          ${this.view === VIEWS.LOGIN  ? this._renderLogin()  : ''}
          ${this.view === VIEWS.CHATS  ? this._renderChats()  : ''}
          ${this.view === VIEWS.SEARCH ? this._renderSearch() : ''}
        </main>

      </div>
    `;
  }

  _renderStatusBadge() {
    const map = {
      checking:     { cls: 'checking',     label: 'Checking…' },
      connected:    { cls: 'connected',    label: this.telegramUser?.username ? `@${this.telegramUser.username}` : 'Connected' },
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
      const initial = (this.telegramUser?.full_name ?? this.telegramUser?.username ?? 'T')[0].toUpperCase();
      return html`
        <div class="card profile-card">
          <div class="avatar">${initial}</div>
          <div class="profile-info">
            <p class="profile-name">${this.telegramUser?.full_name ?? this.telegramUser?.username ?? 'Telegram User'}</p>
            ${this.telegramUser?.username ? html`<p class="profile-sub">@${this.telegramUser.username}</p>` : ''}
            ${this.telegramUser?.phone    ? html`<p class="profile-sub">${this.telegramUser.phone}</p>`    : ''}
          </div>
        </div>

        <div class="action-grid">
          <button class="action-btn"
            @click=${() => { this.view = VIEWS.CHATS; this._fetchChats(); }}>
            <span class="action-icon">💬</span>
            <span>My Chats</span>
          </button>
          <button class="action-btn"
            @click=${() => { this.view = VIEWS.SEARCH; }}>
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
    if (!this.loginStep) {
      return html`
        <div class="card center-card">
          <span class="spinner-lg"></span>
          <p class="muted">Starting login…</p>
        </div>
      `;
    }

    const stepNum = this._stepNumber();

    return html`
      <div class="card">

        <div class="step-header">
          <p class="step-label">
            ${this._isPhoneStep() ? 'Step 1 — Phone Number'     : ''}
            ${this._isCodeStep()  ? 'Step 2 — Verification Code' : ''}
            ${this._is2FAStep()   ? 'Step 3 — Two-Factor Auth'   : ''}
          </p>
          <div class="step-dots">
            ${[1, 2, 3].map(n => html`
              <span class="step-dot ${n <= stepNum ? 'active' : ''}"></span>
            `)}
          </div>
        </div>

        ${this.loginStep.instructions ? html`
          <p class="step-instructions">${this.loginStep.instructions}</p>
        ` : ''}

        ${this._isPhoneStep() ? html`
          <div class="form-group">
            <label>Phone Number</label>
            <input type="tel" placeholder="+855 12 345 678"
              .value=${this.phoneInput}
              @input=${e => this.phoneInput = e.target.value}
              @keydown=${e => e.key === 'Enter' && this._submitPhoneStep()}
              ?disabled=${this.isLoading} />
            <p class="field-hint">Include country code (e.g. +855 for Cambodia)</p>
          </div>
          <button class="btn-primary full-width"
            @click=${this._submitPhoneStep}
            ?disabled=${this.isLoading || this.phoneInput.trim().length < 7}>
            ${this.isLoading ? html`<span class="spinner"></span>` : 'Send Code →'}
          </button>
        ` : ''}

        ${this._isCodeStep() ? html`
          <div class="form-group">
            <label>Verification Code</label>
            <input type="text" inputmode="numeric" maxlength="7" placeholder="1 2 3 4 5"
              class="code-input"
              .value=${this.codeInput}
              @input=${e => this.codeInput = e.target.value.replace(/\D/g, '')}
              @keydown=${e => e.key === 'Enter' && this._submitCodeStep()}
              ?disabled=${this.isLoading} />
            <p class="field-hint">Check your Telegram app or SMS messages</p>
          </div>
          <button class="btn-primary full-width"
            @click=${this._submitCodeStep}
            ?disabled=${this.isLoading || this.codeInput.length < 5}>
            ${this.isLoading ? html`<span class="spinner"></span>` : 'Verify Code →'}
          </button>
        ` : ''}

        ${this._is2FAStep() ? html`
          <div class="form-group">
            <label>Two-Factor Password</label>
            <input type="password" placeholder="Your Telegram 2FA password"
              .value=${this.passwordInput}
              @input=${e => this.passwordInput = e.target.value}
              @keydown=${e => e.key === 'Enter' && this._submit2FAStep()}
              ?disabled=${this.isLoading} />
            <p class="field-hint">This is the password set in Telegram → Settings → Privacy</p>
          </div>
          <button class="btn-primary full-width"
            @click=${this._submit2FAStep}
            ?disabled=${this.isLoading || !this.passwordInput}>
            ${this.isLoading ? html`<span class="spinner"></span>` : 'Confirm →'}
          </button>
        ` : ''}

        <button class="btn-secondary full-width" style="margin-top:12px"
          @click=${this._cancelLogin} ?disabled=${this.isLoading}>
          Cancel
        </button>

      </div>
    `;
  }

  // ─── Chats view ──────────────────────────────────────────────────────────────

  _renderChats() {
    return html`
      <div class="card">

        <div class="section-header">
          <h2>Bridged Chats</h2>
          <button class="btn-icon" @click=${this._fetchChats}
            ?disabled=${this.isLoading} title="Sync chats">
            ${this.isLoading ? html`<span class="spinner-sm"></span>` : '↺ Sync'}
          </button>
        </div>

        ${this.isLoading ? html`
          <div class="center-card"><span class="spinner-lg"></span></div>
        ` : ''}

        ${!this.isLoading && this.chats.length === 0 ? html`
          <div class="empty-state">
            <p>No bridged chats yet.</p>
            <p class="muted">Your Telegram chats appear here once the bridge syncs them.</p>
          </div>
        ` : ''}

        <div class="chat-list">
          ${this.chats.map(chat => this._renderChatItem(chat))}
        </div>

      </div>
    `;
  }

  _renderChatItem(chat) {
    const name    = chat.name ?? chat.room_id ?? '?';
    const initial = name[0].toUpperCase();
    const type    = chat.type === 'channel' ? '📢 Channel'
                  : chat.type === 'supergroup' || chat.type === 'group' ? '👥 Group'
                  : '👤 Direct';
    return html`
      <div class="chat-item">
        <div class="chat-avatar">${initial}</div>
        <div class="chat-info">
          <p class="chat-name">${name}</p>
          <p class="chat-sub">${type}</p>
        </div>
        ${chat.room_id ? html`
          <a class="btn-open" href="https://matrix.to/#/${chat.room_id}" target="_blank">Open →</a>
        ` : ''}
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

        ${this.searchResult ? html`
          <div class="result-card">
            <div class="chat-avatar">
              ${(this.searchResult.name ?? this.searchResult.username ?? '?')[0].toUpperCase()}
            </div>
            <div class="chat-info">
              <p class="chat-name">${this.searchResult.name ?? this.searchResult.username}</p>
              ${this.searchResult.username ? html`
                <p class="chat-sub">@${this.searchResult.username}</p>
              ` : ''}
            </div>
            <button class="btn-primary"
              @click=${() => this._startDM(this.searchResult.identifier ?? this.searchQuery)}
              ?disabled=${this.isLoading}>
              ${this.isLoading ? html`<span class="spinner"></span>` : 'Start DM'}
            </button>
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
