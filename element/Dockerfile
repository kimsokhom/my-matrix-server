FROM vectorim/element-web:latest

# The official element-web image is based on Alpine Nginx
USER root
RUN apk add --no-cache gettext

# Copy config as template and copy start script
COPY config.json /app/config.json.template
COPY start.sh /start.sh

RUN chmod +x /start.sh

EXPOSE 80
ENTRYPOINT ["/start.sh"]