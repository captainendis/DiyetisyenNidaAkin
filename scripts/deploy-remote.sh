#!/usr/bin/env bash
# Copyright (c) 2026 Nida Akın. All rights reserved.
# Developed by PaperAxis · paperaxis.com
#
# Sunucu tarafı dağıtım betiği — GitHub Actions (deploy.yml) SSH ile çalıştırır; elle de çalıştırılabilir.
# Derleme sunucuda YAPILMAZ: CI'da hazırlanan paket (.next/standalone + dist-scripts + prisma) açılır.
#
#   APP_ROOT=/home/KULLANICI/nidaakin bash deploy-remote.sh deploy <revizyon>   # .deploy/releases/<revizyon> açılmış olmalı
#   APP_ROOT=/home/KULLANICI/nidaakin bash deploy-remote.sh rollback            # bir önceki derlemeye dön (veritabanı DEĞİL)
#   APP_ROOT=/home/KULLANICI/nidaakin bash deploy-remote.sh status
#
# Adımlar (deploy): kilit → ortam/anahtar kontrolü → YEDEK → araç dosyaları + bağımlılıklar (paket kilidi değiştiyse)
#                   → migration → yeni derlemeye geçiş (eskisi saklanır) → yeniden başlatma
# Herhangi bir adım hata verirse betik durur; yeni derlemeye geçilmeden önceki hatalarda canlı site etkilenmez.
#
# Ortam:
#   APP_ROOT          Uygulama kök klasörü (cPanel "Application root"). Zorunlu.
#   NODE_ACTIVATE     İsteğe bağlı: Node ortamını açan betik (cPanel: /home/KULLANICI/nodevenv/<uygulama>/22/bin/activate)
#   RESTART_CMD       İsteğe bağlı: yeniden başlatma komutu (VPS: "pm2 reload nidaakin"). Boşsa Passenger: tmp/restart.txt
#   BACKUP_KEEP       Saklanacak yedek sayısı (varsayılan 14)
#   KEEP_RELEASES     Geri dönüş için saklanacak eski derleme sayısı (varsayılan 3)
#   SKIP_BACKUP=1     Yedeği atla (önerilmez; yalnızca mysqldump olmayan ortamlar için)
set -euo pipefail

ACTION="${1:-}"
REV="${2:-}"
: "${APP_ROOT:?APP_ROOT tanımlı değil}"
BACKUP_KEEP="${BACKUP_KEEP:-14}"
KEEP_RELEASES="${KEEP_RELEASES:-3}"

cd "$APP_ROOT"
APP_ROOT="$(pwd -P)"
STATE="$APP_ROOT/.deploy"
mkdir -p "$STATE/releases" "$STATE/previous" "$STATE/incoming"
chmod 700 "$STATE"

step() { printf '\n\033[1m▸ %s\033[0m\n' "$*"; }
fail() { printf '\n\033[31m✖ %s\033[0m\n' "$*" >&2; exit 1; }

# ── Kilit: aynı anda iki dağıtım çalışmasın ──
if command -v flock >/dev/null 2>&1; then
  exec 9>"$STATE/lock"
  flock -n 9 || fail "Başka bir dağıtım sürüyor (.deploy/lock)."
else
  mkdir "$STATE/lock.d" 2>/dev/null || fail "Başka bir dağıtım sürüyor (.deploy/lock.d). Takılı kaldıysa klasörü silin."
  trap 'rmdir "$STATE/lock.d" 2>/dev/null || true' EXIT
fi

# ── Node ──
if [ -n "${NODE_ACTIVATE:-}" ]; then
  # shellcheck disable=SC1090
  set +u; . "$NODE_ACTIVATE"; set -u
fi
command -v node >/dev/null 2>&1 || fail "node bulunamadı. NODE_ACTIVATE ile Node ortamını belirtin."
node -e 'const [a,b]=process.versions.node.split(".").map(Number);process.exit(a>20||(a===20&&b>=19)?0:1)' \
  || fail "Node.js 20.19+ gerekli (bulunan: $(node -v))."

# ── Ortam değişkenleri: sunucudaki .env (git'te yok) ──
[ -f "$APP_ROOT/.env" ] || fail ".env bulunamadı ($APP_ROOT/.env). Üretim değişkenlerini bu dosyaya yazın (docs/DEPLOY.md)."
set -a
# shellcheck disable=SC1091
. "$APP_ROOT/.env"
set +a
export NODE_ENV=production
: "${DATABASE_URL:?.env içinde DATABASE_URL yok}"
: "${DATA_ENCRYPTION_KEY:?.env içinde DATA_ENCRYPTION_KEY yok}"
# Göreli UPLOAD_DIR uygulama köküne göre çözülür (yedek betiği başka klasörden çalışabilir)
case "${UPLOAD_DIR:-./storage}" in
  /*) ;;
  *) export UPLOAD_DIR="$APP_ROOT/${UPLOAD_DIR:-./storage}" ;;
esac

restart() {
  if [ -n "${RESTART_CMD:-}" ]; then
    step "Yeniden başlatılıyor: $RESTART_CMD"
    bash -c "$RESTART_CMD"
  else
    step "Yeniden başlatılıyor (Passenger: tmp/restart.txt)"
    mkdir -p "$APP_ROOT/tmp"
    touch "$APP_ROOT/tmp/restart.txt"
  fi
}

# Çalışan derleme (.next + dist-scripts) ↔ hedef klasör. Taşıma aynı dosya sisteminde, anlık.
swap_in() {
  local src="$1"
  rm -rf "$APP_ROOT/.next.incoming" "$APP_ROOT/dist-scripts.incoming"
  mv "$src/.next" "$APP_ROOT/.next.incoming"
  [ -d "$src/dist-scripts" ] && mv "$src/dist-scripts" "$APP_ROOT/dist-scripts.incoming"
  [ -d "$APP_ROOT/.next" ] && mv "$APP_ROOT/.next" "$src/.next.old"
  mv "$APP_ROOT/.next.incoming" "$APP_ROOT/.next"
  if [ -d "$APP_ROOT/dist-scripts.incoming" ]; then
    [ -d "$APP_ROOT/dist-scripts" ] && mv "$APP_ROOT/dist-scripts" "$src/dist-scripts.old"
    mv "$APP_ROOT/dist-scripts.incoming" "$APP_ROOT/dist-scripts"
  fi
  # Standalone sunucu .env'i kendi klasöründen okur: tek kaynak uygulama kökündeki .env
  ln -sfn "$APP_ROOT/.env" "$APP_ROOT/.next/standalone/.env"
}

case "$ACTION" in
  # ───────────────────────────── deploy ─────────────────────────────
  deploy)
    [ -n "$REV" ] || fail "Kullanım: deploy-remote.sh deploy <revizyon>"
    REL="$STATE/releases/$REV"
    [ -f "$REL/.next/standalone/server.js" ] || fail "Paket eksik: $REL/.next/standalone/server.js"
    CURRENT="$(cat "$STATE/current" 2>/dev/null || echo '')"
    echo "Uygulama: $APP_ROOT"
    echo "Şu anki sürüm: ${CURRENT:-bilinmiyor} → yeni sürüm: $REV"

    # Şifreleme anahtarı değişirse tüm klinik veriler okunamaz: parmak izi ilk dağıtımda kaydedilir, sonra karşılaştırılır
    step "Şifreleme anahtarı kontrolü"
    FP="$(node -e 'process.stdout.write(require("crypto").createHash("sha256").update(process.env.DATA_ENCRYPTION_KEY).digest("hex"))')"
    if [ -f "$STATE/key.sha256" ]; then
      [ "$(cat "$STATE/key.sha256")" = "$FP" ] || fail "DATA_ENCRYPTION_KEY değişmiş! Bu anahtarla mevcut veriler çözülemez. Dağıtım durduruldu."
      echo "✓ Anahtar aynı"
    else
      printf '%s' "$FP" > "$STATE/key.sha256"; chmod 600 "$STATE/key.sha256"
      echo "✓ Anahtar parmak izi kaydedildi (.deploy/key.sha256)"
    fi

    if [ "${SKIP_BACKUP:-0}" = "1" ]; then
      step "Yedek ATLANDI (SKIP_BACKUP=1)"
    else
      step "Yedek alınıyor"
      bash "$REL/scripts/backup.sh" "$APP_ROOT/backups"
      # Eski yedekleri temizle (kişisel veri içerir; gereğinden uzun tutulmamalı)
      for kind in db storage; do
        # shellcheck disable=SC2012
        ls -1t "$APP_ROOT/backups/$kind-"*.gz 2>/dev/null | tail -n +"$((BACKUP_KEEP + 1))" | xargs -r rm -f
      done
    fi

    step "Araç dosyaları güncelleniyor (package.json, prisma, betikler)"
    cp "$REL/package.json" "$REL/package-lock.json" "$REL/prisma.config.ts" "$REL/app.cjs" "$APP_ROOT/"
    mkdir -p "$APP_ROOT/prisma" "$APP_ROOT/scripts"
    rm -rf "$APP_ROOT/prisma/migrations"
    cp -R "$REL/prisma/." "$APP_ROOT/prisma/"
    cp "$REL/scripts/backup.sh" "$REL/scripts/deploy-remote.sh" "$APP_ROOT/scripts/"

    # node_modules yalnızca yönetim araçları içindir (prisma CLI, dist-scripts). Site .next/standalone içindeki
    # kendi bağımlılıklarıyla çalışır; bu adım canlı siteyi etkilemez.
    # Özet = paket kilidi + kurulum biçimi; biçim değişirse (ör. --include=dev) yeniden kurulur
    LOCK_HASH="$(node -e 'process.stdout.write(require("crypto").createHash("sha256").update(require("fs").readFileSync("package-lock.json")).update("include=dev").digest("hex"))')"
    if [ ! -f "$APP_ROOT/node_modules/prisma/package.json" ] || [ ! -f "$APP_ROOT/node_modules/dotenv/package.json" ] \
      || [ "$(cat "$STATE/lock.sha256" 2>/dev/null)" != "$LOCK_HASH" ]; then
      step "Bağımlılıklar kuruluyor (npm ci)"
      # NODE_ENV=production iken npm geliştirme bağımlılıklarını atlar; prisma CLI bunlardan biri
      npm ci --include=dev --ignore-scripts --no-audit --no-fund
      printf '%s' "$LOCK_HASH" > "$STATE/lock.sha256"
    else
      step "Bağımlılıklar güncel (paket kilidi değişmedi)"
    fi

    step "Veritabanı güncellemeleri (prisma migrate deploy)"
    npx --no-install prisma migrate deploy

    step "Yeni derlemeye geçiliyor"
    swap_in "$REL"
    # Eski derleme geri dönüş için saklanır
    if [ -d "$REL/.next.old" ]; then
      PREV_DIR="$STATE/previous/$(date +%Y%m%d-%H%M%S)-${CURRENT:-onceki}"
      mkdir -p "$PREV_DIR"
      mv "$REL/.next.old" "$PREV_DIR/.next"
      if [ -d "$REL/dist-scripts.old" ]; then mv "$REL/dist-scripts.old" "$PREV_DIR/dist-scripts"; fi
      printf '%s' "${CURRENT:-önceki}" > "$PREV_DIR/REVISION"
    fi
    printf '%s' "$REV" > "$STATE/current"
    printf '%s %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$REV" >> "$STATE/history.log"
    restart

    # Temizlik: açılmış paket ve eski derlemeler
    rm -rf "$REL" "$STATE/incoming/$REV.tar.gz"
    # shellcheck disable=SC2012
    ls -1dt "$STATE/previous/"*/ 2>/dev/null | tail -n +"$((KEEP_RELEASES + 1))" | xargs -r rm -rf
    printf '\n\033[32m✓ Dağıtım tamamlandı: %s\033[0m\n' "$REV"
    ;;

  # ───────────────────────────── rollback ─────────────────────────────
  rollback)
    # shellcheck disable=SC2012
    LAST="$(ls -1dt "$STATE/previous/"*/ 2>/dev/null | head -n 1 || true)"
    [ -n "$LAST" ] && [ -d "$LAST/.next" ] || fail "Geri dönülecek önceki derleme yok."
    LAST="${LAST%/}"
    CURRENT="$(cat "$STATE/current" 2>/dev/null || echo 'bilinmiyor')"
    TARGET="$(cat "$LAST/REVISION" 2>/dev/null || echo 'önceki')"
    step "Geri dönülüyor: $CURRENT → $TARGET"
    echo "Not: Yalnızca uygulama kodu geri alınır. Veritabanı değişiklikleri için backups/ altındaki yedeği kullanın (docs/DEPLOY.md → Geri dönüş)."
    swap_in "$LAST"
    # Geri alınan (sorunlu) derleme silinir; bir sonraki geri dönüş bir öncekine gider
    rm -rf "$LAST"
    printf '%s' "$TARGET" > "$STATE/current"
    printf '%s %s (geri dönüş)\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$TARGET" >> "$STATE/history.log"
    restart
    printf '\n\033[32m✓ Geri dönüldü: %s\033[0m\n' "$TARGET"
    ;;

  status)
    echo "Çalışan sürüm: $(cat "$STATE/current" 2>/dev/null || echo bilinmiyor)"
    echo "Saklanan önceki derlemeler:"
    # shellcheck disable=SC2012
    ls -1dt "$STATE/previous/"*/ 2>/dev/null | sed 's#.*/previous/#  #' || true
    echo "Son dağıtımlar:"
    tail -n 5 "$STATE/history.log" 2>/dev/null | sed 's/^/  /' || true
    ;;

  *)
    fail "Kullanım: deploy-remote.sh deploy <revizyon> | rollback | status"
    ;;
esac
