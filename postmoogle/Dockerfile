FROM ghcr.io/etkecc/postmoogle:latest

# Copy the config file to the container
COPY config.yaml /data/config.yaml

# Tell Postmoogle where to find the config
ENV POSTMOOGLE_CONFIG=/data/config.yaml

# Start the bot
ENTRYPOINT ["/postmoogle"]