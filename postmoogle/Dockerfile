FROM ghcr.io/etkecc/postmoogle:latest

USER 0
# Create a folder that is NOT /data
RUN mkdir -p /etc/postmoogle
COPY config.yaml /etc/postmoogle/config.yaml

# Point the bot to the safe location
ENV POSTMOOGLE_CONFIG=/etc/postmoogle/config.yaml

# Explicitly start the bot pointing to that file
ENTRYPOINT ["/postmoogle", "-config", "/etc/postmoogle/config.yaml"]