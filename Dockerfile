FROM nginx:alpine

COPY ./nginx/conf.d/default.conf /etc/nginx/conf.d/default.conf

COPY  /app/ /usr/share/nginx/html/

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost/ || exit 1

CMD ["nginx", "-g", "daemon off;"]