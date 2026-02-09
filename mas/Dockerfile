# Stage 1: Get envsubst binary and create startup script
FROM debian:bookworm-slim AS builder
RUN apt-get update && \
    apt-get install -y gettext-base && \
    rm -rf /var/lib/apt/lists/*

# Stage 2: Use MAS image
FROM ghcr.io/element-hq/matrix-authentication-service:latest

# Copy envsubst binary from builder
COPY --from=builder /usr/bin/envsubst /usr/bin/envsubst

# Copy shell binary for the script to run
COPY --from=builder /bin/sh /bin/sh
COPY --from=builder /bin/dash /bin/dash

# Copy necessary libraries for sh to work
COPY --from=builder /lib/x86_64-linux-gnu/libc.so.6 /lib/x86_64-linux-gnu/
COPY --from=builder /lib64/ld-linux-x86-64.so.2 /lib64/

# Copy config template
COPY config.yaml /config.yaml.template

# Create startup script that uses the correct mas path
RUN printf '#!/bin/sh\n\
set -e\n\
echo "Substituting environment variables..."\n\
/usr/bin/envsubst < /config.yaml.template > /tmp/config.yaml\n\
echo "Starting MAS server..."\n\
exec /mas server --config /tmp/config.yaml\n' > /start.sh && \
    chmod +x /start.sh

EXPOSE 8008

ENTRYPOINT ["/bin/sh", "/start.sh"]