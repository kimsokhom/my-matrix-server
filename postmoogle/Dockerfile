FROM ghcr.io/etkecc/postmoogle:latest

# Switch to root to install packages
USER root

# Install envsubst for environment variable substitution
RUN apk add --no-cache gettext

# Copy config template
COPY config.yaml /config.yaml.template

# Create startup script that generates config and starts bot
RUN printf '#!/bin/sh\n\
set -e\n\
echo "Generating config from template..."\n\
envsubst < /config.yaml.template > /data/config.yaml\n\
echo "Config generated. Starting Postmoogle..."\n\
cat /data/config.yaml\n\
exec /postmoogle\n' > /start.sh && chmod +x /start.sh

ENV POSTMOOGLE_CONFIG=/data/config.yaml

ENTRYPOINT ["/start.sh"]