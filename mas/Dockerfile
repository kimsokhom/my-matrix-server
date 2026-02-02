FROM ghcr.io/element-hq/matrix-authentication-service:latest

# Copy config file
COPY config.yaml /config.yaml

# Set config path
ENV MAS_CONFIG=/config.yaml

CMD ["server"]