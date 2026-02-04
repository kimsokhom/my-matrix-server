FROM dock.mau.dev/mautrix/telegram:latest
# Copy our custom config into the image
COPY config.yaml /data/config.yaml
# Copy the registration "key" so the bridge knows it
COPY registration.yaml /data/registration.yaml