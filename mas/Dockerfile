# 1. Get the MAS binary and assets from the official image
FROM ghcr.io/element-hq/matrix-authentication-service:latest AS mas-src

# 2. Use Ubuntu 24.04
FROM ubuntu:24.04

# 3. Install envsubst and CA certificates
RUN apt-get update && \
    apt-get install -y --no-install-recommends gettext-base ca-certificates && \
    rm -rf /var/lib/apt/lists/*

# 4. Copy the binary AND the required shared assets
COPY --from=mas-src /usr/local/bin/mas-cli /usr/local/bin/mas-cli
COPY --from=mas-src /usr/local/share/mas-cli /usr/local/share/mas-cli

# 5. Copy your config template and start script
COPY config.yaml /config.yaml.template
COPY start.sh /start.sh

RUN chmod +x /start.sh

EXPOSE 8008
ENTRYPOINT ["/start.sh"]