FROM ghcr.io/etkecc/postmoogle:latest

# Use root for file operations
USER 0

# Copy config to the root (outside the volume) to prevent overwriting
COPY config.yaml /config.yaml

# Explicitly tell the bot to use this file via environment variables
ENV POSTMOOGLE_CONFIG=/config.yaml
ENV CONFIG=/config.yaml

# We let the base image's entrypoint run, but we pass the config flag
CMD ["postmoogle", "-config", "/config.yaml"]