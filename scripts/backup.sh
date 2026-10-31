#!/usr/bin/env bash
# Veritabanı + şifreli dosya yedeği
#   ./scripts/backup.sh [hedef_klasör]
# Gereksinim: pg_dump (PostgreSQL istemcisi). DATABASE_URL .env'den okunur.
# Yedekler şifreli DEĞİLDİR (dosyalar zaten AES-256-GCM ile şifreli; veritabanı dökümü kişisel veri içerir) —
# yedekleri şifreli bir hedefe (ör. şifreli disk / sunucu tarafı şifrelemeli nesne depolama) taşıyın ve
# erişimi kısıtlayın. DATA_ENCRYPTION_KEY yedeklerle AYNI yerde saklanmamalıdır.
set -euo pipefail
cd "$(dirname "$0")/.."
[ -f .env ] && set -a && . ./.env && set +a
DEST="${1:-./backups}"
STAMP="$(date +%Y%m%d-%H%M%S)"
mkdir -p "$DEST"
chmod 700 "$DEST"
DB_URL="${DATABASE_URL%%\?*}"
pg_dump --format=custom --no-owner --file "$DEST/db-$STAMP.dump" "$DB_URL"
tar -czf "$DEST/storage-$STAMP.tar.gz" -C "${UPLOAD_DIR:-./storage}" .
chmod 600 "$DEST"/*-"$STAMP".*
echo "✓ Yedek alındı: $DEST/db-$STAMP.dump, $DEST/storage-$STAMP.tar.gz"
# Geri yükleme:
#   pg_restore --clean --no-owner -d "$DATABASE_URL" backups/db-XXXX.dump
#   tar -xzf backups/storage-XXXX.tar.gz -C storage/
