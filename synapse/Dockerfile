FROM matrixdotorg/synapse:latest

# 1. Install necessary build dependencies
RUN apt-get update && \
    apt-get install -y gettext-base git python3-pip && \
    rm -rf /var/lib/apt/lists/*

# 2. INSTALL THE MAS HELPER MODULE (Installing directly from GitHub)
RUN pip3 install --no-cache-dir git+https://github.com/element-hq/matrix-synapse-mas.git

# Copy your configuration templates
COPY homeserver.yaml /etc/synapse/homeserver.yaml.template
COPY registration.yaml /etc/synapse/registration.yaml.template

# Create entrypoint script
RUN echo '#!/bin/bash\n\
set -e\n\
envsubst < /etc/synapse/homeserver.yaml.template > /data/homeserver.yaml\n\
envsubst < /etc/synapse/registration.yaml.template > /etc/synapse/registration.yaml\n\
exec python3 -m synapse.app.homeserver --config-path=/data/homeserver.yaml' > /start.sh && \
    chmod +x /start.sh

EXPOSE 8008

ENTRYPOINT ["/start.sh"]