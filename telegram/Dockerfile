FROM dock.mau.dev/mautrix/telegram:latest

# Install envsubst for environment variable substitution
RUN apk add --no-cache gettext

# Copy config and registration as templates
COPY config.yaml /etc/mautrix-telegram/config.yaml.template
COPY registration.yaml /etc/mautrix-telegram/registration.yaml.template

# Create entrypoint script to substitute variables
RUN printf '#!/bin/sh\n\
set -e\n\
echo "Substituting environment variables..."\n\
envsubst < /etc/mautrix-telegram/config.yaml.template > /etc/mautrix-telegram/config.yaml\n\
envsubst < /etc/mautrix-telegram/registration.yaml.template > /etc/mautrix-telegram/registration.yaml\n\
echo "Starting Mautrix-Telegram bridge..."\n\
exec python3 -m mautrix_telegram -c /etc/mautrix-telegram/config.yaml\n' > /start.sh && \
    chmod +x /start.sh

EXPOSE 29317

ENTRYPOINT ["/start.sh"]