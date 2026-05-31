import { defineConfig, loadEnv } from 'vite'

// The dev server mirrors what server.js does in production: the client calls the
// same-origin relative path /_matrix/provision/*, and the proxy injects the
// provisioning secret server-side so it is never present in the browser.
//
// Difference from prod: there is no Element host locally to issue an OpenID
// token, so the dev proxy does NOT verify identity — it simply forwards with the
// secret, and the client sends ?user_id= from the manually-entered ID. This is a
// local-only convenience; production identity is always OpenID-verified.
export default defineConfig(({ mode }) => {
  if (mode !== 'development') return {}

  // Empty prefix → load all vars (including the non-VITE_ secret). loadEnv keeps
  // PROVISIONING_SECRET on the Node side; it is never exposed to the client.
  const env = loadEnv(mode, process.cwd(), '')

  // Keep VITE_BRIDGE_URL empty in dev so client calls stay relative; the proxy
  // target comes from BRIDGE_INTERNAL_URL (same var name as production).
  const target = env.BRIDGE_INTERNAL_URL || env.VITE_BRIDGE_URL
  if (!target) return {}

  return {
    server: {
      proxy: {
        '/_matrix/provision': {
          target,
          changeOrigin: true,
          secure: true,
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq) => {
              if (env.PROVISIONING_SECRET) {
                proxyReq.setHeader('Authorization', env.PROVISIONING_SECRET)
              }
            })
          },
        },
      },
    },
  }
})
