#!/bin/sh
set -e

# Generate passkey if it doesn't exist yet (used to encrypt stored tokens)
if [ ! -f /data/passkey.pem ]; then
  echo "Generating passkey..."
  openssl genpkey -out /data/passkey.pem -algorithm RSA -pkeyopt rsa_keygen_bits:4096
fi

# Substitute env vars into config and registration templates
echo "Rendering hookshot config..."
envsubst '${SERVER_NAME} ${SYNAPSE_INTERNAL_URL} ${LOG_LEVEL}' \
  < /etc/hookshot/config.yaml.template > /data/config.yaml

echo "Rendering hookshot registration..."
envsubst '${SERVER_NAME} ${HOOKSHOT_AS_TOKEN} ${HOOKSHOT_HS_TOKEN}' \
  < /etc/hookshot/registration.yaml.template > /data/registration.yaml

echo "Starting Hookshot..."
exec node --trace-warnings --unhandled-rejections=throw \
  /usr/bin/matrix-hookshot/Bridge.js \
  --config /data/config.yaml \
  --registration /data/registration.yaml
