#!/bin/bash
set -e

echo "Substituting Nginx environment variables..."

# By using "$NGINX_ENVSUBST_FILTER" (with double quotes), the script will pull
# the exact list of variables you define in Railway's dashboard!
envsubst "$NGINX_ENVSUBST_FILTER" \
    < /etc/nginx/conf.d/default.conf.template > /etc/nginx/conf.d/default.conf

echo "Starting Nginx..."
exec nginx -g 'daemon off;'