// Build-time configuration and shared constants.
//
// In dev, leave VITE_BRIDGE_URL empty so API paths stay relative and the Vite
// proxy (see vite.config.js) forwards them to the bridge. In production, set
// VITE_BRIDGE_URL to the full Railway URL of the mautrix-telegram bridge.
export const BRIDGE_URL = import.meta.env.VITE_BRIDGE_URL ?? '';

// The provisioning.shared_secret from the bridge config.yaml. Sent as the
// bare `Authorization` header value on every provisioning request.
export const PROVISIONING_SECRET = import.meta.env.VITE_PROVISIONING_SECRET;

// Dev-only fallback Matrix user ID (used when not embedded in Element).
export const DEV_MATRIX_USER_ID = import.meta.env.VITE_MATRIX_USER_ID ?? '';

// The screens the widget can show.
export const VIEWS = {
  HOME:     'home',
  LOGIN:    'login',
  CONTACTS: 'contacts',
  SEARCH:   'search',
};

// localStorage key for a manually-entered Matrix ID (browser, no Element).
export const STORAGE_KEY = 'telegram_widget_user_id';
