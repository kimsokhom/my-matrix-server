FROM ghcr.io/etkecc/postmoogle:latest
USER 0
COPY config.yaml /config.yaml
# Some versions of this bridge use CONFIG instead of POSTMOOGLE_CONFIG
ENV CONFIG=/config.yaml
ENV POSTMOOGLE_CONFIG=/config.yaml