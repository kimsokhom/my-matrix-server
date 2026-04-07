FROM vectorim/element-web:latest

# The official element-web image is based on Alpine Nginx
USER root
RUN apk add --no-cache gettext

COPY config.json /app/config.json.template
COPY start.sh /start.sh
RUN chmod +x /start.sh

EXPOSE 8080
ENTRYPOINT ["/start.sh"]
