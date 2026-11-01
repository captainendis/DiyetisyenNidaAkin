# ── Derleme ──
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
COPY prisma ./prisma
COPY prisma.config.ts ./
# prisma.config.ts DATABASE_URL'i şart koşuyor; generate bağlanmaz, yer tutucu yeter.
ARG DATABASE_URL=postgresql://build:build@localhost:5432/build
RUN DATABASE_URL="$DATABASE_URL" npm ci
COPY . .
RUN DATABASE_URL="$DATABASE_URL" npx prisma generate && npm run build

# ── Çalıştırma ──
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
# Beslenme planı PDF'leri için Chromium (yazı tipi PDF'e gömülür; sistem fontu gerekmez)
RUN apk add --no-cache chromium
ENV CHROMIUM_PATH=/usr/bin/chromium-browser
COPY package*.json ./
COPY prisma ./prisma
COPY prisma.config.ts ./
ARG DATABASE_URL=postgresql://build:build@localhost:5432/build
# prisma ve dotenv devDependency; NODE_ENV=production iken `npm i` onları atlıyor.
# Migration CLI'ı için ayrı dizine kurulup app'in paketlerini ezmeden eklenir.
RUN npm ci --omit=dev --ignore-scripts \
 && mkdir /tmp/cli && cd /tmp/cli && npm init -y >/dev/null && npm i prisma@7.10.1 dotenv \
 && cd /tmp/cli/node_modules && for p in $(ls -A); do \
      case "$p" in \
        @*|.bin) mkdir -p "/app/node_modules/$p"; \
                 for s in $(ls -A "$p"); do [ -e "/app/node_modules/$p/$s" ] || cp -a "$p/$s" "/app/node_modules/$p/"; done ;; \
        *) [ -e "/app/node_modules/$p" ] || cp -a "$p" /app/node_modules/ ;; \
      esac; \
    done && rm -rf /tmp/cli \
 && cd /app && DATABASE_URL="$DATABASE_URL" npx prisma generate
COPY --from=build /app/dist ./dist
COPY --from=build /app/dist-server ./dist-server
COPY --from=build /app/server/generated ./server/generated
RUN mkdir -p /app/storage && chown -R node:node /app/storage
USER node
EXPOSE 4000
# Migration'ları uygula, sonra sunucuyu başlat
CMD ["sh", "-c", "npx prisma migrate deploy && node dist-server/index.js"]
