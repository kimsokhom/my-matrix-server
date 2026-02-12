FROM dock.mau.dev/mautrix/telegram:latest

# 1. Switch to root to ensure we have permissions to write to the volume
USER root

# 2. Install gettext for envsubst
RUN apk add --no-cache gettext

# 3. Copy templates to /tmp (Safe from Volume Shadowing)
COPY config.yaml /tmp/config.yaml.template
COPY registration.yaml /tmp/registration.yaml.template

# 4. Create the improved startup script
RUN printf '#!/bin/sh\n\
set -e\n\
echo "Current directory: $(pwd)"\n\
echo "Substituting environment variables..."\n\
\n\
# Ensure the directory on the volume exists\n\
mkdir -p /etc/mautrix-telegram\n\
\n\
# Generate configs from /tmp into the volume path\n\
envsubst < /tmp/config.yaml.template > /etc/mautrix-telegram/config.yaml\n\
envsubst < /tmp/registration.yaml.template > /etc/mautrix-telegram/registration.yaml\n\
\n\
echo "Files in /etc/mautrix-telegram:"\n\
ls -l /etc/mautrix-telegram\n\
\n\
echo "Starting Mautrix-Telegram bridge..."\n\
exec python3 -m mautrix_telegram -c /etc/mautrix-telegram/config.yaml\n' > /start.sh && \
    chmod +x /start.sh

EXPOSE 29317

# 5. Use /bin/sh to run the script to avoid execution errors
ENTRYPOINT ["/bin/sh", "/start.sh"]