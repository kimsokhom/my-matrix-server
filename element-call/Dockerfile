# Stage 1: Get element-call web files
FROM ghcr.io/element-hq/element-call:latest AS element-files

# Stage 2: Nginx with envsubst support
FROM nginx:alpine

RUN apk add --no-cache gettext

# Copy web files
COPY --from=element-files /app /usr/share/nginx/html

# Copy config as template
COPY config.json /usr/share/nginx/html/config.json.template

# Copy nginx config
COPY default.conf /etc/nginx/conf.d/default.conf

# Startup script: substitute env vars into config, then start nginx
RUN printf '#!/bin/sh\nenvsubst < /usr/share/nginx/html/config.json.template > /usr/share/nginx/html/config.json\nexec nginx -g "daemon off;"' \
    > /docker-entrypoint.sh && chmod +x /docker-entrypoint.sh

RUN chmod -R 755 /usr/share/nginx/html

EXPOSE 80

CMD ["/docker-entrypoint.sh"]
