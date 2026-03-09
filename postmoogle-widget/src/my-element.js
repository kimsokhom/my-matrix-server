import { LitElement, html, css } from 'lit';
// We import everything as 'MatrixWidget' to ensure we find the classes
import * as MatrixWidget from 'matrix-widget-api';

export class PostmoogleWidget extends LitElement {
  static properties = {
    apiStatus: { type: String },
  };

  constructor() {
    super();
    this.apiStatus = "Checking Backend...";

    try {
      // 1. Initialize the Widget API using the namespace
      this.widgetApi = new MatrixWidget.WidgetApi();

      // 2. Request permissions
      // If the enum is undefined, we use the raw strings which always work
      this.widgetApi.requestCapability("org.matrix.msc2762.receive.event");
      this.widgetApi.requestCapability("m.read_state_event");

      this.widgetApi.start();
      console.log("Widget API Started Successfully");
    } catch (err) {
      console.error("Widget API failed to start:", err);
    }
  }

  async firstUpdated() {
    // 3. Test connection to your Backend API
    // Replace this URL with your actual Railway Bridge domain!
    const BACKEND_URL = 'https://postmoogle-bridge-kim-sokhom-matrix-email-bridge.up.railway.app';

    try {
      const response = await fetch(`${BACKEND_URL}/api/v1/health`);
      if (response.ok) {
        this.apiStatus = "✅ Backend Online";
      } else {
        this.apiStatus = "⚠️ Backend Error";
      }
    } catch (e) {
      this.apiStatus = "❌ Cannot Reach Backend";
    }
  }

  render() {
    return html`
      <div class="card">
        <h2>📧 Postmoogle Dashboard</h2>
        <div class="status-bar">
            Status: <strong>${this.apiStatus}</strong>
        </div>
        <hr>
        <div class="actions">
            <p>Ready to send an email via the Bridge API?</p>
            <button @click=${this._sendTestEmail}>Send Test Email</button>
        </div>
      </div>
    `;
  }

  async _sendTestEmail() {
    const BACKEND_URL = 'https://postmoogle-bridge-kim-sokhom-matrix-email-bridge.up.railway.app';

    try {
      const res = await fetch(`${BACKEND_URL}/api/v1/send`, {
        method: 'POST',
        headers: {
          'X-Widget-Secret': 'ChooseAComplexPassword123',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          to: "test@example.com",
          subject: "Sent from Matrix Widget",
          body: "Hello! This was sent via the custom Lit UI."
        })
      });

      if (res.ok) {
        alert("Success: Email Queued by Bridge!");
      } else {
        alert("Failed: Check Backend Logs");
      }
    } catch (err) {
      alert("Error: Could not connect to API");
    }
  }

  static styles = css`
    :host { 
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
        display: block; 
        color: #333;
    }
    .card { 
        border: 1px solid #ddd; 
        padding: 20px; 
        background: white; 
        border-radius: 12px;
        box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    }
    h2 { margin-top: 0; color: #0dbd8b; }
    .status-bar { 
        background: #f8f9fa; 
        padding: 8px; 
        border-radius: 4px; 
        font-size: 0.9rem; 
    }
    button { 
        background: #0dbd8b; 
        color: white; 
        border: none; 
        padding: 12px 20px; 
        border-radius: 6px; 
        cursor: pointer; 
        font-weight: bold;
        transition: background 0.2s;
    }
    button:hover {
        background: #09a377;
    }
    hr { border: 0; border-top: 1px solid #eee; margin: 20px 0; }
  `;
}

customElements.define('postmoogle-widget', PostmoogleWidget);