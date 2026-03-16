FROM nginx:alpine

RUN rm -rf /usr/share/nginx/html/*

# Install wget and tar, download a specific stable version of Element Call
# Using v0.6.0 as an example (check GitHub for the latest version tag)
RUN apk add --no-cache wget tar && \
    wget -qO element-call.tar.gz https://github.com/element-hq/element-call/releases/download/v0.6.0/element-call.tar.gz && \
    tar -xvf element-call.tar.gz -C /usr/share/nginx/html --strip-components=1 && \
    rm element-call.tar.gz && \
    apk del wget

COPY config.json /usr/share/nginx/html/config.json

EXPOSE 80