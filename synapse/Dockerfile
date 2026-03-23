FROM matrixdotorg/synapse:latest

# 1. Install necessary build dependencies (git and python-pip are needed to install the module)
RUN apt-get update && \
    apt-get install -y --no-install-recommends gettext-base python3-pip && \
    rm -rf /var/lib/apt/lists/*

# 2. Install the Shared Secret module using pip
RUN pip install --no-cache-dir --break-system-packages matrix-synapse-mas

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