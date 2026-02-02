FROM matrixdotorg/synapse:latest

# Copy config to a temporary location
COPY homeserver.yaml /tmp/homeserver.yaml

# Create entrypoint script that copies config and starts Synapse
RUN echo '#!/bin/sh\ncp /tmp/homeserver.yaml /data/homeserver.yaml\nexec python -m synapse.app.homeserver --config-path /data/homeserver.yaml' > /start.sh && \
    chmod +x /start.sh

EXPOSE 8008

ENTRYPOINT ["/start.sh"]
