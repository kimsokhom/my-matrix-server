#!/bin/sh
set -e

# Generate passkey if it doesn't exist yet (used to encrypt stored tokens)
if [ ! -f /data/passkey.pem ]; then
  echo "Generating passkey..."
  openssl genpkey -out /data/passkey.pem -algorithm RSA -pkeyopt rsa_keygen_bits:4096
fi

# Substitute env vars into config and registration templates
echo "Rendering hookshot config..."
envsubst '${SERVER_NAME} ${SYNAPSE_INTERNAL_URL} ${LOG_LEVEL} ${GITLAB_WEBHOOK_SECRET} ${HOOKSHOT_PUBLIC_URL} ${FIGMA_TEAM_ID} ${FIGMA_ACCESS_TOKEN} ${FIGMA_WEBHOOK_PASSCODE} ${GITHUB_APP_ID} ${GITHUB_PRIVATE_KEY_B64} ${GITHUB_WEBHOOK_SECRET} ${GITHUB_CLIENT_ID} ${GITHUB_CLIENT_SECRET}' \
  < /etc/hookshot/config.yaml.template > /data/config.yaml

# DEBUG: log the rendered config
cat /data/config.yaml

echo "Rendering hookshot registration..."
envsubst '${SERVER_NAME} ${HOOKSHOT_AS_TOKEN} ${HOOKSHOT_HS_TOKEN} ${HOOKSHOT_INTERNAL_URL}' \
  < /etc/hookshot/registration.yaml.template > /data/registration.yaml

echo "Decoding GitHub private key..."
echo "$GITHUB_PRIVATE_KEY_B64" | base64 -d > /data/github-private-key.pem

echo "Starting Hookshot..."
exec node /usr/bin/matrix-hookshot/App/BridgeApp.js \
  /data/config.yaml \
  /data/registration.yaml
