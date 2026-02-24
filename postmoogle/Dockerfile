FROM ghcr.io/etkecc/postmoogle:latest

# MUST SWITCH TO ROOT to run apk add and modify files
USER 0

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
# Optional: cat /data/config.yaml (Be careful, this will print your secret to the logs!)\n\
exec /postmoogle\n' > /start.sh && chmod +x /start.sh

# Point the bot to the generated config
ENV POSTMOOGLE_CONFIG=/data/config.yaml

# Run the startup script
ENTRYPOINT ["/start.sh"]