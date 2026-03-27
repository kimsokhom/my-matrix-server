#!/bin/sh
set -e

echo "Substituting MAS environment variables..."

# List every single variable used in the config.yaml to ensure safe substitution
envsubst '$MAS_URL $POSTGRES_USER $POSTGRES_PASSWORD $POSTGRES_HOST $POSTGRES_PORT $POSTGRES_DB $MAS_ENCRYPTION_SECRET $MAS_RSA_PRIVATE_KEY $SERVER_NAME $MAS_SHARED_SECRET $SYNAPSE_INTERNAL_URL $MAS_CLIENT_ID $MAS_CLIENT_SECRET $SYNAPSE_URL $ELEMENT_WEB_CLIENT_ID $ELEMENT_WEB_URL' \
    < /config.yaml.template > /tmp/config.yaml

echo "Starting MAS server..."
exec /usr/local/bin/mas-cli server --config /tmp/config.yaml