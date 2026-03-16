# Stage 1: Get files from official image
FROM ghcr.io/element-hq/element-call:latest AS element-files

# Stage 2: Standard Nginx
FROM nginx:alpine

# 1. Copy web files to the standard Nginx HTML folder
COPY --from=element-files /app /usr/share/nginx/html

# 2. Copy your config into that same folder
COPY element-call/config.json /usr/share/nginx/html/config.json

# 3. Copy the Nginx template
COPY default.conf.template /etc/nginx/templates/default.conf.template

# 4. Fix permissions so Nginx can definitely read the files
RUN chmod -R 755 /usr/share/nginx/html

EXPOSE 80