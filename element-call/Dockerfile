FROM nginx:alpine
RUN rm -rf /usr/share/nginx/html/*
RUN wget -qO- https://github.com/element-hq/element-call/releases/latest/download/element-call.tar.gz | tar xvz -C /usr/share/nginx/html
COPY config.json /usr/share/nginx/html/config.json
EXPOSE 80