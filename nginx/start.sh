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

# Use branch-specific/public Hydra URL when provided; otherwise fall back to internal service URL.
export HYDRA_UPSTREAM="${HYDRA_UPSTREAM:-${HYDRA_URL:-http://hydra.railway.internal:4444}}"

echo "Using DNS resolver: ${DNS_RESOLVER}"
echo "Using Hydra upstream: ${HYDRA_UPSTREAM}"

# Render nginx config using env vars
envsubst '${DNS_RESOLVER} ${HYDRA_UPSTREAM}' \
  < /etc/nginx/templates/default.conf.template \
  > /etc/nginx/conf.d/default.conf

exec nginx -g 'daemon off;'