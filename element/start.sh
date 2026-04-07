#!/bin/sh
set -e

echo "Substituting Element-Web configuration variables..."
envsubst '${SERVER_NAME} ${POSTMOOGLE_WIDGET_URL} ${ELEMENT_WEB_CLIENT_ID}' \
    < /app/config.json.template > /app/config.json

echo "Starting Element-Web Nginx..."
exec /docker-entrypoint.sh nginx -g 'daemon off;'
