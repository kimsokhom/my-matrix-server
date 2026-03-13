FROM matrixdotorg/synapse:latest

RUN apt-get update && apt-get install -y gettext-base && rm -rf /var/lib/apt/lists/*

COPY homeserver.yaml /etc/synapse/homeserver.yaml.template

# Create entrypoint script
RUN echo '#!/bin/bash\n\
set -e\n\
envsubst < /etc/synapse/homeserver.yaml.template > /data/homeserver.yaml\n\
exec python3 -m synapse.app.homeserver --config-path=/data/homeserver.yaml' > /start.sh && \
    chmod +x /start.sh

EXPOSE 8008
ENTRYPOINT ["/start.sh"]