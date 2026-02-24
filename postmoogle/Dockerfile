FROM ghcr.io/etkecc/postmoogle:latest

# Copy config to the root.
COPY config.yaml /config.yaml

# Tell the bot where the config is. 
# The base image will run /bin/postmoogle automatically.
ENV POSTMOOGLE_CONFIG=/config.yaml