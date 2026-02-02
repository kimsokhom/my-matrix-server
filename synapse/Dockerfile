FROM matrixdotorg/synapse:latest

# Copy your config to a temp location
COPY homeserver.yaml /homeserver.yaml

# Create a proper wrapper script that calls the original entrypoint
RUN echo '#!/bin/bash\n\
set -e\n\
# Copy config to the expected location\n\
cp -f /homeserver.yaml /data/homeserver.yaml\n\
# Call the original Synapse start script with the original entrypoint\n\
exec /start.py run' > /custom-start.sh && \
    chmod +x /custom-start.sh

EXPOSE 8008

# Use sh as entrypoint to run our script
ENTRYPOINT ["/bin/sh"]
CMD ["/custom-start.sh"]
