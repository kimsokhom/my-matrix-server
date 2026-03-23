FROM matrixdotorg/synapse:latest

# 1. Install necessary build dependencies (adding build-essential for Python 3.13)
RUN apt-get update && \
    apt-get install -y gettext-base git python3-pip python3-dev build-essential libffi-dev && \
    rm -rf /var/lib/apt/lists/*

# 2. INSTALL THE MAS HELPER MODULE (Using direct tarball download to avoid Git errors)
RUN pip3 install --no-cache-dir https://github.com/element-hq/matrix-synapse-mas/archive/main.tar.gz

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