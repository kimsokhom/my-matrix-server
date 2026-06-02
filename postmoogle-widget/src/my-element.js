import { LitElement, html, css } from 'lit';
import * as MatrixWidget from 'matrix-widget-api';

const BACKEND_URL = import.meta.env.VITE_POSTMOOGLE_BACKEND_URL;
const WIDGET_SECRET = import.meta.env.VITE_WIDGET_SECRET;

// Friendly labels for the boolean room options the Settings view can edit.
// Keys must match the backend whitelist (widget_api.go widgetToggleKeys).
const TOGGLE_DEFS = [
  { key: 'threadify',      label: 'Show email body in a thread' },
  { key: 'stripify',       label: 'Strip quotes & signatures from replies' },
  { key: 'nothreads',      label: 'Ignore email threads' },
  { key: 'nohtml',         label: 'Ignore HTML in emails' },
  { key: 'nofiles',        label: 'Ignore attachments' },
  { key: 'noinlines',      label: 'Ignore inline images' },
  { key: 'nocc',           label: 'Hide CC' },
  { key: 'nosubject',      label: 'Hide subject' },
  { key: 'nosender',       label: 'Hide sender' },
  { key: 'norecipient',    label: 'Hide recipient' },
  { key: 'nosend',         label: 'Disable sending' },
  { key: 'noreplies',      label: 'Ignore Matrix replies' },
  { key: 'spamcheck:spf',  label: 'Spam check: SPF' },
  { key: 'spamcheck:dkim', label: 'Spam check: DKIM' },
  { key: 'spamcheck:mx',   label: 'Spam check: MX records' },
  { key: 'spamcheck:rbl',  label: 'Spam check: DNS blocklist (RBL)' },
  { key: 'spamcheck:smtp', label: 'Spam check: SMTP' },
];

export class PostmoogleWidget extends LitElement {
  static properties = {
    view: { type: String },          // 'compose' | 'settings' | 'mailboxes'
    apiStatus: { type: String },
    isLoading: { type: Boolean },
    isSaving: { type: Boolean },
    to: { type: String },
    subject: { type: String },
    body: { type: String },
    notification: { type: Object },
    roomId: { type: String },
    roomInfo: { type: Object },
    settingsAutoreply: { type: String },
    settingsSignature: { type: String },
    settingsToggles: { type: Object },
    mailboxes: { type: Array },
  };

  constructor() {
    super();
    this.view = 'compose';
    this.apiStatus = "Checking Backend...";
    this.isLoading = false;
    this.isSaving = false;
    this.to = "";
    this.subject = "";
    this.body = "";
    this.notification = { message: '', type: '' };
    this.roomInfo = null;
    this.settingsAutoreply = "";
    this.settingsSignature = "";
    this.settingsToggles = {};
    this.mailboxes = [];

    const params = new URLSearchParams(window.location.search);
    this.roomId = params.get('roomId') || params.get('room_id') || '';

    try {
      this.widgetApi = new MatrixWidget.WidgetApi();
      this.widgetApi.requestCapability("org.matrix.msc2762.receive.event");
      this.widgetApi.requestCapability("m.read_state_event");
      this.widgetApi.start();
    } catch (err) {
      console.error("Widget API failed:", err);
    }
  }

  async firstUpdated() {
    try {
      const response = await fetch(`${BACKEND_URL}/api/v1/health`);
      this.apiStatus = response.ok ? "online" : "error";
    } catch (e) {
      this.apiStatus = "offline";
    }
    await this._loadRoomInfo();
  }

  async _loadRoomInfo() {
    if (!this.roomId) return;
    try {
      const res = await fetch(`${BACKEND_URL}/api/v1/room?roomId=${encodeURIComponent(this.roomId)}`, {
        headers: { 'X-Widget-Secret': WIDGET_SECRET },
      });
      if (res.ok) {
        this.roomInfo = await res.json();
        this.settingsAutoreply = this.roomInfo.autoreply || "";
        this.settingsSignature = this.roomInfo.signature || "";
        this.settingsToggles = { ...(this.roomInfo.toggles || {}) };
      }
    } catch (e) {
      console.error("Failed to load room info:", e);
    }
  }

  async _loadMailboxes() {
    try {
      const res = await fetch(`${BACKEND_URL}/api/v1/mailboxes`, {
        headers: { 'X-Widget-Secret': WIDGET_SECRET },
      });
      if (res.ok) {
        const data = await res.json();
        this.mailboxes = data.mailboxes || [];
      }
    } catch (e) {
      console.error("Failed to load mailboxes:", e);
    }
  }

  _switchView(view) {
    this.view = view;
    if (view === 'mailboxes') this._loadMailboxes();
  }

  render() {
    return html`
      <div class="container">
        <header class="header">
          <div class="header-content">
            <span class="icon">📧</span>
            <h1>Postmoogle Dashboard</h1>
          </div>
          <div class="status ${this.apiStatus}">
            <span class="status-dot"></span>
            ${this._getStatusText()}
          </div>
        </header>

        ${this._renderMailboxBanner()}

        <nav class="tabs">
          ${this._tab('compose', '✉️ Compose')}
          ${this._tab('settings', '⚙️ Settings')}
          ${this._tab('mailboxes', '📂 Mailboxes')}
        </nav>

        ${this.notification.message ? html`
          <div class="notification ${this.notification.type}">${this.notification.message}</div>
        ` : ''}

        <main class="main">
          ${this.view === 'compose' ? this._renderCompose() : ''}
          ${this.view === 'settings' ? this._renderSettings() : ''}
          ${this.view === 'mailboxes' ? this._renderMailboxes() : ''}
        </main>
      </div>
    `;
  }

  _tab(id, label) {
    return html`
      <button class="tab ${this.view === id ? 'active' : ''}" @click=${() => this._switchView(id)}>
        ${label}
      </button>
    `;
  }

  _renderCompose() {
    return html`
      <div class="card">
        <h2>Compose Email</h2>
        <div class="form-group">
          <label>Recipient</label>
          <input type="email" placeholder="someone@example.com" .value=${this.to} @input=${e => this.to = e.target.value} ?disabled=${this.isLoading} />
        </div>
        <div class="form-group">
          <label>Subject</label>
          <input type="text" placeholder="Subject" .value=${this.subject} @input=${e => this.subject = e.target.value} ?disabled=${this.isLoading} />
        </div>
        <div class="form-group">
          <label>Message</label>
          <textarea rows="6" placeholder="Type your message..." .value=${this.body} @input=${e => this.body = e.target.value} ?disabled=${this.isLoading}></textarea>
        </div>
        <div class="button-group">
          <button class="btn-primary" @click=${this._sendEmail} ?disabled=${this.isLoading || !this._canSend()}>
            ${this.isLoading ? html`<span class="spinner"></span> Sending...` : 'Send Email'}
          </button>
          <button class="btn-secondary" @click=${this._clearForm} ?disabled=${this.isLoading}>Clear</button>
        </div>
        ${!this._canSend() && !this.isLoading ? html`<p class="hint">${this._sendBlockedReason()}</p>` : ''}
      </div>
    `;
  }

  _renderSettings() {
    if (this.roomInfo && !this.roomInfo.configured) {
      return html`<div class="card"><p class="empty">Configure a mailbox first (<code>!pm mailbox &lt;name&gt;</code>).</p></div>`;
    }
    return html`
      <div class="card">
        <h2>Mailbox Settings</h2>
        <div class="form-group">
          <label>Auto-reply (sent for any new incoming thread)</label>
          <textarea rows="3" placeholder="e.g. Thanks, we'll get back to you soon." .value=${this.settingsAutoreply} @input=${e => this.settingsAutoreply = e.target.value} ?disabled=${this.isSaving}></textarea>
        </div>
        <div class="form-group">
          <label>Signature (appended to outgoing emails)</label>
          <textarea rows="3" placeholder="e.g. -- Rexform Team" .value=${this.settingsSignature} @input=${e => this.settingsSignature = e.target.value} ?disabled=${this.isSaving}></textarea>
        </div>

        <label class="section-label">Options</label>
        <div class="toggles">
          ${TOGGLE_DEFS.map(t => html`
            <label class="toggle">
              <input type="checkbox" .checked=${!!this.settingsToggles[t.key]} @change=${e => this._setToggle(t.key, e.target.checked)} ?disabled=${this.isSaving} />
              <span>${t.label}</span>
            </label>
          `)}
        </div>

        <div class="button-group">
          <button class="btn-primary" @click=${this._saveSettings} ?disabled=${this.isSaving}>
            ${this.isSaving ? html`<span class="spinner"></span> Saving...` : 'Save Settings'}
          </button>
        </div>
      </div>
    `;
  }

  _renderMailboxes() {
    return html`
      <div class="card">
        <h2>Mailboxes</h2>
        ${this.mailboxes.length === 0
          ? html`<p class="empty">No mailboxes found yet.</p>`
          : html`
            <ul class="mailbox-list">
              ${this.mailboxes.map(m => html`
                <li class="mailbox-item">
                  <span class="dot"></span>
                  <span class="addr">${m.address || m.mailbox}</span>
                </li>
              `)}
            </ul>
          `}
      </div>
    `;
  }

  _renderMailboxBanner() {
    if (this.roomInfo && this.roomInfo.configured) {
      return html`
        <div class="mailbox-banner">
          <span class="mailbox-label">Sending as</span>
          <span class="mailbox-address">${this.roomInfo.address}</span>
        </div>`;
    }
    if (this.roomInfo && !this.roomInfo.configured) {
      return html`<div class="mailbox-banner warn">⚠️ This room has no mailbox yet — run <code>!pm mailbox &lt;name&gt;</code> in the chat.</div>`;
    }
    if (!this.roomId) {
      return html`<div class="mailbox-banner warn">⚠️ No room detected. Add the widget with <code>?roomId=$matrix_room_id</code> in its URL.</div>`;
    }
    return '';
  }

  _getStatusText() {
    const map = { online: 'Connected', offline: 'Disconnected', error: 'Server Error' };
    return map[this.apiStatus] || 'Connecting...';
  }

  _isFormValid() {
    return this.to.includes('@') && this.subject.length > 2 && this.body.length > 5;
  }

  _canSend() {
    return this._isFormValid() && !!this.roomId && !!(this.roomInfo && this.roomInfo.configured);
  }

  _sendBlockedReason() {
    if (!this.roomId) return "No room detected — check the widget URL.";
    if (this.roomInfo && !this.roomInfo.configured) return "Configure a mailbox with !pm mailbox first.";
    if (!this._isFormValid()) return "Fill in a valid recipient, subject, and message.";
    return "";
  }

  _clearForm() { this.to = ""; this.subject = ""; this.body = ""; }

  _setToggle(key, value) {
    this.settingsToggles = { ...this.settingsToggles, [key]: value };
  }

  async _sendEmail() {
    this.isLoading = true;
    try {
      const res = await fetch(`${BACKEND_URL}/api/v1/send`, {
        method: 'POST',
        headers: { 'X-Widget-Secret': WIDGET_SECRET, 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId: this.roomId, to: this.to, subject: this.subject, body: this.body })
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok) {
        this._showNotification(data.queued ? `Queued for delivery to ${this.to} (will retry).` : `Email sent to ${this.to} ✅`, 'success');
        this._clearForm();
      } else {
        this._showNotification(data.error ? `Failed: ${data.error}` : 'Server rejected the request', 'error');
      }
    } catch (err) {
      this._showNotification('Connection failed', 'error');
    } finally {
      this.isLoading = false;
    }
  }

  async _saveSettings() {
    this.isSaving = true;
    try {
      const res = await fetch(`${BACKEND_URL}/api/v1/settings`, {
        method: 'POST',
        headers: { 'X-Widget-Secret': WIDGET_SECRET, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId: this.roomId,
          autoreply: this.settingsAutoreply,
          signature: this.settingsSignature,
          toggles: this.settingsToggles,
        })
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok) {
        this._showNotification('Settings saved ✅', 'success');
        await this._loadRoomInfo();
      } else {
        this._showNotification(data.error ? `Failed: ${data.error}` : 'Could not save settings', 'error');
      }
    } catch (err) {
      this._showNotification('Connection failed', 'error');
    } finally {
      this.isSaving = false;
    }
  }

  _showNotification(message, type) {
    this.notification = { message, type };
    setTimeout(() => { this.notification = { message: '', type: '' }; }, 5000);
  }

  static styles = css`
    * { box-sizing: border-box; margin: 0; padding: 0; }

    :host {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      display: block; min-height: 100vh; background: #f3f8f6;
    }

    .container { max-width: 600px; margin: 0 auto; padding: 20px; min-height: 100vh; display: flex; flex-direction: column; }

    .header { background: white; border-radius: 12px; padding: 20px; margin-bottom: 16px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
    .header-content { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; }
    .icon { font-size: 2rem; }
    h1 { font-size: 1.5rem; color: #17191c; font-weight: 600; }

    .status { display: inline-flex; align-items: center; gap: 8px; padding: 6px 12px; border-radius: 20px; font-size: 0.875rem; font-weight: 500; }
    .status.online { background: #e8f5f0; color: #03b381; }
    .status.offline { background: #fee; color: #d32f2f; }
    .status.error { background: #fff8e1; color: #f57c00; }
    .status-dot { width: 8px; height: 8px; border-radius: 50%; background: currentColor; animation: pulse 2s infinite; }
    @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }

    .mailbox-banner { background: white; border-left: 4px solid #03b381; border-radius: 8px; padding: 12px 16px; margin-bottom: 16px; box-shadow: 0 2px 8px rgba(0,0,0,0.06); display: flex; align-items: center; gap: 8px; font-size: 0.9rem; }
    .mailbox-banner.warn { border-left-color: #f57c00; color: #8a5200; background: #fff8e1; }
    .mailbox-label { color: #737780; }
    .mailbox-address { font-weight: 600; color: #17191c; }
    .mailbox-banner code, .empty code { background: rgba(0,0,0,0.06); padding: 2px 6px; border-radius: 4px; font-size: 0.85em; }

    .tabs { display: flex; gap: 8px; margin-bottom: 16px; }
    .tab { flex: 1; padding: 10px; border: none; border-radius: 8px; background: white; color: #525760; font-size: 0.9rem; font-weight: 600; cursor: pointer; box-shadow: 0 2px 8px rgba(0,0,0,0.06); transition: all 0.15s; }
    .tab:hover { color: #17191c; }
    .tab.active { background: #03b381; color: white; }

    .main { flex: 1; }
    .card { background: white; border-radius: 12px; padding: 24px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
    h2 { font-size: 1.25rem; color: #17191c; margin-bottom: 20px; font-weight: 600; }

    .form-group { margin-bottom: 20px; }
    label { display: block; margin-bottom: 8px; font-weight: 500; color: #525760; font-size: 0.875rem; }
    .section-label { margin-top: 4px; margin-bottom: 12px; font-weight: 600; color: #17191c; }

    input[type="email"], input[type="text"], textarea {
      width: 100%; padding: 12px; border: 2px solid #e1e3e6; border-radius: 8px;
      font-size: 1rem; transition: all 0.2s; font-family: inherit; background: #fafafa; color: #17191c;
    }
    input:focus, textarea:focus { outline: none; border-color: #03b381; background: white; box-shadow: 0 0 0 3px rgba(3,179,129,0.1); }
    input:disabled, textarea:disabled { background: #f5f5f5; cursor: not-allowed; opacity: 0.6; }
    input::placeholder, textarea::placeholder { color: #8d97a5; }
    textarea { resize: vertical; }

    .toggles { display: grid; grid-template-columns: 1fr 1fr; gap: 10px 16px; margin-bottom: 8px; }
    .toggle { display: flex; align-items: center; gap: 8px; font-size: 0.85rem; color: #2c2f33; font-weight: 400; margin: 0; cursor: pointer; }
    .toggle input { width: 16px; height: 16px; accent-color: #03b381; cursor: pointer; }

    .button-group { display: flex; gap: 12px; margin-top: 24px; }
    button.btn-primary, button.btn-secondary { flex: 1; padding: 12px 24px; border: none; border-radius: 8px; font-size: 1rem; font-weight: 600; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; justify-content: center; gap: 8px; }
    .btn-primary { background: #03b381; color: white; }
    .btn-primary:hover:not(:disabled) { background: #039770; transform: translateY(-1px); box-shadow: 0 4px 12px rgba(3,179,129,0.3); }
    .btn-secondary { background: #e1e3e6; color: #525760; }
    .btn-secondary:hover:not(:disabled) { background: #d1d4d8; }
    button:disabled { opacity: 0.6; cursor: not-allowed; transform: none !important; }

    .spinner { width: 16px; height: 16px; border: 2px solid rgba(255,255,255,0.3); border-top-color: white; border-radius: 50%; animation: spin 0.6s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }

    .hint { margin-top: 12px; font-size: 0.8rem; color: #f57c00; text-align: center; }
    .empty { color: #737780; text-align: center; padding: 12px; }

    .mailbox-list { list-style: none; }
    .mailbox-item { display: flex; align-items: center; gap: 10px; padding: 12px; border-bottom: 1px solid #eef0f2; font-size: 0.95rem; color: #17191c; }
    .mailbox-item:last-child { border-bottom: none; }
    .mailbox-item .dot { width: 8px; height: 8px; border-radius: 50%; background: #03b381; flex-shrink: 0; }
    .mailbox-item .addr { font-family: monospace; }

    .notification { padding: 12px; margin-bottom: 16px; border-radius: 8px; text-align: center; font-weight: 500; animation: fadeIn 0.3s; }
    .notification.success { background: #e8f5f0; color: #03b381; border: 1px solid #03b381; }
    .notification.error { background: #fee; color: #d32f2f; border: 1px solid #d32f2f; }
    @keyframes fadeIn { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }

    @media (max-width: 640px) {
      .container { padding: 12px; }
      .toggles { grid-template-columns: 1fr; }
      .button-group { flex-direction: column; }
    }
  `;
}

customElements.define('postmoogle-widget', PostmoogleWidget);
