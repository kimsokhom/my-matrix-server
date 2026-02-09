FROM debian:bookworm-slim AS builder
RUN apt-get update && \
    apt-get install -y gettext-base && \
    rm -rf /var/lib/apt/lists/*

# Create a simpler startup script that tries common paths
RUN printf '#!/bin/sh\n\
set -e\n\
echo "Substituting environment variables..."\n\
/usr/bin/envsubst < /config.yaml.template > /tmp/config.yaml\n\
echo "Starting MAS server..."\n\
# Try different possible paths for the mas binary\n\
if [ -f /usr/local/bin/mas-cli ]; then\n\
  exec /usr/local/bin/mas-cli server --config /tmp/config.yaml\n\
elif [ -f /usr/bin/mas-cli ]; then\n\
  exec /usr/bin/mas-cli server --config /tmp/config.yaml\n\
elif [ -f /mas-cli ]; then\n\
  exec /mas-cli server --config /tmp/config.yaml\n\
else\n\
  echo "ERROR: mas-cli binary not found!"\n\
  exit 1\n\
fi\n' > /start.sh && \
    chmod +x /start.sh

FROM ghcr.io/element-hq/matrix-authentication-service:latest

# Copy only what we need from builder
COPY --from=builder /usr/bin/envsubst /usr/bin/envsubst
COPY --from=builder /bin/sh /bin/sh
COPY --from=builder /lib/x86_64-linux-gnu/libc.so.6 /lib/x86_64-linux-gnu/
COPY --from=builder /lib64/ld-linux-x86-64.so.2 /lib64/
COPY --from=builder /start.sh /start.sh

# Copy config template
COPY config.yaml /config.yaml.template

EXPOSE 8008

ENTRYPOINT ["/bin/sh", "/start.sh"]