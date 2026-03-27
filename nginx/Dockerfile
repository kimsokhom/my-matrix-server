FROM nginx:latest

# Install envsubst (included in gettext-base)
RUN apt-get update && \
    apt-get install -y --no-install-recommends gettext-base && \
    rm -rf /var/lib/apt/lists/*

# Remove the default Nginx config
RUN rm /etc/nginx/conf.d/default.conf

# Copy config as a template, and copy start script
COPY default.conf /etc/nginx/conf.d/default.conf.template
COPY start.sh /start.sh

RUN chmod +x /start.sh

EXPOSE 80
ENTRYPOINT ["/start.sh"]