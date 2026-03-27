# Stage 1: Get files
FROM ghcr.io/element-hq/element-call:latest AS element-files

# Stage 2: Standard Nginx
FROM nginx:alpine

# Install envsubst
RUN apk add --no-cache gettext

# 1. Copy web files
COPY --from=element-files /app /usr/share/nginx/html

# 2. Copy config template
COPY config.json /usr/share/nginx/html/config.json.template

# 3. Copy the FIXED static conf file
COPY default.conf /etc/nginx/conf.d/default.conf

# 4. Copy start script
COPY start.sh /start.sh

RUN chmod +x /start.sh && \
    chmod -R 755 /usr/share/nginx/html

EXPOSE 80

ENTRYPOINT ["/start.sh"]