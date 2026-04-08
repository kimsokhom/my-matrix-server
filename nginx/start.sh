#!/bin/sh
set -e

# Get DNS resolver from /etc/resolv.conf (Railway's DNS server)
DNS_SERVER=$(awk '/^nameserver/ {print $2; exit}' /etc/resolv.conf)

# Wrap IPv6 addresses in brackets for nginx
if echo "$DNS_SERVER" | grep -q ':'; then
  export DNS_RESOLVER="[${DNS_SERVER}]"
else
  export DNS_RESOLVER="${DNS_SERVER}"
fi

echo "Using DNS resolver: ${DNS_RESOLVER}"
echo "Using Hydra host: ${HYDRA_HOST}"

echo "Substituting Nginx environment variables..."

# Explicitly list only the vars we want substituted.
# DO NOT use bare envsubst or "$NGINX_ENVSUBST_FILTER" - nginx uses $host, $remote_addr,
# etc. which would be wiped to empty if all vars were substituted.
envsubst '$DNS_RESOLVER $HYDRA_HOST $GATEWAY_URL' \
  < /etc/nginx/templates/default.conf.template \
  > /etc/nginx/conf.d/default.conf

# Log the rendered nginx config (for debugging)
echo "Rendered nginx config:"
head -30 /etc/nginx/conf.d/default.conf

echo "Starting Nginx..."
exec nginx -g 'daemon off;'
