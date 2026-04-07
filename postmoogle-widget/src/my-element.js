import { LitElement, html, css } from 'lit';
import * as MatrixWidget from 'matrix-widget-api';

const BACKEND_URL = import.meta.env.VITE_POSTMOOGLE_BACKEND_URL;
const WIDGET_SECRET = import.meta.env.VITE_WIDGET_SECRET;

export class PostmoogleWidget extends LitElement {
  static properties = {
    apiStatus: { type: String },
    isLoading: { type: Boolean },
    to: { type: String },
    subject: { type: String },
    body: { type: String },
    notification: { type: Object } // Added for non-alert feedback
  };

  constructor() {
    super();
    this.apiStatus = "Checking Backend...";
    this.isLoading = false;
    this.to = "";
    this.subject = "";
    this.body = "";
    this.notification = { message: '', type: '' };

    try {
      this.widgetApi = new MatrixWidget.WidgetApi();
      // Capabilities needed to read room context later
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

        ${this.notification.message ? html`
          <div class="notification ${this.notification.type}">
            ${this.notification.message}
          </div>
        ` : ''}

        <main class="main">
          <div class="form-card">
            <h2>Compose Email</h2>
            
            <div class="form-group">
              <label>Recipient</label>
              <input type="email" placeholder="boss@example.com" .value=${this.to} @input=${e => this.to = e.target.value} ?disabled=${this.isLoading} />
            </div>

            <div class="form-group">
              <label>Subject</label>
              <input type="text" placeholder="Project Update" .value=${this.subject} @input=${e => this.subject = e.target.value} ?disabled=${this.isLoading} />
            </div>

            <div class="form-group">
              <label>Message</label>
              <textarea rows="6" placeholder="Type your message..." .value=${this.body} @input=${e => this.body = e.target.value} ?disabled=${this.isLoading}></textarea>
            </div>

            <div class="button-group">
              <button class="btn-primary" @click=${this._sendEmail} ?disabled=${this.isLoading || !this._isFormValid()}>
                ${this.isLoading ? html`<span class="spinner"></span>` : 'Send Email'}
              </button>
              <button class="btn-secondary" @click=${this._clearForm} ?disabled=${this.isLoading}>Clear</button>
            </div>
          </div>
        </main>
      </div>
    `;
  }

  _getStatusText() {
    const map = { online: 'Connected', offline: 'Disconnected', error: 'Server Error' };
    return map[this.apiStatus] || 'Connecting...';
  }

  _isFormValid() {
    return this.to.includes('@') && this.subject.length > 2 && this.body.length > 5;
  }

  _clearForm() {
    this.to = ""; this.subject = ""; this.body = "";
  }

  async _sendEmail() {
    this.isLoading = true;

    try {
      const res = await fetch(`${BACKEND_URL}/api/v1/send`, {
        method: 'POST',
        headers: {
          'X-Widget-Secret': WIDGET_SECRET,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ to: this.to, subject: this.subject, body: this.body })
      });

      if (res.ok) {
        this._showNotification('Email sent to queue!', 'success');
        this._clearForm();
      } else {
        this._showNotification('Server rejected request', 'error');
      }
    } catch (err) {
      this._showNotification('Connection failed', 'error');
    } finally {
      this.isLoading = false;
    }
  }

  _showNotification(message, type) {
    this.notification = { message, type };
    setTimeout(() => { this.notification = { message: '', type: '' }; }, 4000);
  }

  static styles = css`
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    :host {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      display: block;
      min-height: 100vh;
      background: #f3f8f6;
    }

    .container {
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
    }

    .header {
      background: white;
      border-radius: 12px;
      padding: 20px;
      margin-bottom: 20px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
    }

    .header-content {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 12px;
    }

    .icon {
      font-size: 2rem;
    }

    h1 {
      font-size: 1.5rem;
      color: #17191c;
      font-weight: 600;
    }

    .status {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 6px 12px;
      border-radius: 20px;
      font-size: 0.875rem;
      font-weight: 500; 
    }

    .status.online {
      background: #e8f5f0;
      color: #03b381;
    }

    .status.offline {
      background: #fee;
      color: #d32f2f;
    }

    .status.error {
      background: #fff8e1;
      color: #f57c00;
    }

    .status-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: currentColor;
      animation: pulse 2s infinite;
    }

    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }

    .main {
      flex: 1;
    }

    .form-card {
      background: white;
      border-radius: 12px;
      padding: 24px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
    }

    h2 {
      font-size: 1.25rem;
      color: #17191c;
      margin-bottom: 20px;
      font-weight: 600;
    }

    .form-group {
      margin-bottom: 20px;
    }

    label {
      display: block;
      margin-bottom: 8px;
      font-weight: 500;
      color: #525760;
      font-size: 0.875rem;
    }

    input[type="email"],
    input[type="text"],
    textarea {
      width: 100%;
      padding: 12px;
      border: 2px solid #e1e3e6;
      border-radius: 8px;
      font-size: 1rem;
      transition: all 0.2s;
      font-family: inherit;
      background: #fafafa;
      color: #17191c;
    }

    input[type="email"]:focus,
    input[type="text"]:focus,
    textarea:focus {
      outline: none;
      border-color: #03b381;
      background: white;
      box-shadow: 0 0 0 3px rgba(3, 179, 129, 0.1);
    }

    input:disabled,
    textarea:disabled {
      background: #f5f5f5;
      cursor: not-allowed;
      opacity: 0.6;
    }

    input::placeholder,
    textarea::placeholder {
      color: #8d97a5;
    }

    textarea {
      resize: vertical;
      min-height: 120px;
    }

    .button-group {
      display: flex;
      gap: 12px;
      margin-top: 24px;
    }

    button {
      flex: 1;
      padding: 12px 24px;
      border: none;
      border-radius: 8px;
      font-size: 1rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
    }

    .btn-primary {
      background: #03b381;
      color: white;
    }

    .btn-primary:hover:not(:disabled) {
      background: #039770;
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(3, 179, 129, 0.3);
    }

    .btn-secondary {
      background: #e1e3e6;
      color: #525760;
    }

    .btn-secondary:hover:not(:disabled) {
      background: #d1d4d8;
    }

    button:disabled {
      opacity: 0.6;
      cursor: not-allowed;
      transform: none !important;
    }

    .spinner {
      width: 16px;
      height: 16px;
      border: 2px solid rgba(255, 255, 255, 0.3);
      border-top-color: white;
      border-radius: 50%;
      animation: spin 0.6s linear infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    .footer {
      text-align: center;
      padding: 20px;
      color: #737780;
      font-size: 0.875rem;
    }

    @media (max-width: 640px) {
      .container {
        padding: 12px;
      }

      .button-group {
        flex-direction: column;
      }

      button {
        width: 100%;
      }
    }

    .notification {
      padding: 12px;
      margin-bottom: 20px;
      border-radius: 8px;
      text-align: center;
      font-weight: 500;
      animation: fadeIn 0.3s;
    }
    .notification.success { background: #e8f5f0; color: #03b381; border: 1px solid #03b381; }
    .notification.error { background: #fee; color: #d32f2f; border: 1px solid #d32f2f; }
    @keyframes fadeIn { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }
  `;
}

customElements.define('postmoogle-widget', PostmoogleWidget);