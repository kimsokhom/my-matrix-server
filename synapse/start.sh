#!/bin/bash
set -e

echo "Substituting environment variables..."

envsubst '$SERVER_NAME $POSTGRES_USER $POSTGRES_PASSWORD $POSTGRES_HOST $POSTGRES_PORT $POSTGRES_DB $MACAROON_KEY $FORM_SECRET $REGISTRATION_SHARED_SECRET $MAS_INTERNAL_URL $MAS_SHARED_SECRET $LIVEKIT_SERVICE_URL' \
    < /etc/synapse/homeserver.yaml.template > /data/homeserver.yaml

envsubst '$TELEGRAM_AS_TOKEN $TELEGRAM_HS_TOKEN $SERVER_NAME $TELEGRAM_BRIDGE_URL' \
    < /etc/synapse/telegram-registration.yaml.template > /etc/synapse/telegram-registration.yaml

envsubst '$HOOKSHOT_AS_TOKEN $HOOKSHOT_HS_TOKEN $SERVER_NAME $HOOKSHOT_INTERNAL_URL' \
    < /etc/synapse/hookshot-registration.yaml.template > /etc/synapse/hookshot-registration.yaml

export SYNAPSE_CONFIG_PATH=/data/homeserver.yaml
export SYNAPSE_SERVER_NAME=$SERVER_NAME
export SYNAPSE_REPORT_STATS=no

# Give the Synapse user (UID 991) permission to access the Railway volume
echo "Fixing volume permissions..."
chown -R 991:991 /data

echo "Starting Synapse..."
exec /start.py run