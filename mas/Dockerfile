FROM debian:bookworm-slim AS builder
RUN apt-get update && \
    apt-get install -y gettext-base && \
    rm -rf /var/lib/apt/lists/*

FROM ghcr.io/element-hq/matrix-authentication-service:latest

COPY --from=builder /usr/bin/envsubst /usr/bin/envsubst
COPY --from=builder /bin/sh /bin/sh
COPY --from=builder /lib/x86_64-linux-gnu/libc.so.6 /lib/x86_64-linux-gnu/
COPY --from=builder /lib64/ld-linux-x86-64.so.2 /lib64/

COPY config.yaml /config.yaml.template

# Create a simpler wrapper that substitutes then calls the original entrypoint
RUN printf '#!/bin/sh\n\
/usr/bin/envsubst < /config.yaml.template > /tmp/config.yaml\n\
exec /mas server --config /tmp/config.yaml\n' > /start.sh && chmod +x /start.sh

EXPOSE 8008

ENTRYPOINT ["/bin/sh", "/start.sh"]