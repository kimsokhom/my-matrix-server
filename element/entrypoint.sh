#!/bin/sh
set -e

envsubst '${SERVER_NAME} ${ELEMENT_WEB_CLIENT_ID}' \
  < /app/config.json.template \
  > /app/config.json

exec nginx -g 'daemon off;'
