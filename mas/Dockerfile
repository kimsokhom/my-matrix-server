# 1. Get the MAS binary and assets from the official image
FROM ghcr.io/element-hq/matrix-authentication-service:latest AS mas-src

# 2. Use Ubuntu 24.04
FROM ubuntu:24.04

# 3. Install envsubst and CA certificates
RUN apt-get update && \
    apt-get install -y gettext-base ca-certificates && \
    rm -rf /var/lib/apt/lists/*

# 4. Copy the binary AND the required shared assets (policies, templates, etc.)
COPY --from=mas-src /usr/local/bin/mas-cli /usr/local/bin/mas-cli
COPY --from=mas-src /usr/local/share/mas-cli /usr/local/share/mas-cli

# 5. Create the startup script
RUN printf '#!/bin/sh\n\
set -e\n\
echo "Substituting environment variables..."\n\
envsubst < /config.yaml.template > /tmp/config.yaml\n\
echo "Starting MAS server..."\n\
exec /usr/local/bin/mas-cli server --config /tmp/config.yaml\n' > /start.sh && \
    chmod +x /start.sh

# 6. Copy your config template
COPY config.yaml /config.yaml.template

EXPOSE 8008

ENTRYPOINT ["/bin/sh", "/start.sh"]