FROM matrixdotorg/synapse:latest

# Copy the custom config to a location that will NOT be overwritten
COPY homeserver.yaml /etc/synapse/homeserver.yaml

EXPOSE 8008
# No CMD needed – the upstream image already defines the entrypoint
