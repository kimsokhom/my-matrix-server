FROM matrixdotorg/synapse:latest

RUN apt-get update && \
    apt-get install -y --no-install-recommends gettext-base python3-pip && \
    rm -rf /var/lib/apt/lists/*

COPY homeserver.yaml /etc/synapse/homeserver.yaml.template
COPY registration.yaml /etc/synapse/registration.yaml.template
COPY start.sh /start.sh

RUN chmod +x /start.sh

EXPOSE 8008
ENTRYPOINT ["/start.sh"]