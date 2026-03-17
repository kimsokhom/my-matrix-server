FROM ghcr.io/element-hq/element-call:latest AS element-files

FROM nginx:alpine
# Copy web files to the standard Nginx location
COPY --from=element-files /app /usr/share/nginx/html

# Copy your config and template
COPY config.json /usr/share/nginx/html/config.json
COPY default.conf.template /etc/nginx/templates/default.conf.template

# Force permissions
RUN chmod -R 755 /usr/share/nginx/html

EXPOSE 80