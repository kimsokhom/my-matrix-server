FROM debian:bookworm-slim AS builder
RUN apt-get update && \
    apt-get install -y gettext-base && \
    rm -rf /var/lib/apt/lists/*

FROM ghcr.io/element-hq/matrix-authentication-service:latest

# Copy binaries from builder
COPY --from=builder /usr/bin/envsubst /usr/bin/envsubst
COPY --from=builder /bin/sh /bin/sh
COPY --from=builder /bin/ls /bin/ls
COPY --from=builder /lib/x86_64-linux-gnu/libc.so.6 /lib/x86_64-linux-gnu/
COPY --from=builder /lib64/ld-linux-x86-64.so.2 /lib64/

# Copy config template
COPY config.yaml /config.yaml.template

# Create debug script to find the binary
RUN printf '#!/bin/sh\n\
echo "=== Searching for mas binary ==="\n\
/bin/ls -la /usr/local/bin/ || echo "No /usr/local/bin/"\n\
/bin/ls -la /usr/bin/ || echo "No /usr/bin/"\n\
/bin/ls -la / | head -20\n\
echo "=== Substituting environment variables ==="\n\
/usr/bin/envsubst < /config.yaml.template > /tmp/config.yaml\n\
echo "=== Trying to start MAS ==="\n\
exec /usr/local/bin/mas-cli server --config /tmp/config.yaml\n' > /start.sh && \
    chmod +x /start.sh

EXPOSE 8008

ENTRYPOINT ["/bin/sh", "/start.sh"]