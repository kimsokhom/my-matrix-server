FROM ghcr.io/etkecc/postmoogle:latest

# Switch to root to perform file operations
USER 0

# Copy the config to the root (/) to avoid being masked by the /data volume
COPY config.yaml /config.yaml

# Set the environment variable to point to the new config location
ENV POSTMOOGLE_CONFIG=/config.yaml

# Ensure the app runs as root to have access to /data/postmoogle.db
USER 0

# (Optional) Ensure the workdir is correct
WORKDIR /data