#!/bin/sh
set -e

echo "Substituting environment variables..."

envsubst '$SERVER_NAME $POSTGRES_USER $POSTGRES_PASSWORD $POSTGRES_HOST $POSTGRES_PORT $TELEGRAM_DB_NAME $TELEGRAM_AS_TOKEN $TELEGRAM_HS_TOKEN $TELEGRAM_API_ID $TELEGRAM_API_HASH $REGISTRATION_SHARED_SECRET $SYNAPSE_INTERNAL_URL $TELEGRAM_BRIDGE_URL $ADMIN_MXID $TELEGRAM_BOT_TOKEN' \
    < /etc/mautrix-telegram/config.yaml.template > /etc/mautrix-telegram/config.yaml

# Added $TELEGRAM_BRIDGE_URL
envsubst '$TELEGRAM_AS_TOKEN $TELEGRAM_HS_TOKEN $SERVER_NAME $TELEGRAM_BRIDGE_URL' \
    < /etc/mautrix-telegram/registration.yaml.template > /etc/mautrix-telegram/registration.yaml

echo "Starting Mautrix-Telegram bridge..."
exec /usr/bin/mautrix-telegram -c /etc/mautrix-telegram/config.yaml