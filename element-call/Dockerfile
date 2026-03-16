# Stage 1: Get files from the official image
FROM ghcr.io/element-hq/element-call:latest AS element-files

# Stage 2: Standard Nginx (This fixes the 'Permission Denied' error)
FROM nginx:alpine

# 1. Copy web files from official image
COPY --from=element-files /app /app

# 2. Copy config (Relative to /element-call)
COPY config.json /app/config.json

# 3. Copy the template (Relative to /element-call)
COPY default.conf.template /etc/nginx/templates/default.conf.template

EXPOSE 80