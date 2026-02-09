FROM ghcr.io/element-hq/matrix-authentication-service:latest

# Install envsubst for environment variable substitution
RUN apt-get update && apt-get install -y gettext-base && rm -rf /var/lib/apt/lists/*

# Copy config template
COPY config.yaml /config.yaml.template

# Create entrypoint script to substitute variables
RUN echo '#!/bin/bash\n\
set -e\n\
echo "Substituting environment variables in config..."\n\
envsubst < /config.yaml.template > /tmp/config.yaml\n\
echo "Starting MAS server..."\n\
exec /usr/local/bin/mas server --config /tmp/config.yaml' > /start.sh && \
    chmod +x /start.sh

EXPOSE 8008

ENTRYPOINT ["/start.sh"]