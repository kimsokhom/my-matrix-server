FROM vectorim/element-web:latest

USER root

COPY config.json /app/config.json.template

RUN echo '#!/bin/sh' > /docker-entrypoint.d/20-envsubst-config.sh && \
    echo 'envsubst "${SERVER_NAME} ${MAS_URL} ${ELEMENT_WEB_CLIENT_ID}" < /app/config.json.template > /app/config.json' \
    >> /docker-entrypoint.d/20-envsubst-config.sh && \
    chmod +x /docker-entrypoint.d/20-envsubst-config.sh
