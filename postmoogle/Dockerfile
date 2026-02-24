FROM ghcr.io/etkecc/postmoogle:latest

# In a scratch image, we copy the .env to the root
COPY .env /.env

# We copy the binary to the root (just in case)
COPY --from=ghcr.io/etkecc/postmoogle:latest /bin/postmoogle /postmoogle

# Set the working directory to root so it finds /.env
WORKDIR /

# Start the bot. It will load the .env file automatically.
ENTRYPOINT ["/postmoogle"]