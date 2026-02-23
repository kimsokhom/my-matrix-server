FROM ghcr.io/etkecc/postmoogle:latest

# Use root to ensure we can write to /data
USER 0

# Copy your custom config to the location the bot expects
COPY config.yaml /data/config.yaml

# Tell the bot where the config is (if needed, usually it checks /data/config.yaml)
ENV POSTMOOGLE_CONFIG=/data/config.yaml