# ── Derleme ──
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
COPY prisma ./prisma
COPY prisma.config.ts ./
RUN npm ci
COPY . .
RUN npx prisma generate && npm run build

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
RUN npm ci --omit=dev --ignore-scripts && npm i --no-save prisma@7.10.1 dotenv && npx prisma generate
COPY --from=build /app/dist ./dist
COPY --from=build /app/dist-server ./dist-server
COPY --from=build /app/server/generated ./server/generated
RUN mkdir -p /app/storage && chown -R node:node /app/storage
USER node
EXPOSE 4000
# Migration'ları uygula, sonra sunucuyu başlat
CMD ["sh", "-c", "npx prisma migrate deploy && node dist-server/index.js"]
