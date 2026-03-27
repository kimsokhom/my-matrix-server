#!/bin/bash
set -e

echo "Substituting MAS environment variables..."

# 1. Convert literal \n or \\n into actual newlines
# 2. Add 8 spaces of indentation to every line so it fits the YAML 'key: |' block
export MAS_RSA_KEY_FORMATTED=$(printf '%b' "$MAS_RSA_PRIVATE_KEY" | sed 's/^/        /')

# Note: We use the new MAS_RSA_KEY_FORMATTED instead of the raw one
envsubst '$MAS_URL $POSTGRES_USER $POSTGRES_PASSWORD $POSTGRES_HOST $POSTGRES_PORT $POSTGRES_DB $MAS_ENCRYPTION_SECRET $MAS_RSA_KEY_FORMATTED $MAS_SHARED_SECRET $SERVER_NAME $SYNAPSE_INTERNAL_URL $MAS_CLIENT_ID $MAS_CLIENT_SECRET $ELEMENT_WEB_CLIENT_ID $ELEMENT_WEB_URL' \
    < /etc/mas-cli/config.yaml.template > /etc/mas-cli/config.yaml

echo "Starting MAS server..."
exec mas-cli server -c /etc/mas-cli/config.yaml