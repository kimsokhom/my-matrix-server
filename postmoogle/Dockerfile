# Pull the official Postmoogle image
FROM ghcr.io/etkecc/postmoogle:latest

# Force the container to run as root to avoid the "user app" error
USER 0

# Tell the container to run the bot
CMD ["/postmoogle"]