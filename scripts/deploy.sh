#!/bin/sh
# =============================================================================
# deploy.sh — Sets Railway service variables after environment is ready
# =============================================================================
# DEPLOY_MODE:
#   dev     — services were created by tofu apply, read IDs from tofu output
#   preview — services already exist (duplicated from dev), fetch IDs from API
# =============================================================================

set -e

SCRIPT_DIR="$(dirname "$0")"
source "${SCRIPT_DIR}/railway-api.sh"

DEPLOY_MODE="${DEPLOY_MODE:-dev}"

echo ""
echo "==> Deploy mode  : ${DEPLOY_MODE}"
echo "==> Environment  : ${RAILWAY_ENV_ID}"
echo ""

# ── Get service IDs ──────────────────────────────────────────────────────────

if [ "$DEPLOY_MODE" = "dev" ]; then
  echo "==> Reading service IDs from OpenTofu output..."
  TF_OUTPUT=$(tofu output -json service_ids)
  _svc_id() { echo "$TF_OUTPUT" | jq -r ".\"$1\""; }
else
  echo "==> Fetching service IDs from Railway API..."
  railway_get_service_ids
  _svc_id() { _id "$1"; }
fi

SYNAPSE_ID=$(      _svc_id synapse)
MAS_ID=$(          _svc_id mas)
ELEMENT_ID=$(      _svc_id element)
ELEMENT_CALL_ID=$( _svc_id element-call)
NGINX_ID=$(        _svc_id nginx)
TELEGRAM_ID=$(     _svc_id telegram)
PROV_ID=$(         _svc_id provisioning-service)
WIDGET_ID=$(       _svc_id postmoogle-widget)

# ── Update images for preview environments ───────────────────────────────────
# dev: tofu already updated the image during apply
# preview: update each service to this branch's image tag + trigger redeploy

if [ "$DEPLOY_MODE" = "preview" ]; then
  echo "==> Updating service images to: ${IMAGE_TAG}"

  EL_IMG="${ELEMENT_IMAGE:-${REGISTRY}/element:${IMAGE_TAG}}"

  railway_update_service_image "$RAILWAY_ENV_ID" "$SYNAPSE_ID"      "${REGISTRY}/synapse:${IMAGE_TAG}"
  railway_update_service_image "$RAILWAY_ENV_ID" "$MAS_ID"          "${REGISTRY}/mas:${IMAGE_TAG}"
  railway_update_service_image "$RAILWAY_ENV_ID" "$ELEMENT_ID"      "$EL_IMG"
  railway_update_service_image "$RAILWAY_ENV_ID" "$ELEMENT_CALL_ID" "${REGISTRY}/element-call:${IMAGE_TAG}"
  railway_update_service_image "$RAILWAY_ENV_ID" "$NGINX_ID"        "${REGISTRY}/nginx:${IMAGE_TAG}"
  railway_update_service_image "$RAILWAY_ENV_ID" "$TELEGRAM_ID"     "${REGISTRY}/telegram:${IMAGE_TAG}"
  railway_update_service_image "$RAILWAY_ENV_ID" "$PROV_ID"         "${REGISTRY}/provisioning-service:${IMAGE_TAG}"
  railway_update_service_image "$RAILWAY_ENV_ID" "$WIDGET_ID"       "${REGISTRY}/postmoogle-widget:${IMAGE_TAG}"
fi

echo ""
echo "==> Setting variables for all services..."
echo ""

# ── SYNAPSE ───────────────────────────────────────────────────────────────────
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

# ── MAS ───────────────────────────────────────────────────────────────────────
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

# ── ELEMENT WEB ───────────────────────────────────────────────────────────────
railway_upsert_vars "$RAILWAY_ENV_ID" "$ELEMENT_ID" \
  "SERVER_NAME=\${{synapse.RAILWAY_PUBLIC_DOMAIN}}" \
  "SYNAPSE_URL=https://\${{synapse.RAILWAY_PUBLIC_DOMAIN}}" \
  "MAS_URL=https://\${{mas.RAILWAY_PUBLIC_DOMAIN}}"

# ── ELEMENT CALL ──────────────────────────────────────────────────────────────
railway_upsert_vars "$RAILWAY_ENV_ID" "$ELEMENT_CALL_ID" \
  "SERVER_NAME=\${{synapse.RAILWAY_PUBLIC_DOMAIN}}" \
  "SYNAPSE_URL=https://\${{synapse.RAILWAY_PUBLIC_DOMAIN}}"

# ── NGINX — no vars needed (uses static railway.internal in nginx.conf) ───────
echo "==> nginx: no variables needed"

# ── TELEGRAM ──────────────────────────────────────────────────────────────────
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

# ── PROVISIONING SERVICE ──────────────────────────────────────────────────────
railway_upsert_vars "$RAILWAY_ENV_ID" "$PROV_ID" \
  "HOMESERVER_URL=https://\${{synapse.RAILWAY_PUBLIC_DOMAIN}}" \
  "ADMIN_ACCESS_TOKEN=${ADMIN_ACCESS_TOKEN}" \
  "WIDGET_URL=https://\${{postmoogle-widget.RAILWAY_PUBLIC_DOMAIN}}" \
  "WIDGET_ICON=${WIDGET_ICON:-}" \
  "BOT_USER_ID=${BOT_USER_ID:-}" \
  "PORT=3000"

# ── POSTMOOGLE WIDGET ─────────────────────────────────────────────────────────
railway_upsert_vars "$RAILWAY_ENV_ID" "$WIDGET_ID" \
  "PORT=3000"

echo ""
echo "✅  Done. Railway resolves \${{service.VAR}} references at container startup."
