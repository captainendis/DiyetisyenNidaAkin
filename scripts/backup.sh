#!/usr/bin/env bash
# Copyright (c) 2026 Nida Akın. All rights reserved.
# Developed by PaperAxis · paperaxis.com
# Veritabanı + şifreli dosya yedeği
#   ./scripts/backup.sh [hedef_klasör]
# Gereksinim: mysqldump (MySQL/MariaDB istemcisi; cPanel sunucularında kuruludur). DATABASE_URL .env'den okunur.
# Yedekler şifreli DEĞİLDİR (dosyalar zaten AES-256-GCM ile şifreli; veritabanı dökümü kişisel veri içerir) —
# yedekleri şifreli bir hedefe taşıyın ve erişimi kısıtlayın. DATA_ENCRYPTION_KEY yedeklerle AYNI yerde saklanmamalıdır.
set -euo pipefail
cd "$(dirname "$0")/.."
[ -f .env ] && set -a && . ./.env && set +a
DEST="${1:-./backups}"
STAMP="$(date +%Y%m%d-%H%M%S)"
mkdir -p "$DEST"
chmod 700 "$DEST"

# mysql://kullanici:sifre@sunucu:port/veritabani?... → parçalar (şifre URL kodlu olabilir)
URL="${DATABASE_URL#*://}"; URL="${URL%%\?*}"
CRED="${URL%@*}"; HOSTPART="${URL##*@}"
DB_USER="${CRED%%:*}"; DB_PASS="$(node -e 'process.stdout.write(decodeURIComponent(process.argv[1]))' "${CRED#*:}")"
HOSTPORT="${HOSTPART%%/*}"; DB_NAME="${HOSTPART#*/}"
DB_HOST="${HOSTPORT%%:*}"; DB_PORT="3306"; [[ "$HOSTPORT" == *:* ]] && DB_PORT="${HOSTPORT##*:}"

# Şifre komut satırında görünmesin diye geçici seçenek dosyası
CNF="$(mktemp)"; trap 'rm -f "$CNF"' EXIT; chmod 600 "$CNF"
printf '[client]\nuser=%s\npassword="%s"\nhost=%s\nport=%s\n' "$DB_USER" "$DB_PASS" "$DB_HOST" "$DB_PORT" > "$CNF"
mysqldump --defaults-extra-file="$CNF" --single-transaction --routines --default-character-set=utf8mb4 "$DB_NAME" | gzip > "$DEST/db-$STAMP.sql.gz"
tar -czf "$DEST/storage-$STAMP.tar.gz" -C "${UPLOAD_DIR:-./storage}" .
chmod 600 "$DEST"/*-"$STAMP".*
echo "✓ Yedek alındı: $DEST/db-$STAMP.sql.gz, $DEST/storage-$STAMP.tar.gz"
# Geri yükleme:
#   gunzip < backups/db-XXXX.sql.gz | mysql -u KULLANICI -p VERITABANI
#   tar -xzf backups/storage-XXXX.tar.gz -C storage/
