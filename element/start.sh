#!/bin/sh
set -e

echo "Substituting Element-Web configuration variables..."
envsubst '$SERVER_NAME $POSTMOOGLE_WIDGET_URL' \
    < /app/config.json.template > /app/config.json

echo "Starting Element-Web Nginx..."
exec nginx -g 'daemon off;'