FROM ghcr.io/etkecc/postmoogle:latest

# Copy config directly
COPY config.yaml /data/config.yaml

ENV POSTMOOGLE_CONFIG=/data/config.yaml

# The base image automatically runs /postmoogle