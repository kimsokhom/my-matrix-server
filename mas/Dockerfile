FROM debian:bookworm-slim AS builder
RUN apt-get update && \
    apt-get install -y gettext-base && \
    rm -rf /var/lib/apt/lists/*

# Create the startup script in the builder
RUN printf '#!/bin/sh\n\
/usr/bin/envsubst < /config.yaml.template > /tmp/config.yaml\n\
exec /mas server --config /tmp/config.yaml\n' > /start.sh && \
    chmod +x /start.sh

FROM ghcr.io/element-hq/matrix-authentication-service:latest

# Copy binaries and script from builder
COPY --from=builder /usr/bin/envsubst /usr/bin/envsubst
COPY --from=builder /bin/sh /bin/sh
COPY --from=builder /lib/x86_64-linux-gnu/libc.so.6 /lib/x86_64-linux-gnu/
COPY --from=builder /lib64/ld-linux-x86-64.so.2 /lib64/
COPY --from=builder /start.sh /start.sh

# Copy config template
COPY config.yaml /config.yaml.template

EXPOSE 8008

ENTRYPOINT ["/bin/sh", "/start.sh"]