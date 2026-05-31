# Stage 1: build the static widget bundle.
# VITE_* build-time vars are injected by the platform (Railway) during this step.
# The provisioning SECRET is intentionally NOT a VITE_ var, so it is never bundled
# into the client — it is read at runtime by server.js instead.
FROM node:20-slim AS builder

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

# Stage 2: serve dist/ AND run the auth proxy (server.js).
# The proxy verifies each user's Matrix OpenID token and injects the secret +
# verified user_id server-side before forwarding to the bridge. See SECURITY.md.
FROM node:20-slim

WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
RUN npm install --omit=dev

COPY server.js ./
COPY --from=builder /app/dist ./dist

# Runtime config provided as env vars by the platform:
#   PROVISIONING_SECRET, BRIDGE_INTERNAL_URL, HOMESERVER_NAME
CMD ["node", "server.js"]
