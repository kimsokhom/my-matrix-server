// Build-time configuration and shared constants.
//
// Leave VITE_BRIDGE_URL empty (the default) so API paths stay relative and hit
// the same-origin auth proxy (server.js in prod, the Vite proxy in dev). Both
// add the provisioning secret server-side, so it is NEVER bundled into the
// client. Only set VITE_BRIDGE_URL if you intentionally bypass the proxy.
export const BRIDGE_URL = import.meta.env.VITE_BRIDGE_URL ?? '';

// NOTE: there is deliberately no PROVISIONING_SECRET here. A static frontend
// cannot keep a secret. The secret lives only on the server (server.js), which
// verifies the user's Matrix OpenID token and injects the secret + verified
// user_id before forwarding to the bridge. See SECURITY.md.

// Dev-only fallback Matrix user ID (used when not embedded in Element).
export const DEV_MATRIX_USER_ID = import.meta.env.VITE_MATRIX_USER_ID ?? '';

// Base URL of your own hosted Element Web. Used only when the widget runs in a
// plain browser tab (not embedded in Element): "Open chat" / "Start DM" then
// deep-links into YOUR Element instance instead of the generic public matrix.to
// page. Leave empty to fall back to matrix.to.
//
// This can be your gateway/nginx URL (which serves Element Web at "/") so users
// stay on the single origin they're already logged into. A trailing slash is
// tolerated — it's stripped here so the "/#/room/<id>" deep link stays clean.
export const ELEMENT_BASE_URL = (import.meta.env.VITE_ELEMENT_BASE_URL ?? '').replace(/\/+$/, '');

// The screens the widget can show.
export const VIEWS = {
  HOME:     'home',
  LOGIN:    'login',
  CONTACTS: 'contacts',
  SEARCH:   'search',
};

// localStorage key for a manually-entered Matrix ID (browser, no Element).
export const STORAGE_KEY = 'telegram_widget_user_id';
