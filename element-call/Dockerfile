FROM nginx:alpine

RUN rm -rf /usr/share/nginx/html/*

# Download and extract element-call from releases
RUN apk add --no-cache wget && \
    wget -qO- https://releases.element.io/element-call/latest/element-call.tar.gz | tar xvz -C /usr/share/nginx/html && \
    apk del wget

COPY config.json /usr/share/nginx/html/config.json

EXPOSE 80