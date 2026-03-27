FROM nginx:alpine
RUN apk add --no-cache bash gettext
RUN rm /etc/nginx/conf.d/default.conf
COPY default.conf /etc/nginx/templates/default.conf.template
COPY start.sh /start.sh
RUN chmod +x /start.sh
EXPOSE 80
CMD ["/start.sh"]