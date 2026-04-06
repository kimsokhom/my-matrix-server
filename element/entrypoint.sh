#!/bin/sh
envsubst '${SERVER_NAME} ${ELEMENT_WEB_CLIENT_ID}' \
  < /app/config.json.template \
  > /app/config.json
