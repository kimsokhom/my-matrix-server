# Stage 1: Get envsubst binary
FROM debian:bookworm-slim AS builder
RUN apt-get update && \
    apt-get install -y gettext-base && \
    rm -rf /var/lib/apt/lists/*

# Stage 2: Use MAS image
FROM ghcr.io/element-hq/matrix-authentication-service:latest

# Copy envsubst binary from builder
COPY --from=builder /usr/bin/envsubst /usr/bin/envsubst

# Copy config template
COPY config.yaml /config.yaml.template

# Create entrypoint script that substitutes variables
RUN printf '#!/bin/sh\nset -e\necho "Substituting environment variables..."\n/usr/bin/envsubst < /config.yaml.template > /tmp/config.yaml\necho "Starting MAS server..."\nexec /usr/local/bin/mas server --config /tmp/config.yaml\n' > /start.sh && \
    chmod +x /start.sh

EXPOSE 8008

ENTRYPOINT ["/start.sh"]