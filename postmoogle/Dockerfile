FROM ghcr.io/etkecc/postmoogle:latest

# Scratch image: No shell, just COPY
COPY config.yaml /bin/config.yaml

# Set the working directory so the bot finds the file easily
WORKDIR /bin

# Start the bot. We use the absolute path /bin/postmoogle 
# and explicitly point to the config file.
ENTRYPOINT ["/bin/postmoogle", "-config", "/bin/config.yaml"]