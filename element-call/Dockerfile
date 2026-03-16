# Stage 1: Get files from the official image
FROM ghcr.io/element-hq/element-call:latest AS element-files

# Stage 2: Standard Nginx (Fixes the 'Permission Denied' error)
FROM nginx:alpine

# 1. Copy web files
COPY --from=element-files /app /app

# 2. Copy config 
# (This works because Docker sees these files in its root)
COPY config.json /app/config.json

# 3. Copy the template 
# (This only works if you manually copied the file into /element-call)
COPY default.conf.template /etc/nginx/templates/default.conf.template

EXPOSE 80