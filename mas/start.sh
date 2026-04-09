#!/bin/bash
set -e

echo "Substituting MAS environment variables..."

# 1. Converts literal '\n' into real line breaks and indents exactly 8 spaces to match YAML nesting
export MAS_RSA_KEY_FORMATTED=$(printf '%b' "$MAS_RSA_PRIVATE_KEY" | sed 's/^/        /')

# 2. Substitute all variables
envsubst '$MAS_URL $POSTGRES_USER $POSTGRES_PASSWORD $POSTGRES_HOST $POSTGRES_PORT $POSTGRES_DB $MAS_ENCRYPTION_SECRET $MAS_RSA_KEY_FORMATTED $MAS_SHARED_SECRET $SERVER_NAME $SYNAPSE_INTERNAL_URL $SYNAPSE_URL $MAS_CLIENT_ID $MAS_CLIENT_SECRET $ELEMENT_WEB_CLIENT_ID $ELEMENT_WEB_URL $MAS_UPSTREAM_HYDRA_PROVIDER_ID $MAS_UPSTREAM_HYDRA_ISSUER $MAS_UPSTREAM_HYDRA_CLIENT_ID $MAS_UPSTREAM_HYDRA_CLIENT_SECRET $GATEWAY_URL $HYDRA_HOST $MAS_IAM_SERVICE_SECRET $MAS_IAM_CLIENT_ID' < /config.yaml.template > /config.yaml

echo "Starting MAS server..."

exec mas-cli server -c /config.yaml