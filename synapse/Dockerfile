# Use the official Docker‑Compose image as a base (lightweight)
FROM docker/compose:1.29.2

# Copy the compose file and the homeserver config into the image
COPY docker-compose.yml /app/docker-compose.yml
COPY homeserver.yaml /app/homeserver.yaml

WORKDIR /app

# Tell Docker to run docker‑compose when the container starts
CMD ["docker-compose", "up", "-d"]
