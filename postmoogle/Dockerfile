FROM ghcr.io/etkecc/postmoogle:latest

# Use root for file permissions
USER 0

# Copy config to root
COPY config.yaml /config.yaml

ENV POSTMOOGLE_CONFIG=/config.yaml

ENTRYPOINT ["/postmoogle", "-config", "/config.yaml"]