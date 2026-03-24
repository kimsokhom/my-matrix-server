FROM vectorim/element-web:latest

# Copy config template
COPY config.json /app/config.json.template

# Install envsubst and create startup script
USER root
RUN apt-get update && apt-get install -y gettext-base && rm -rf /var/lib/apt/lists/* && \
    printf '#!/bin/sh\nenvsubst < /app/config.json.template > /app/config.json\nexec "$@"' > /docker-entrypoint.d/01-envsubst-config.sh && \
    chmod +x /docker-entrypoint.d/01-envsubst-config.sh

EXPOSE 80
