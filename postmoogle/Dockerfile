FROM ghcr.io/etkecc/postmoogle:latest

# 1. Scratch images have no /tmp or /etc by default. 
# 2. We copy our config directly to the root.
COPY config.yaml /config.yaml

# 3. Set the Environment Variable as a fallback
ENV POSTMOOGLE_CONFIG=/config.yaml

# 4. Use JSON Exec Form (no shell involved).
# This points to the binary path found in your 'main.go' logic (/bin/postmoogle)
ENTRYPOINT ["/bin/postmoogle", "-config", "/config.yaml"]