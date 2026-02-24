FROM ghcr.io/etkecc/postmoogle:latest

# Switch to root just to ensure we can write to the volume path
USER 0

# Copy your hardcoded config directly to the data folder
COPY config.yaml /data/config.yaml

# Explicitly tell the bot where the file is
ENV POSTMOOGLE_CONFIG=/data/config.yaml

# The base image already has the entrypoint set to start the bot