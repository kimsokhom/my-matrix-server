#!/bin/sh
set -e

echo "Substituting Element-Call configuration variables..."
envsubst '$SERVER_NAME $LIVEKIT_SERVICE_URL $LIVEKIT_WSS_URL' \
    < /usr/share/nginx/html/config.json.template > /usr/share/nginx/html/config.json

echo "Starting Element-Call Nginx..."
exec nginx -g 'daemon off;'