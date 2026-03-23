#!/bin/sh
# =============================================================================
# deploy.sh — Sets Railway service variables after tofu apply
# =============================================================================
# Called automatically by the CI pipeline.
# Uses Railway GraphQL API directly so ${{service.VAR}} references
# are stored correctly and resolved by Railway at container startup.
# =============================================================================

set -e

source "$(dirname "$0")/railway-api.sh"

echo "==> Reading service IDs from OpenTofu output..."
SERVICE_IDS=$(tofu output -json service_ids)

_id() { echo "$SERVICE_IDS" | jq -r ".\"$1\""; }

SYNAPSE_ID=$(     _id synapse)
MAS_ID=$(          _id mas)
ELEMENT_ID=$(      _id element)
ELEMENT_CALL_ID=$( _id element-call)
NGINX_ID=$(        _id nginx)
TELEGRAM_ID=$(     _id telegram)
PROV_ID=$(         _id provisioning-service)
WIDGET_ID=$(       _id postmoogle-widget)

echo ""
echo "==> Setting variables for all services in environment: ${RAILWAY_ENV_ID}"
echo ""

# ---------------------------------------------------------------------------
# SYNAPSE
# ---------------------------------------------------------------------------
railway_upsert_vars "$RAILWAY_ENV_ID" "$SYNAPSE_ID" \
  "SERVER_NAME=${SERVER_NAME}" \
  "MACAROON_KEY=${MACAROON_KEY}" \
  "FORM_SECRET=${FORM_SECRET}" \
  "REGISTRATION_SHARED_SECRET=${REGISTRATION_SHARED_SECRET}" \
  "MAS_SHARED_SECRET=${MAS_SHARED_SECRET}" \
  "POSTGRES_HOST=${POSTGRES_HOST}" \
  "POSTGRES_PORT=${POSTGRES_PORT}" \
  "POSTGRES_USER=${POSTGRES_USER}" \
  "POSTGRES_PASSWORD=${POSTGRES_PASSWORD}" \
  "POSTGRES_DB=${POSTGRES_DB}" \
  "TELEGRAM_AS_TOKEN=${TELEGRAM_AS_TOKEN}" \
  "TELEGRAM_HS_TOKEN=${TELEGRAM_HS_TOKEN}" \
  "SYNAPSE_CONFIG_PATH=/etc/synapse/homeserver.yaml"

# ---------------------------------------------------------------------------
# MAS — Matrix Authentication Service
# Railway resolves ${{synapse.RAILWAY_PUBLIC_DOMAIN}} at container startup
# ---------------------------------------------------------------------------
railway_upsert_vars "$RAILWAY_ENV_ID" "$MAS_ID" \
  "SERVER_NAME=${SERVER_NAME}" \
  "MAS_ENCRYPTION_SECRET=${MAS_ENCRYPTION_SECRET}" \
  "MAS_SHARED_SECRET=${MAS_SHARED_SECRET}" \
  "MAS_CLIENT_ID=${MAS_CLIENT_ID}" \
  "MAS_CLIENT_SECRET=${MAS_CLIENT_SECRET}" \
  "MAS_RSA_PRIVATE_KEY=${MAS_RSA_PRIVATE_KEY}" \
  "POSTGRES_HOST=${POSTGRES_HOST}" \
  "POSTGRES_PORT=${POSTGRES_PORT}" \
  "POSTGRES_USER=${POSTGRES_USER}" \
  "POSTGRES_PASSWORD=${POSTGRES_PASSWORD}" \
  "POSTGRES_DB=${POSTGRES_DB}" \
  "MAS_URL=https://\${{RAILWAY_PUBLIC_DOMAIN}}" \
  "SYNAPSE_URL=https://\${{synapse.RAILWAY_PUBLIC_DOMAIN}}" \
  "ELEMENT_WEB_CLIENT_ID=${ELEMENT_WEB_CLIENT_ID}" \
  "ELEMENT_WEB_URL=https://\${{element.RAILWAY_PUBLIC_DOMAIN}}"

# ---------------------------------------------------------------------------
# ELEMENT (Web UI) — image from its own repo
# ---------------------------------------------------------------------------
railway_upsert_vars "$RAILWAY_ENV_ID" "$ELEMENT_ID" \
  "SERVER_NAME=\${{synapse.RAILWAY_PUBLIC_DOMAIN}}" \
  "SYNAPSE_URL=https://\${{synapse.RAILWAY_PUBLIC_DOMAIN}}" \
  "MAS_URL=https://\${{mas.RAILWAY_PUBLIC_DOMAIN}}"

# ---------------------------------------------------------------------------
# ELEMENT CALL
# ---------------------------------------------------------------------------
railway_upsert_vars "$RAILWAY_ENV_ID" "$ELEMENT_CALL_ID" \
  "SERVER_NAME=\${{synapse.RAILWAY_PUBLIC_DOMAIN}}" \
  "SYNAPSE_URL=https://\${{synapse.RAILWAY_PUBLIC_DOMAIN}}"

# ---------------------------------------------------------------------------
# NGINX — routes public traffic to internal services
# No variables needed — nginx.conf uses .railway.internal addresses directly
# ---------------------------------------------------------------------------
echo "==> nginx: no variables needed (uses static railway.internal config)"

# ---------------------------------------------------------------------------
# TELEGRAM bridge
# ---------------------------------------------------------------------------
railway_upsert_vars "$RAILWAY_ENV_ID" "$TELEGRAM_ID" \
  "SERVER_NAME=${SERVER_NAME}" \
  "TELEGRAM_AS_TOKEN=${TELEGRAM_AS_TOKEN}" \
  "TELEGRAM_HS_TOKEN=${TELEGRAM_HS_TOKEN}" \
  "TELEGRAM_API_ID=${TELEGRAM_API_ID}" \
  "TELEGRAM_API_HASH=${TELEGRAM_API_HASH}" \
  "POSTGRES_HOST=${POSTGRES_HOST}" \
  "POSTGRES_PORT=${POSTGRES_PORT}" \
  "POSTGRES_USER=${POSTGRES_USER}" \
  "POSTGRES_PASSWORD=${POSTGRES_PASSWORD}" \
  "REGISTRATION_SHARED_SECRET=${REGISTRATION_SHARED_SECRET}"

# ---------------------------------------------------------------------------
# PROVISIONING SERVICE
# ---------------------------------------------------------------------------
railway_upsert_vars "$RAILWAY_ENV_ID" "$PROV_ID" \
  "HOMESERVER_URL=https://\${{synapse.RAILWAY_PUBLIC_DOMAIN}}" \
  "ADMIN_ACCESS_TOKEN=${ADMIN_ACCESS_TOKEN}" \
  "WIDGET_URL=https://\${{postmoogle-widget.RAILWAY_PUBLIC_DOMAIN}}" \
  "WIDGET_ICON=${WIDGET_ICON:-}" \
  "BOT_USER_ID=${BOT_USER_ID:-}" \
  "PORT=3000"

# ---------------------------------------------------------------------------
# POSTMOOGLE WIDGET
# ---------------------------------------------------------------------------
railway_upsert_vars "$RAILWAY_ENV_ID" "$WIDGET_ID" \
  "PORT=3000"

echo ""
echo "✅  All variables set. Railway resolves \${{service.VAR}} references at runtime."
