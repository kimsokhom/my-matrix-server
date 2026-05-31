import { css } from 'lit';

// All component styles live here so telegram-widget.js stays focused on logic.
// Design tokens (CSS custom properties) on :host are the single source of truth
// for spacing, radius, color, type and shadow — change them once, not in 40
// places. Everything below references the tokens.
export const styles = css`
  *, *::before, *::after {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }

  :host {
    /* spacing scale (4 / 8 / 12 / 16 / 24 / 32) */
    --space-1: 4px;
    --space-2: 8px;
    --space-3: 12px;
    --space-4: 16px;
    --space-5: 24px;
    --space-6: 32px;

    /* radius */
    --radius-sm: 8px;
    --radius-md: 12px;
    --radius-lg: 16px;
    --radius-pill: 999px;

    /* color */
    --c-brand:        #2AABEE;
    --c-brand-strong: #1e96d8;
    --c-brand-soft:   #f0f9ff;
    --c-bg:           #f0f4f8;
    --c-surface:      #ffffff;
    --c-text:         #17191c;
    --c-muted:        #737780;
    --c-subtle:       #a0aab4;
    --c-border:       #e8edf2;
    --c-border-input: #e2e8f0;
    --c-danger:       #d32f2f;
    --c-danger-strong:#b71c1c;
    --c-danger-soft:  #fff5f5;
    --c-success:      #03b381;

    /* type scale */
    --fs-xs:  0.78rem;
    --fs-sm:  0.875rem;
    --fs-md:  0.95rem;
    --fs-lg:  1.05rem;
    --fs-xl:  1.15rem;
    --fs-2xl: 1.3rem;

    /* shadow */
    --shadow-card: 0 1px 3px rgba(16, 24, 40, 0.06), 0 1px 2px rgba(16, 24, 40, 0.04);
    --shadow-pop:  0 12px 40px rgba(16, 24, 40, 0.22);
    --ring:        0 0 0 3px rgba(42, 171, 238, 0.30);

    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    display: block;
    min-height: 100vh;
    background: var(--c-bg);
    color: var(--c-text);
    line-height: 1.5;
  }

  /* ── Layout ── */
  .container {
    max-width: 520px;
    margin: 0 auto;
    padding: clamp(12px, 4vw, 20px);
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  /* ── Header ── */
  .header {
    background: var(--c-surface);
    border-radius: var(--radius-md);
    padding: var(--space-4);
    box-shadow: var(--shadow-card);
  }

  .header-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
    margin-bottom: var(--space-3);
  }

  .brand {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    min-width: 0;
  }

  .brand-icon {
    background: var(--c-brand);
    color: #fff;
    border-radius: var(--radius-sm);
    width: 38px;
    height: 38px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }
  .brand-icon svg { width: 20px; height: 20px; }

  h1 {
    font-size: var(--fs-xl);
    font-weight: 700;
    color: var(--c-text);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .btn-back {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
    background: var(--c-bg);
    border: none;
    border-radius: var(--radius-sm);
    padding: var(--space-2) var(--space-3) var(--space-2) var(--space-2);
    font-size: var(--fs-sm);
    color: var(--c-muted);
    cursor: pointer;
    font-weight: 600;
    flex-shrink: 0;
    transition: background 0.15s;
  }
  .btn-back:hover { background: #e2e8f0; }
  .btn-back svg { width: 16px; height: 16px; }

  /* ── Status badge ── */
  .status-badge {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-1) var(--space-3);
    border-radius: var(--radius-pill);
    font-size: var(--fs-xs);
    font-weight: 600;
    letter-spacing: 0.01em;
  }

  .status-badge.connected    { background: #e8f5f0; color: var(--c-success); }
  .status-badge.disconnected { background: #f1f3f5; color: var(--c-muted); }
  .status-badge.checking     { background: #e8f0ff; color: #2B7EDB; }
  .status-badge.error        { background: #fff0f0; color: var(--c-danger); }

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
    background: var(--c-surface);
    border-radius: var(--radius-md);
    padding: var(--space-5);
    box-shadow: var(--shadow-card);
  }

  .center-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-4);
    padding: var(--space-6) var(--space-5);
  }

  /* ── Profile card ── */
  .profile-card {
    display: flex;
    align-items: center;
    gap: var(--space-4);
    padding: var(--space-4) var(--space-5);
  }

  .avatar {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    background: var(--c-brand);
    color: #fff;
    font-size: var(--fs-xl);
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .profile-info { min-width: 0; }

  .profile-name {
    font-weight: 700;
    font-size: var(--fs-md);
    color: var(--c-text);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .profile-sub {
    font-size: var(--fs-sm);
    color: var(--c-muted);
    margin-top: 2px;
  }

  /* ── Action grid ── */
  .action-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: var(--space-3);
  }

  .action-btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-4) var(--space-2);
    background: var(--c-surface);
    border: 1.5px solid var(--c-border);
    border-radius: var(--radius-md);
    cursor: pointer;
    font-size: var(--fs-sm);
    font-weight: 600;
    color: var(--c-text);
    transition: border-color 0.15s, background 0.15s, transform 0.15s;
  }

  .action-btn:hover:not(:disabled) {
    border-color: var(--c-brand);
    background: var(--c-brand-soft);
    transform: translateY(-2px);
  }

  .action-btn--danger { color: var(--c-danger); }
  .action-btn--danger:hover:not(:disabled) {
    border-color: var(--c-danger);
    background: var(--c-danger-soft);
  }

  .action-btn:disabled { opacity: 0.5; cursor: not-allowed; }

  .action-icon { display: inline-flex; align-items: center; justify-content: center; }
  .action-icon svg { width: 22px; height: 22px; }

  /* ── Welcome card ── */
  .welcome-card {
    text-align: center;
    padding: var(--space-6) var(--space-5);
  }

  .welcome-icon {
    background: var(--c-brand);
    color: #fff;
    width: 64px;
    height: 64px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0 auto var(--space-4);
  }
  .welcome-icon svg { width: 30px; height: 30px; }

  .welcome-card h2 {
    font-size: var(--fs-2xl);
    font-weight: 700;
    margin-bottom: var(--space-2);
  }

  .welcome-desc {
    color: var(--c-muted);
    font-size: var(--fs-md);
    line-height: 1.6;
    margin-bottom: var(--space-5);
  }

  .error-hint {
    margin-top: var(--space-3);
    font-size: var(--fs-xs);
    color: var(--c-danger);
  }

  /* ── Login wizard ── */
  .step-instructions {
    font-size: var(--fs-md);
    color: var(--c-muted);
    margin-bottom: var(--space-5);
    line-height: 1.55;
  }

  /* ── Flow chooser ── */
  .flow-list { display: flex; flex-direction: column; gap: var(--space-3); }

  .flow-btn {
    display: flex;
    align-items: center;
    gap: var(--space-4);
    width: 100%;
    text-align: left;
    padding: var(--space-3) var(--space-4);
    background: var(--c-surface);
    border: 1.5px solid var(--c-border);
    border-radius: var(--radius-md);
    cursor: pointer;
    transition: border-color 0.15s, background 0.15s, transform 0.15s;
  }
  .flow-btn:hover:not(:disabled) {
    border-color: var(--c-brand);
    background: var(--c-brand-soft);
    transform: translateY(-1px);
  }
  .flow-btn:disabled { opacity: 0.55; cursor: not-allowed; }

  .flow-icon { display: inline-flex; flex-shrink: 0; color: var(--c-brand); }
  .flow-icon svg { width: 24px; height: 24px; }
  .flow-text { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
  .flow-name { font-weight: 700; font-size: var(--fs-md); color: var(--c-text); }
  .flow-desc { font-size: var(--fs-xs); color: var(--c-muted); }

  /* ── QR / display-and-wait ── */
  .qr-wrap {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-4);
    padding: var(--space-2) 0;
  }
  .qr-img {
    width: min(220px, 70vw);
    height: min(220px, 70vw);
    border-radius: var(--radius-md);
    border: 1px solid var(--c-border);
    background: #fff;
  }
  .qr-fallback {
    display: block;
    word-break: break-all;
    max-width: 100%;
    padding: var(--space-3);
  }
  .qr-status {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    font-size: var(--fs-md);
    font-weight: 600;
    color: #2B7EDB;
  }

  /* ── Form ── */
  .form-group { margin-bottom: var(--space-4); }

  label {
    display: block;
    font-weight: 600;
    font-size: var(--fs-sm);
    color: #525760;
    margin-bottom: var(--space-2);
  }

  input[type="tel"],
  input[type="text"],
  input[type="email"],
  input[type="password"] {
    width: 100%;
    padding: var(--space-3) var(--space-4);
    border: 1.5px solid var(--c-border-input);
    border-radius: var(--radius-sm);
    font-size: var(--fs-md);
    font-family: inherit;
    background: #fafbfc;
    color: var(--c-text);
    transition: border-color 0.15s, background 0.15s, box-shadow 0.15s;
  }

  input:focus {
    outline: none;
    border-color: var(--c-brand);
    background: #fff;
    box-shadow: var(--ring);
  }

  input:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    background: #f5f5f5;
  }

  input::placeholder { color: var(--c-subtle); }

  .field-hint {
    font-size: var(--fs-xs);
    color: var(--c-subtle);
    margin-top: var(--space-2);
  }

  /* ── Buttons ── */
  .btn-primary,
  .btn-secondary,
  .btn-danger {
    border: none;
    border-radius: var(--radius-sm);
    font-size: var(--fs-md);
    font-weight: 700;
    padding: var(--space-3) var(--space-5);
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-2);
    transition: background 0.15s, transform 0.15s, box-shadow 0.15s;
    font-family: inherit;
  }

  .btn-primary { background: var(--c-brand); color: #fff; }
  .btn-primary:hover:not(:disabled) {
    background: var(--c-brand-strong);
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(42,171,238,0.3);
  }

  .btn-secondary { background: var(--c-bg); color: #525760; }
  .btn-secondary:hover:not(:disabled) { background: #e2e8f0; }

  .btn-danger { background: var(--c-danger); color: #fff; }
  .btn-danger:hover:not(:disabled) {
    background: var(--c-danger-strong);
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(211,47,47,0.3);
  }

  button:disabled { opacity: 0.55; cursor: not-allowed; transform: none !important; }

  .full-width { width: 100%; }

  /* ── Modal ── */
  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(16, 24, 40, 0.45);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--space-5);
    z-index: 100;
    animation: fadeIn 0.15s ease;
  }

  .modal-card {
    background: var(--c-surface);
    border-radius: var(--radius-md);
    padding: var(--space-5);
    max-width: 380px;
    width: 100%;
    box-shadow: var(--shadow-pop);
  }

  .modal-card h2 { margin-bottom: var(--space-2); }

  .modal-actions {
    display: flex;
    gap: var(--space-3);
    margin-top: var(--space-5);
  }
  .modal-actions button { flex: 1; }

  @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

  /* ── Section header ── */
  .section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
    margin-bottom: var(--space-4);
  }

  .section-header h2 { font-size: var(--fs-lg); font-weight: 700; }

  .btn-icon {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-2) var(--space-3);
    background: var(--c-bg);
    border: none;
    border-radius: var(--radius-sm);
    font-size: var(--fs-sm);
    font-weight: 600;
    color: #525760;
    cursor: pointer;
    flex-shrink: 0;
    transition: background 0.15s;
  }
  .btn-icon:hover:not(:disabled) { background: #e2e8f0; }
  .btn-icon svg { width: 15px; height: 15px; }

  /* ── Chat / contact list (shared with search results) ── */
  .chat-list { display: flex; flex-direction: column; gap: var(--space-3); }

  .chat-item {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-3);
    border: 1px solid var(--c-border);
    border-radius: var(--radius-sm);
    transition: background 0.1s;
  }
  .chat-item:hover { background: #f8fafc; }

  .chat-avatar {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: var(--c-brand);
    color: #fff;
    font-weight: 700;
    font-size: var(--fs-md);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .chat-info { flex: 1; min-width: 0; }

  .chat-name {
    font-weight: 600;
    font-size: var(--fs-md);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .chat-sub {
    font-size: var(--fs-xs);
    color: var(--c-muted);
    margin-top: 2px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .btn-open {
    padding: var(--space-2) var(--space-3);
    background: var(--c-brand-soft);
    color: var(--c-brand);
    border: none;
    border-radius: var(--radius-sm);
    font-size: var(--fs-xs);
    font-weight: 700;
    cursor: pointer;
    white-space: nowrap;
    flex-shrink: 0;
    transition: background 0.15s;
  }
  .btn-open:hover:not(:disabled) { background: #dbeeff; }

  /* ── Empty state ── */
  .empty-state {
    text-align: center;
    padding: var(--space-6) 0;
    color: var(--c-muted);
    font-size: var(--fs-md);
    line-height: 1.6;
  }

  /* ── Search ── */
  .search-row {
    display: flex;
    gap: var(--space-3);
    margin-bottom: var(--space-4);
  }

  .search-row input { flex: 1; min-width: 0; }

  .result-card {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-4);
    border: 1.5px solid #e8f5ff;
    border-radius: var(--radius-sm);
    background: #f8fafc;
  }

  /* ── Notification ── */
  .notification {
    padding: var(--space-3) var(--space-4);
    border-radius: var(--radius-sm);
    font-weight: 600;
    font-size: var(--fs-md);
    animation: slideDown 0.25s ease;
  }

  .notification.success { background: #e8f5f0; color: var(--c-success); border: 1px solid #c6eed8; }
  .notification.error   { background: #fff0f0; color: var(--c-danger);  border: 1px solid #ffc5c5; }

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
  .spinner-sm { width: 14px; height: 14px; border-width: 2px; color: #525760; border-color: #d1d5db; border-top-color: var(--c-brand); }
  .spinner-lg { width: 32px; height: 32px; border-width: 3px; color: var(--c-brand); border-color: #d1d5db; border-top-color: var(--c-brand); }

  @keyframes spin { to { transform: rotate(360deg); } }

  /* ── Misc ── */
  .muted { color: var(--c-muted); font-size: var(--fs-md); }

  h2 { font-size: var(--fs-lg); font-weight: 700; color: var(--c-text); }

  code {
    background: var(--c-bg);
    padding: 2px 6px;
    border-radius: var(--radius-sm);
    font-size: 0.875em;
  }

  /* ── Accessibility: visible keyboard focus on all interactive elements ── */
  button:focus-visible,
  input:focus-visible,
  .flow-btn:focus-visible,
  .action-btn:focus-visible {
    outline: none;
    box-shadow: var(--ring);
  }

  /* ── Responsive ── */
  @media (max-width: 600px) {
    .card { padding: var(--space-4); }
    .welcome-card, .center-card { padding: var(--space-5) var(--space-4); }
  }

  @media (max-width: 420px) {
    /* Two columns so labels never clip; Disconnect spans the full width. */
    .action-grid { grid-template-columns: 1fr 1fr; }
    .action-btn--danger { grid-column: 1 / -1; flex-direction: row; }
    .search-row { flex-direction: column; }
    .search-row .btn-primary { width: 100%; }
    .chat-item, .result-card { flex-wrap: wrap; }
    .chat-info { flex-basis: 60%; }
  }

  /* ── Respect reduced-motion preference ── */
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after {
      animation-duration: 0.001ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.001ms !important;
    }
    .action-btn:hover:not(:disabled),
    .flow-btn:hover:not(:disabled),
    .btn-primary:hover:not(:disabled),
    .btn-danger:hover:not(:disabled) { transform: none; }
  }
`;
