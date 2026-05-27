import { defineConfig } from 'vite'

// Proxy is only active during `npm run dev`.
// In production the widget calls VITE_BRIDGE_URL directly.
export default defineConfig(({ mode }) => {
  if (mode !== 'development') return {}

  const bridgeUrl = process.env.VITE_BRIDGE_URL
  if (!bridgeUrl) return {}

  return {
    server: {
      proxy: {
        '/_matrix/provision': {
          target: bridgeUrl,
          changeOrigin: true,
          secure: true,
        },
      },
    },
  }
})
