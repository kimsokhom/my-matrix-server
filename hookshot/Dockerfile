FROM halfshot/matrix-hookshot:latest

# Install envsubst (for templating config at startup)
USER root
RUN apt-get update && apt-get install -y --no-install-recommends gettext-base && rm -rf /var/lib/apt/lists/*


COPY config.yaml /etc/hookshot/config.yaml.template
COPY registration.yaml /etc/hookshot/registration.yaml.template
COPY start.sh /start.sh
RUN chmod +x /start.sh

# Webhook listener port (external services → hookshot)
EXPOSE 9000
# Bridge port (Synapse → hookshot transactions)
EXPOSE 9993

ENTRYPOINT ["/start.sh"]


