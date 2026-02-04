FROM dock.mau.dev/mautrix/telegram:latest

# Copy your files to a safe folder
COPY config.yaml /etc/mautrix-telegram/config.yaml
COPY registration.yaml /etc/mautrix-telegram/registration.yaml

# We tell the bridge exactly where the config is
CMD ["python3", "-m", "mautrix_telegram", "-c", "/etc/mautrix-telegram/config.yaml"]