FROM ghcr.io/etkecc/postmoogle:latest

# Use root for file operations
USER 0

# Copy config to a safe temporary location
COPY config.yaml /tmp/config.yaml

# Set the Environment variable
ENV POSTMOOGLE_CONFIG=/data/config.yaml

# This command runs every time the container starts:
# 1. It copies the config from /tmp to the live /data volume
# 2. It starts the bot
CMD cp /tmp/config.yaml /data/config.yaml && /postmoogle