FROM nginx:latest

# 1. Remove the default Nginx config so it doesn't override yours
RUN rm /etc/nginx/conf.d/default.conf

# 2. Detect DNS resolvers before envsubst renders templates
COPY detect-dns-resolver.sh /docker-entrypoint.d/15-detect-dns-resolver.sh
RUN chmod +x /docker-entrypoint.d/15-detect-dns-resolver.sh

# 3. Copy config as template so docker-entrypoint envsubst can inject local DNS resolvers
COPY default.conf /etc/nginx/templates/default.conf.template

EXPOSE 80