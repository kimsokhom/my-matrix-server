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

# Fallback to public gateway if internal hydra DNS is unavailable in this project network.
export HYDRA_UPSTREAM="${HYDRA_UPSTREAM:-https://gateway-sengly-branch.up.railway.app}"

echo "Using DNS resolver: ${DNS_RESOLVER}"
echo "Using Hydra upstream: ${HYDRA_UPSTREAM}"

# Render nginx config using env vars
envsubst '${DNS_RESOLVER} ${HYDRA_UPSTREAM}' \
  < /etc/nginx/templates/default.conf.template \
  > /etc/nginx/conf.d/default.conf

exec nginx -g 'daemon off;'