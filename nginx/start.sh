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

# Determine Hydra upstream URL with fallback chain:
# 1. Explicit HYDRA_UPSTREAM env var (preferred)
# 2. HYDRA_URL env var
# 3. HYDRA_HOST if set (internal service name)
# 4. Try Railway private DNS: http://hydra.railway.internal:4444
# 5. Last resort: http://hydra:4444 (service discovery alias)

if [ -z "$HYDRA_UPSTREAM" ]; then
  if [ -n "$HYDRA_URL" ]; then
    export HYDRA_UPSTREAM="$HYDRA_URL"
  elif [ -n "$HYDRA_HOST" ]; then
    export HYDRA_UPSTREAM="http://${HYDRA_HOST}:4444"
  else
    # Prefer Railway private DNS name; fall back to simple service alias.
    export HYDRA_UPSTREAM="http://hydra.railway.internal:4444"
  fi
fi

echo "Using DNS resolver: ${DNS_RESOLVER}"
echo "Using Hydra upstream: ${HYDRA_UPSTREAM}"

# Render nginx config using env vars
envsubst '${DNS_RESOLVER} ${HYDRA_UPSTREAM}' \
  < /etc/nginx/templates/default.conf.template \
  > /etc/nginx/conf.d/default.conf

# Log the rendered nginx config (for debugging)
echo "Rendered nginx config:"
head -30 /etc/nginx/conf.d/default.conf

exec nginx -g 'daemon off;'