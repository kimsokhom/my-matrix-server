FROM nginx:alpine

# Install curl and tar
RUN apk add --no-cache curl tar

RUN rm -rf /usr/share/nginx/html/*

# Download the latest release asset directly from GitHub
# This URL automatically points to the latest tarball in the releases
RUN curl -L https://github.com/element-hq/element-call/releases/latest/download/element-call.tar.gz -o element-call.tar.gz && \
    tar -xvf element-call.tar.gz -C /usr/share/nginx/html --strip-components=1 && \
    rm element-call.tar.gz

# Remove curl to keep the image slim
RUN apk del curl

COPY config.json /usr/share/nginx/html/config.json

EXPOSE 80