#!/bin/sh
set -eu

# Export resolvers for nginx template rendering.
# Use all nameservers from /etc/resolv.conf to match container runtime DNS.
RESOLVERS="$(awk '/^nameserver/ {printf "%s ", $2}' /etc/resolv.conf | sed 's/[[:space:]]*$//')"

if [ -z "${RESOLVERS}" ]; then
  RESOLVERS="127.0.0.11"
fi

export NGINX_LOCAL_RESOLVERS="${RESOLVERS}"
echo "Using NGINX_LOCAL_RESOLVERS=${NGINX_LOCAL_RESOLVERS}"
