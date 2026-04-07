FROM nginx:alpine

# Install envsubst (gettext) and remove default config
RUN apk add --no-cache gettext && \
    rm /etc/nginx/conf.d/default.conf

# Copy config template and start script
COPY default.conf /etc/nginx/templates/default.conf.template
COPY start.sh /start.sh

RUN chmod +x /start.sh

EXPOSE 80
ENTRYPOINT ["/start.sh"]
