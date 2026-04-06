FROM vectorim/element-web:latest

USER root

COPY config.json /app/config.json.template
COPY entrypoint.sh /docker-entrypoint.d/20-envsubst-config.sh
RUN chmod +x /docker-entrypoint.d/20-envsubst-config.sh
