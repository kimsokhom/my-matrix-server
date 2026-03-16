FROM ghcr.io/element-hq/element-call:latest

# Copy the Element Call web config
COPY config.json /app/config.json

# Copy your Nginx proxy config into the TEMPLATES folder
# (Nginx will automatically replace the ${VARS} and move it to the right place)
COPY ../nginx/default.conf.template /etc/nginx/templates/default.conf.template

EXPOSE 80