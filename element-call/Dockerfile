FROM ghcr.io/element-hq/element-call:latest

# We are now building from the root, so we must include the folder names
COPY element-call/config.json /app/config.json

# Now we can reach the nginx folder without using ../
COPY ../nginx/default.conf.template /etc/nginx/templates/default.conf.template

EXPOSE 80