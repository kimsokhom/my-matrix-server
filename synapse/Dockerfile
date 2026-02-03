FROM matrixdotorg/synapse:latest

# Copy config to a safe place that won't be overwritten by a volume
COPY homeserver.yaml /etc/synapse/homeserver.yaml

EXPOSE 8008

# Start Synapse pointing to that safe path
CMD ["run", "--config-path", "/etc/synapse/homeserver.yaml"]