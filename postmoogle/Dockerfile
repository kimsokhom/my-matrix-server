FROM ghcr.io/etkecc/postmoogle:latest

# Use root user
USER 0

# Copy config to the root / instead of /data to avoid volume overwrites
COPY config.yaml /config.yaml

# Explicitly tell the bot where the config file is
ENV POSTMOOGLE_CONFIG=/config.yaml