FROM matrixdotorg/synapse:latest

# 1. Install necessary build dependencies (git and python-pip are needed to install the module)
RUN apt-get update && \
    apt-get install -y gettext-base git python3-pip && \
    rm -rf /var/lib/apt/lists/*

# 2. Install the Shared Secret module using pip 
# We install it into the system site-packages so Synapse can find it
RUN pip3 install --no-cache-dir git+https://github.com/devture/matrix-synapse-shared-secret-auth

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