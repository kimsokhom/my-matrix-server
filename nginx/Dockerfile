FROM nginx:latest

# 1. Remove the default Nginx config so it doesn't override yours
RUN rm /etc/nginx/conf.d/default.conf

# 2. Copy your hardcoded config to the config folder
COPY default.conf /etc/nginx/conf.d/default.conf

EXPOSE 80