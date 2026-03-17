FROM nginx:latest

# 1. Force remove the default config and the welcome page
RUN rm /etc/nginx/conf.d/default.conf && rm /usr/share/nginx/html/index.html

# 2. Copy your custom config to the correct location
COPY default.conf /etc/nginx/conf.d/default.conf

EXPOSE 80