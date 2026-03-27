FROM nginx:latest

# 1. Remove the default Nginx config so it doesn't override yours
RUN rm /etc/nginx/conf.d/default.conf

# 2. Copy config as template so docker-entrypoint envsubst can inject local DNS resolvers
COPY default.conf /etc/nginx/templates/default.conf.template

EXPOSE 80