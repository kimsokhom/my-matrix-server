# Use a newer base for the builder to match the libraries MAS now uses
FROM debian:trixie-slim AS builder
RUN apt-get update && \
    apt-get install -y gettext-base && \
    rm -rf /var/lib/apt/lists/*

# Create the startup script
RUN printf '#!/bin/sh\n\
set -e\n\
echo "Substituting environment variables..."\n\
/usr/bin/envsubst < /config.yaml.template > /tmp/config.yaml\n\
echo "Starting MAS server..."\n\
exec /usr/local/bin/mas-cli server --config /tmp/config.yaml\n' > /start.sh && \
    chmod +x /start.sh

# Use the official MAS image
FROM ghcr.io/element-hq/matrix-authentication-service:latest

# Copy ONLY the tools and script you created, NOT the system libraries
COPY --from=builder /usr/bin/envsubst /usr/bin/envsubst
COPY --from=builder /start.sh /start.sh

# If the MAS image is minimal (distroless), you might need the shared libs for envsubst.
# But DO NOT overwrite existing ones. Instead, rely on the base image.
# If envsubst fails, we can install it differently, but start with this:

# Copy your config template
COPY config.yaml /config.yaml.template

EXPOSE 8008

ENTRYPOINT ["/bin/sh", "/start.sh"]