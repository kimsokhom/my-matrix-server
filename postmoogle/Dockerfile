FROM ghcr.io/etkecc/postmoogle:latest

# We cannot use RUN or USER because this is a 'scratch' image.
# We just copy the file to the root.
COPY config.yaml /config.yaml

# Point the bot to the file
ENV POSTMOOGLE_CONFIG=/config.yaml

# Set the Entrypoint to the binary path shown in your snippet
# and pass the config flag.
ENTRYPOINT ["/bin/postmoogle", "-config", "/config.yaml"]