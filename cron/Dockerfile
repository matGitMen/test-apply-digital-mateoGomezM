FROM alpine:3.18

RUN apk add --no-cache curl

COPY crontab /etc/crontabs/root
RUN sed -i 's/\r$//' /etc/crontabs/root

CMD ["crond", "-f"]
