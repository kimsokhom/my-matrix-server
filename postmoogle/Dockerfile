FROM ghcr.io/etkecc/postmoogle:latest

USER 0

# Copy to a safe location that is NOT /data
COPY config.yaml /etc/postmoogle.yaml

# Use the standard environment variable to point to the safe location
ENV POSTMOOGLE_CONFIG=/etc/postmoogle.yaml

# Set the workdir back to data for the database
WORKDIR /data

# Run the binary and explicitly point to the config
ENTRYPOINT ["postmoogle", "-config", "/etc/postmoogle.yaml"]