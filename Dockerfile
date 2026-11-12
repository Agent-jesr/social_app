FROM node:20-alpine

RUN apk add --no-cache python3 make g++ vips-dev build-base

WORKDIR /app

RUN apk add --no-cache --repository=http://dl-cdn.alpinelinux.org/alpine/v3.20/community \
    python3 make g++ vips-dev build-base openssl
    
COPY package*.json ./
COPY prisma ./prisma/
RUN npm install
RUN npx prisma generate
COPY . .
EXPOSE 5000
CMD ["sh", "-c", "npx prisma db push --accept-data-loss && node index.js"]