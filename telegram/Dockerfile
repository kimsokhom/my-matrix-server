FROM dock.mau.dev/mautrix/telegram:latest

# We must declare USER root because the base image switches to UID 1337 
USER root
RUN apk add --no-cache gettext

COPY config.yaml /etc/mautrix-telegram/config.yaml.template
COPY registration.yaml /etc/mautrix-telegram/registration.yaml.template
COPY start.sh /start.sh

RUN chmod +x /start.sh

EXPOSE 29317
ENTRYPOINT ["/start.sh"]