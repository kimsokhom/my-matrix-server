FROM ghcr.io/etkecc/postmoogle:latest

# 1. Create a minimal passwd file so Railway can find the "app" user
# Scratch images are empty, so we must provide this file.
COPY <<EOF /etc/passwd
root:x:0:0:root:/root:/bin/sh
app:x:1000:1000:app:/app:/bin/sh
EOF

# 2. Copy your config file to the root
COPY config.yaml /config.yaml

# 3. Explicitly run as the user Railway is looking for
USER 1000

# 4. Point the bot to the config file
ENV POSTMOOGLE_CONFIG=/config.yaml

# 5. Start the bot directly using the binary path from documentation
ENTRYPOINT ["/bin/postmoogle", "-config", "/config.yaml"]