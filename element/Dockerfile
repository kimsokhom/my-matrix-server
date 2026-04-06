FROM vectorim/element-web:latest

USER root

COPY config.json /app/config.json.template
RUN touch /app/config.json && chmod 666 /app/config.json

ENTRYPOINT []
CMD envsubst '${SERVER_NAME} ${MAS_URL} ${ELEMENT_WEB_CLIENT_ID}' \
  < /app/config.json.template \
  > /app/config.json \
  && nginx -g 'daemon off;'
