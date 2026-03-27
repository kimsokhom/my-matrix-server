#!/bin/bash
set -e

echo "Substituting environment variables..."

envsubst '$SERVER_NAME $POSTGRES_USER $POSTGRES_PASSWORD $POSTGRES_HOST $POSTGRES_PORT $SYNAPSE_DB_NAME $MACAROON_KEY $FORM_SECRET $REGISTRATION_SHARED_SECRET $MAS_INTERNAL_URL $MAS_SHARED_SECRET $LIVEKIT_SERVICE_URL' \
    < /etc/synapse/homeserver.yaml.template > /data/homeserver.yaml

# Added $TELEGRAM_BRIDGE_URL
envsubst '$TELEGRAM_AS_TOKEN $TELEGRAM_HS_TOKEN $SERVER_NAME $TELEGRAM_BRIDGE_URL' \
    < /etc/synapse/registration.yaml.template > /etc/synapse/registration.yaml

export SYNAPSE_CONFIG_PATH=/data/homeserver.yaml
export SYNAPSE_SERVER_NAME=$SERVER_NAME
export SYNAPSE_REPORT_STATS=no

echo "Starting Synapse..."
exec /start.py run