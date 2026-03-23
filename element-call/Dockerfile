# Stage 1: Get files
FROM ghcr.io/element-hq/element-call:latest AS element-files

# Stage 2: Standard Nginx
FROM nginx:alpine

# 1. Copy web files
COPY --from=element-files /app /usr/share/nginx/html

# 2. Copy config
COPY config.json /usr/share/nginx/html/config.json

# 3. Copy the STATIC conf file (Notice we moved it to conf.d)
COPY default.conf /etc/nginx/conf.d/default.conf

RUN chmod -R 755 /usr/share/nginx/html

EXPOSE 80