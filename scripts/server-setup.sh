#!/usr/bin/env bash
# Copyright (c) 2026 Nida Akın. All rights reserved.
# Developed by PaperAxis · paperaxis.com
#
# Otomatik dağıtım için SUNUCUDA bir kez çalıştırılır (cPanel → Terminal veya SSH):
#   bash server-setup.sh [uygulama_klasörü]
# Yaptıkları:
#   1. Uygulama klasörünü ve Node ortamını (nodevenv) bulur
#   2. .env yoksa cPanel "Setup Node.js App" değişkenlerinden oluşturur (DATA_ENCRYPTION_KEY dahil, aynen)
#   3. GitHub Actions için SSH anahtarı üretir ve bu hesapta yetkilendirir
#   4. Sunucu parmak izini (known_hosts) alır ve anahtarla girişi dener
#   5. GitHub'a girilecek tüm Secret/Variable değerlerini ekrana yazar
# Tekrar çalıştırmak güvenlidir: var olan .env ve anahtar korunur.
set -euo pipefail

B=$'\033[1m'; G=$'\033[32m'; Y=$'\033[33m'; R=$'\033[31m'; D=$'\033[2m'; N=$'\033[0m'
step() { printf '\n%s▸ %s%s\n' "$B" "$*" "$N"; }
ok()   { printf '%s✓%s %s\n' "$G" "$N" "$*"; }
warn() { printf '%s!%s %s\n' "$Y" "$N" "$*"; }
err()  { printf '%s✖%s %s\n' "$R" "$N" "$*" >&2; }
ask()  { local p="$1" d="${2:-}" v; read -rp "$p${d:+ [$d]}: " v; printf '%s' "${v:-$d}"; }

# ── 1. Uygulama klasörü ──
step "Uygulama klasörü"
APP_ROOT="${1:-}"
if [ -z "$APP_ROOT" ]; then
  # Not: "< <(...)" kullanılmaz — CloudLinux CageFS'te /dev/fd bulunmayabilir
  FOUND_LIST="$(find "$HOME" -maxdepth 3 -name app.cjs -not -path '*/node_modules/*' -not -path '*/.deploy/*' -not -path '*/nodevenv/*' 2>/dev/null | xargs -r -n1 dirname | sort -u)"
  FOUND=()
  while IFS= read -r line; do [ -n "$line" ] && FOUND+=("$line"); done <<< "$FOUND_LIST"
  if [ "${#FOUND[@]}" -eq 1 ]; then
    APP_ROOT="$(ask "Bulunan klasör doğru mu? (Enter = evet, değilse tam yolu yazın)" "${FOUND[0]}")"
  else
    [ "${#FOUND[@]}" -gt 1 ] && printf '  %s\n' "${FOUND[@]}"
    APP_ROOT="$(ask "Uygulama klasörünün tam yolu (cPanel → Setup Node.js App → Application root)")"
  fi
fi
[ -d "$APP_ROOT" ] || { err "Klasör yok: $APP_ROOT"; exit 1; }
APP_ROOT="$(cd "$APP_ROOT" && pwd -P)"
APP_REL="${APP_ROOT#"$HOME"/}"
ok "$APP_ROOT"

# ── 2. Node ortamı ──
step "Node.js ortamı"
NODE_ACTIVATE="$(ls -1d "$HOME/nodevenv/$APP_REL/"*/bin/activate 2>/dev/null | sort -V | tail -n 1 || true)"
if [ -n "$NODE_ACTIVATE" ]; then
  # shellcheck disable=SC1090
  set +u; . "$NODE_ACTIVATE"; set -u
  ok "$NODE_ACTIVATE ($(node -v))"
elif command -v node >/dev/null 2>&1; then
  warn "nodevenv bulunamadı; sistemdeki node kullanılacak ($(node -v)). VPS'te normaldir."
else
  err "Node.js bulunamadı. cPanel → Setup Node.js App'te uygulamanın oluşturulduğundan emin olun."
  exit 1
fi

# ── 3. .env ──
step "Ortam değişkenleri (.env)"
ENV_FILE="$APP_ROOT/.env"
if [ -f "$ENV_FILE" ]; then
  ok ".env zaten var — dokunulmadı"
elif command -v cloudlinux-selector >/dev/null 2>&1; then
  JSON="$(cloudlinux-selector get --json --interpreter nodejs 2>/dev/null || true)"
  if APP_REL="$APP_REL" node -e '
    const data = JSON.parse(process.argv[1] || "{}");
    const want = process.env.APP_REL.replace(/\/$/, "");
    let app = null;
    (function walk(o) {
      if (!o || typeof o !== "object" || app) return;
      if (typeof o.app_root === "string" && o.app_root.replace(/\/$/, "").endsWith(want) && o.env_vars) { app = o; return; }
      for (const v of Object.values(o)) walk(v);
    })(data);
    if (!app || !Object.keys(app.env_vars).length) process.exit(1);
    const q = (v) => "\x27" + String(v).replace(/\x27/g, "\x27\\\x27\x27") + "\x27";
    const lines = Object.entries(app.env_vars).map(([k, v]) => `${k}=${q(v)}`);
    require("fs").writeFileSync(process.env.HOME + "/.env.nidaakin.tmp", lines.join("\n") + "\n", { mode: 0o600 });
  ' "$JSON"; then
    mv "$HOME/.env.nidaakin.tmp" "$ENV_FILE"
    ok ".env, cPanel'deki değişkenlerden oluşturuldu ($(grep -c '=' "$ENV_FILE") değişken)"
  else
    warn "cPanel değişkenleri okunamadı."
  fi
fi
if [ ! -f "$ENV_FILE" ]; then
  err ".env oluşturulamadı. cPanel → Setup Node.js App'teki değişkenleri $ENV_FILE dosyasına KEY=değer olarak yazıp betiği tekrar çalıştırın."
  err "DATA_ENCRYPTION_KEY'i ASLA yeniden üretmeyin; mevcut değeri aynen kopyalayın."
  exit 1
fi
chmod 600 "$ENV_FILE"
MISSING=""
for k in DATABASE_URL DATA_ENCRYPTION_KEY PUBLIC_SITE_URL; do grep -q "^$k=" "$ENV_FILE" || MISSING="$MISSING $k"; done
if [ -n "$MISSING" ]; then warn ".env içinde eksik:$MISSING — dağıtımdan önce ekleyin."; else ok "Zorunlu değişkenler tamam"; fi
grep -q '^NODE_ENV=' "$ENV_FILE" || { echo "NODE_ENV='production'" >> "$ENV_FILE"; ok "NODE_ENV=production eklendi"; }
SITE_URL="$(sed -n "s/^PUBLIC_SITE_URL=['\"]\{0,1\}\([^'\"]*\)['\"]\{0,1\}$/\1/p" "$ENV_FILE" | head -n 1)"

# ── 4. SSH anahtarı ──
step "GitHub Actions için SSH anahtarı"
KEY="$HOME/.ssh/github_deploy_nidaakin"
install -d -m 700 "$HOME/.ssh"
if [ -f "$KEY" ]; then
  ok "Anahtar zaten var: $KEY"
else
  ssh-keygen -t ed25519 -N "" -C "github-actions-deploy-nidaakin" -f "$KEY" -q
  ok "Anahtar üretildi"
fi
PUB="$(cat "$KEY.pub")"
touch "$HOME/.ssh/authorized_keys"
grep -qF "$PUB" "$HOME/.ssh/authorized_keys" || echo "$PUB" >> "$HOME/.ssh/authorized_keys"
chmod 600 "$HOME/.ssh/authorized_keys"
ok "Açık anahtar bu hesapta yetkilendirildi (~/.ssh/authorized_keys)"

# ── 5. Sunucu adresi, port, parmak izi ──
step "SSH adresi ve parmak izi"
DEF_HOST=""; DEF_PORT="22"
if [ -n "${SSH_CONNECTION:-}" ]; then
  # shellcheck disable=SC2086
  set -- $SSH_CONNECTION; DEF_HOST="$3"; DEF_PORT="$4"
fi
# Özel/iç IP (NAT arkası) dışarıdan erişilemez: bu durumda sunucunun alan adını öner
case "$DEF_HOST" in ""|10.*|192.168.*|127.*|172.1[6-9].*|172.2[0-9].*|172.3[01].*) DEF_HOST="$(hostname -f 2>/dev/null || hostname)" ;; esac
echo "${D}Bilgisayarınızdan SSH ile bağlanırken kullandığınız adres/port (cPanel → SSH Access'te yazar).${N}"
HOST="$(ask "SSH sunucu adresi" "$DEF_HOST")"
PORT="$(ask "SSH portu" "$DEF_PORT")"
KNOWN="$(ssh-keyscan -T 10 -p "$PORT" "$HOST" 2>/dev/null || true)"
if [ -z "$KNOWN" ]; then
  # Bazı sunucular dış adresine içeriden erişemez: yerelden alıp adres adını düzelt
  LABEL="$HOST"; [ "$PORT" != "22" ] && LABEL="[$HOST]:$PORT"
  KNOWN="$(ssh-keyscan -T 10 -p "$PORT" 127.0.0.1 2>/dev/null | sed "s/^\(\[127\.0\.0\.1\]:[0-9]*\|127\.0\.0\.1\)/$LABEL/" || true)"
fi
if [ -n "$KNOWN" ]; then ok "Parmak izi alındı ($(echo "$KNOWN" | wc -l) satır)"; else warn "Parmak izi alınamadı — DEPLOY_KNOWN_HOSTS'u bilgisayarınızda 'ssh-keyscan -p $PORT $HOST' ile alın."; fi

if ssh -i "$KEY" -p "$PORT" -o BatchMode=yes -o IdentitiesOnly=yes -o ConnectTimeout=10 \
     -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null "$USER@$HOST" true 2>/dev/null; then
  ok "Anahtarla giriş denemesi başarılı"
else
  warn "Anahtarla giriş denenemedi (sunucu kendi dış adresine bağlanamıyor olabilir — GitHub'dan çalışabilir)."
  warn "cPanel kullanıyorsanız: SSH Access → Manage SSH Keys → 'github_deploy_nidaakin' → Authorize'a tıklayın."
fi

SITE_URL="$(ask "Sitenin adresi (doğrulama için)" "${SITE_URL:-https://}")"

# ── 6. GitHub değerleri ──
cat <<OUT

${B}════════════════════════════════════════════════════════════════════════════════${N}
${B} GitHub → depo → Settings → Secrets and variables → Actions${N}
${B}════════════════════════════════════════════════════════════════════════════════${N}

${B}"Secrets" sekmesi → New repository secret:${N}

  DEPLOY_HOST   = $HOST
  DEPLOY_USER   = $USER
  DEPLOY_PORT   = $PORT

  DEPLOY_KNOWN_HOSTS = (aşağıdaki satırların tamamı)
${D}----- kopyalamaya başla -----${N}
$KNOWN
${D}----- kopyalamayı bitir -----${N}

  DEPLOY_SSH_KEY = (aşağıdaki anahtarın tamamı, BEGIN ve END satırları dahil)
${D}----- kopyalamaya başla -----${N}
$(cat "$KEY")
${D}----- kopyalamayı bitir -----${N}

${B}"Variables" sekmesi → New repository variable:${N}

  DEPLOY_PATH          = $APP_ROOT
  SITE_URL             = $SITE_URL
  DEPLOY_NODE_ACTIVATE = ${NODE_ACTIVATE:-(boş bırakın)}
  DEPLOY_ENABLED       = true      ${D}← diğerlerini girdikten sonra en son${N}

${B}Sonra:${N} GitHub → Actions → Deploy → Run workflow → deploy
OUT

echo
if [ "$(ask "Değerleri GitHub'a girdiniz mi? Gizli anahtar sunucudan silinsin mi? (e/h)" "h")" = "e" ]; then
  rm -f "$KEY"
  ok "Gizli anahtar silindi (açık anahtar yetkili kalmaya devam ediyor)."
else
  warn "Gizli anahtar $KEY konumunda duruyor. GitHub'a girdikten sonra silebilirsiniz: rm $KEY"
fi
