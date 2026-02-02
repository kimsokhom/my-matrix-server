FROM matrixdotorg/synapse:latest

# Copy your config
COPY homeserver.yaml /homeserver.yaml

# Create wrapper script
RUN printf '#!/bin/bash\nset -e\necho "Copying custom config to /data/homeserver.yaml"\ncp -f /homeserver.yaml /data/homeserver.yaml\necho "Starting Synapse..."\nexec python -m synapse.app.homeserver --config-path=/data/homeserver.yaml\n' > /custom-start.sh && \
    chmod +x /custom-start.sh

EXPOSE 8008

# Completely override the entrypoint
ENTRYPOINT []
CMD ["/custom-start.sh"]
