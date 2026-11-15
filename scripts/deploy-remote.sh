#!/usr/bin/env bash
# Copyright (c) 2026 Nida Akın. All rights reserved.
# Developed by PaperAxis · paperaxis.com
#
# Sunucu tarafı dağıtım betiği — GitHub Actions (deploy.yml) SSH ile çalıştırır; elle de çalıştırılabilir.
# Derleme sunucuda YAPILMAZ: CI'da hazırlanan paket (.next/standalone + dist-scripts + prisma) açılır.
#
#   APP_ROOT=/home/KULLANICI/nidaakin bash deploy-remote.sh deploy <revizyon>   # .deploy/releases/<revizyon> açılmış olmalı
#   APP_ROOT=… bash deploy-remote.sh deploy-bg <revizyon>   # aynısı, SSH'tan bağımsız arka planda (CI bunu kullanır);
#                                                          # günlük: .deploy/logs/<revizyon>.log, çıkış kodu: <...>.log.exit
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
mkdir -p "$STATE/releases" "$STATE/previous" "$STATE/incoming" "$STATE/logs"
chmod 700 "$STATE"

# Arka planda dağıtım: SSH bağlantısı kopsa ya da CI işi zaman aşımına uğrasa da sunucuda iş sonuna kadar sürer.
# Kilit almadan önce ayrılır (kilidi asıl "deploy" süreci alır).
if [ "${1:-}" = "deploy-bg" ]; then
  [ -n "${2:-}" ] || { echo "Kullanım: deploy-remote.sh deploy-bg <revizyon>" >&2; exit 1; }
  SELF="$(cd "$(dirname "$0")" && pwd -P)/$(basename "$0")"
  LOG="$STATE/logs/$2.log"
  rm -f "$LOG" "$LOG.exit"
  # shellcheck disable=SC2016
  RUNNER='bash "$0" deploy "$1" > "$2" 2>&1; echo $? > "$2.exit"'
  if command -v setsid >/dev/null 2>&1; then
    setsid nohup bash -c "$RUNNER" "$SELF" "$2" "$LOG" < /dev/null > /dev/null 2>&1 &
  else
    nohup bash -c "$RUNNER" "$SELF" "$2" "$LOG" < /dev/null > /dev/null 2>&1 &
  fi
  echo "Dağıtım arka planda başladı. Günlük: $LOG"
  # Eski günlükleri temizle (son 20)
  # shellcheck disable=SC2012
  { ls -1t "$STATE/logs/"*.log 2>/dev/null || true; } | tail -n +21 | while read -r f; do rm -f "$f" "$f.exit"; done
  exit 0
fi

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
# Paylaşımlı hostingde (CloudLinux LVE) hesap başına thread sınırı var. V8 varsayılan olarak çekirdek sayısı kadar
# arka plan thread'i açar; sınıra çarpınca prisma CLI ya SIGABRT ile çöker ya da migrate deploy sessizce takılır
# (günlükte yanıltıcı "P1001 Can't reach database server" görünür). Bu betikteki tüm node/npm/npx çağrıları için tek thread.
export NODE_OPTIONS="--v8-pool-size=1${NODE_OPTIONS:+ $NODE_OPTIONS}"
# Prisma şema motoru (Rust/tokio) da çekirdek sayısı kadar thread açar (48 çekirdekli sunucuda ~50) ve ortam
# değişkeniyle kısılamıyor. Betiği 2 çekirdeğe bağlıyoruz; bağlama alt süreçlere miras geçer (ölçüldü: 51 → 5 thread).
if command -v taskset >/dev/null 2>&1; then taskset -cp 0,1 $$ >/dev/null 2>&1 || true; fi
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

# Migration: .env'deki adresle dene; "veritabanına ulaşılamadı" (P1001) olursa önce 127.0.0.1 (Node "localhost"u IPv6 ::1
# olarak çözebilir, cPanel MySQL çoğu zaman yalnızca IPv4/soket dinler), sonra yerel MySQL soket dosyası denenir.
# Yalnızca bu komutun ortamı değişir; .env ve site etkilenmez.
migrate_deploy() {
  local out url sock
  if out="$(npx --no-install prisma migrate deploy 2>&1)"; then printf '%s\n' "$out"; return 0; fi
  printf '%s\n' "$out"
  printf '%s' "$out" | grep -q 'P1001' || return 1
  url="$(node -e 'const u=new URL(process.env.DATABASE_URL);if(u.hostname!=="localhost")process.exit(1);u.hostname="127.0.0.1";process.stdout.write(u.toString())' 2>/dev/null || true)"
  if [ -n "$url" ]; then
    echo "→ localhost yerine 127.0.0.1 ile deneniyor"
    if out="$(DATABASE_URL="$url" npx --no-install prisma migrate deploy 2>&1)"; then printf '%s\n' "$out"; return 0; fi
    printf '%s\n' "$out"
  fi
  for sock in /var/lib/mysql/mysql.sock /run/mysqld/mysqld.sock /var/run/mysqld/mysqld.sock /tmp/mysql.sock; do
    [ -S "$sock" ] || continue
    url="$(SOCK="$sock" node -e 'const u=new URL(process.env.DATABASE_URL);u.searchParams.set("socket",process.env.SOCK);process.stdout.write(u.toString())')"
    echo "→ MySQL soketi ile deneniyor: $sock"
    if DATABASE_URL="$url" npx --no-install prisma migrate deploy; then return 0; fi
  done
  echo "✖ Veritabanına ulaşılamadı. .env'deki DATABASE_URL'i kontrol edin (cPanel → MySQL Databases)." >&2
  return 1
}

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
      echo "İlk kurulumda paylaşımlı hostingde 10–20 dakika sürebilir; sonraki dağıtımlarda bu adım atlanır."
      npm ci --include=dev --ignore-scripts --no-audit --no-fund --no-progress --prefer-offline
      printf '%s' "$LOCK_HASH" > "$STATE/lock.sha256"
    else
      step "Bağımlılıklar güncel (paket kilidi değişmedi)"
    fi

    step "Veritabanı güncellemeleri (prisma migrate deploy)"
    migrate_deploy

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
