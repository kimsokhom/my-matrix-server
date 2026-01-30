FROM matrixdotorg/synapse:latest

# 1. Copy your yaml from GitHub into the box
COPY homeserver.yaml /data/homeserver.yaml

# 2. This part fills in your ${} variables so Synapse can read them
ENTRYPOINT ["/bin/sh", "-c", "sed -i \"s|\\\${SERVER_NAME}|$SERVER_NAME|g\" /data/homeserver.yaml && sed -i \"s|\\\${DATABASE_URL}|$DATABASE_URL|g\" /data/homeserver.yaml && sed -i \"s|\\\${MACAROON_KEY}|$MACAROON_KEY|g\" /data/homeserver.yaml && sed -i \"s|\\\${MAS_SHARED_SECRET}|$MAS_SHARED_SECRET|g\" /data/homeserver.yaml && exec python3 -m synapse.app.homeserver --config-path /data/homeserver.yaml"]
