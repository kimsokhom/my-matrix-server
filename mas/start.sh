#!/bin/bash
set -e

echo "Substituting MAS environment variables..."

# 1. This converts the literal '\n' in your Railway variable into real line breaks
# and indents the key so the YAML doesn't break.
export MAS_RSA_KEY_FORMATTED=$(printf '%b' "$MAS_RSA_PRIVATE_KEY" | sed 's/^/  /')

# 2. Use the root path (/) because that's where your Dockerfile COPY-ed the file
# Note: I've updated the filter to include your specific variables
envsubst '$MAS_URL $POSTGRES_USER $POSTGRES_PASSWORD $POSTGRES_HOST $POSTGRES_PORT $POSTGRES_DB $MAS_ENCRYPTION_SECRET $MAS_RSA_KEY_FORMATTED $MAS_SHARED_SECRET $SERVER_NAME $SYNAPSE_INTERNAL_URL $MAS_CLIENT_ID $MAS_CLIENT_SECRET $ELEMENT_WEB_CLIENT_ID $ELEMENT_WEB_URL' \
    < /config.yaml.template > /config.yaml

echo "Starting MAS server..."
# Point the -c flag to the generated config at /config.yaml
exec mas-cli server -c /config.yaml