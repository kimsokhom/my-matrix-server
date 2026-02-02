FROM matrixdotorg/synapse:latest

# Copy your config
COPY homeserver.yaml /homeserver.yaml

# Create wrapper that forces config copy and starts Synapse directly
RUN echo '#!/bin/bash\n\
set -e\n\
echo "Copying custom config to /data/homeserver.yaml"\n\
cp -f /homeserver.yaml /data/homeserver.yaml\n\
echo "Starting Synapse..."\n\
exec python -m synapse.app.homeserver --config-path=/data/homeserver.yaml' > /custom-start.sh && \
    chmod +x /custom-start.sh

EXPOSE 8008

ENTRYPOINT ["/custom-start.sh"]
