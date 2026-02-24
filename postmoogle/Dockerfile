FROM ghcr.io/etkecc/postmoogle:latest

USER 0
COPY config.yaml /config.yaml

# We set the environment variable and ALSO tell the bot explicitly to use the file
ENV POSTMOOGLE_CONFIG=/config.yaml

# Overwrite the default entrypoint to ensure the config file is passed as an argument
ENTRYPOINT ["/usr/bin/postmoogle", "-config", "/config.yaml"]