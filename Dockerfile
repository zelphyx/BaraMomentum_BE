# Stage 1: Build
FROM node:22-alpine AS builder
WORKDIR /app

# Install OpenSSL untuk Prisma + build tools untuk Sharp
RUN apk add --no-cache openssl python3 make g++ libc6-compat

COPY package.json package-lock.json* ./
RUN npm ci

COPY tsconfig.json tsconfig.build.json nest-cli.json ./
COPY prisma ./prisma
COPY src ./src

RUN npx prisma generate
RUN npm run build && npm prune --omit=dev

# Stage 2: Runtime
FROM node:22-alpine AS runtime
WORKDIR /app

RUN apk add --no-cache openssl tini tzdata && \
    cp /usr/share/zoneinfo/Asia/Jakarta /etc/localtime && \
    echo "Asia/Jakarta" > /etc/timezone

ENV NODE_ENV=production
ENV TZ=Asia/Jakarta
ENV PORT=3001

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY package.json ./

EXPOSE 3001

USER node
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/main.js"]