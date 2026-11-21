#!/usr/bin/env bash
# Copyright (c) 2026 Nida Akın. All rights reserved.
# Developed by PaperAxis · paperaxis.com
#
# Mobil uygulama — mağaza kurulum betiği (KENDİ BİLGİSAYARINIZDA çalıştırın).
# Sırlar bilgisayarınızda üretilir ve doğrudan GitHub'a (Actions secrets) gönderilir; depoya hiçbir şey yazılmaz.
#
#   ./scripts/mobil-kurulum.sh             # menü
#   ./scripts/mobil-kurulum.sh android     # 1) Android imza anahtarı → GitHub sırları + imzalı derleme
#   ./scripts/mobil-kurulum.sh play        # 2) İlk AAB'yi indir (elle yükleme) + Play hizmet hesabı sırrı
#   ./scripts/mobil-kurulum.sh bildirim    # 3) Expo proje kimliği + Firebase (google-services.json) + FCM anahtarı
#   ./scripts/mobil-kurulum.sh hepsi       # 1 → 2 → 3
#   DRY_RUN=1 ./scripts/mobil-kurulum.sh … # GitHub'a hiçbir şey göndermeden ne yapılacağını göster
#
# Gerekenler: GitHub CLI (gh, `gh auth login` ile giriş yapılmış), Java (keytool), Node.js 20+ (npx), openssl.
# Ayrıntılar: docs/MOBIL-DERLEME.md
set -euo pipefail

# ───────────────────────── Ortak ─────────────────────────

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VAULT="${NIDAAKIN_VAULT:-$HOME/.nidaakin-mobil}"   # anahtar + şifre burada kalır (depo dışında)
PACKAGE="com.nidaakin.app"
ALIAS="nidaakin"
DRY_RUN="${DRY_RUN:-0}"

if [ -t 1 ]; then B=$'\e[1m'; G=$'\e[32m'; Y=$'\e[33m'; R=$'\e[31m'; D=$'\e[2m'; N=$'\e[0m'; else B= G= Y= R= D= N=; fi
say()  { printf '%s\n' "$*"; }
step() { printf '\n%s▸ %s%s\n' "$B" "$*" "$N"; }
ok()   { printf '%s✓%s %s\n' "$G" "$N" "$*"; }
warn() { printf '%s!%s %s\n' "$Y" "$N" "$*"; }
die()  { printf '%s✗ %s%s\n' "$R" "$*" "$N" >&2; exit 1; }
ask()  { local a; read -r -p "$1 " a; printf '%s' "$a"; }
confirm() { local a; read -r -p "$1 [E/h] " a; [[ -z "$a" || "$a" =~ ^[EeYy] ]]; }
pause(){ read -r -p "${D}Hazır olunca Enter…${N} " _; }

need() { command -v "$1" >/dev/null 2>&1 || die "'$1' bulunamadı. $2"; }

# Depo (owner/name) — gh'nin bu klasörde gördüğü uzak depo
REPO=""
repo() {
  [ -n "$REPO" ] && return
  need gh "GitHub CLI kurun: https://cli.github.com — ardından: gh auth login"
  gh auth status >/dev/null 2>&1 || die "GitHub CLI'da oturum yok: gh auth login"
  REPO="$(cd "$ROOT" && gh repo view --json nameWithOwner -q .nameWithOwner)" || die "Depo bulunamadı (bu betiği depo klasöründen çalıştırın)."
  ok "Depo: $REPO"
}

# Sırrı stdin'den gönderir (değer komut satırında/geçmişte görünmez)
set_secret() {
  local name="$1"
  if [ "$DRY_RUN" = 1 ]; then cat >/dev/null; say "  ${D}[deneme] gh secret set $name --repo $REPO${N}"; return; fi
  gh secret set "$name" --repo "$REPO" >/dev/null
  ok "GitHub sırrı: $name"
}
set_variable() {
  local name="$1" value="$2"
  if [ "$DRY_RUN" = 1 ]; then say "  ${D}[deneme] gh variable set $name --body $value${N}"; return; fi
  gh variable set "$name" --repo "$REPO" --body "$value" >/dev/null
  ok "GitHub değişkeni: $name = $value"
}
has_secret() { gh secret list --repo "$REPO" 2>/dev/null | awk '{print $1}' | grep -qx "$1"; }

b64() { openssl base64 -A -in "$1"; }   # macOS + Linux aynı biçim (tek satır)

# Bir dosyanın yolunu sorar, ~ ve tırnakları açar, varlığını denetler
ask_file() {
  local p
  while true; do
    p="$(ask "$1")"; p="${p%\"}"; p="${p#\"}"; p="${p%\'}"; p="${p#\'}"; p="${p/#\~/$HOME}"
    [ -f "$p" ] && { printf '%s' "$p"; return; }
    warn "Dosya bulunamadı: $p"
  done
}

# Son "Mobil derleme" çalıştırmasını bekler ve Android çıktısını indirir
download_android() {
  local dest="$1" run
  run="$(gh run list --repo "$REPO" --workflow mobile.yml --limit 1 --json databaseId -q '.[0].databaseId')"
  [ -n "$run" ] || die "Mobil derleme çalıştırması bulunamadı."
  say "Derleme izleniyor (ilk derleme ~15–20 dk): https://github.com/$REPO/actions/runs/$run"
  gh run watch "$run" --repo "$REPO" --exit-status >/dev/null || die "Derleme başarısız. Ayrıntı: gh run view $run --log-failed"
  mkdir -p "$dest"
  gh run download "$run" --repo "$REPO" --dir "$dest"
  ok "İndirildi: $dest"
  find "$dest" -name '*.aab' -o -name '*.apk' | sed 's/^/    /'
}

# Elle derleme başlatır (iş akışı varsayılan dalda olmalı; değilse --ref ile)
dispatch_android() {
  local ref
  ref="$(cd "$ROOT" && git rev-parse --abbrev-ref HEAD)"
  if [ "$DRY_RUN" = 1 ]; then say "  ${D}[deneme] gh workflow run mobile.yml --ref $ref -f platform=android${N}"; return 1; fi
  if ! gh workflow run mobile.yml --repo "$REPO" --ref "$ref" -f platform=android >/dev/null 2>&1; then
    # GitHub, elle başlatmayı yalnızca iş akışı varsayılan dalda (main) varken kabul eder
    warn "Derleme elle başlatılamadı: 'Mobil derleme' iş akışı henüz main dalında değil."
    say "   Seçenekler: (1) mobil dalı main'e birleştirin, sonra bu adımı tekrar çalıştırın;"
    say "   (2) mobile/ altında değişiklik içeren bir sonraki push derlemeyi zaten otomatik başlatır —"
    say "       sırlar eklendiği için o derleme imzalı olur. Çıktı: Actions → Mobil derleme → Artifacts."
    return 1
  fi
  ok "İmzalı Android derlemesi başlatıldı ($ref)"
  sleep 8
}

# ───────────────────────── 1) Android imza anahtarı ─────────────────────────

android() {
  step "1/3 · Android yükleme anahtarı"
  need keytool "Java (JDK 17+) kurun — ör. macOS: brew install openjdk@17"
  need openssl ""
  repo

  local ks="$VAULT/nidaakin-upload.keystore" pwf="$VAULT/keystore-sifresi.txt"
  mkdir -p "$VAULT"; chmod 700 "$VAULT"

  if [ -f "$ks" ]; then
    ok "Mevcut anahtar kullanılıyor: $ks"
    [ -f "$pwf" ] || die "Şifre dosyası yok: $pwf"
  else
    if has_secret ANDROID_KEYSTORE_BASE64 && ! confirm "GitHub'da zaten bir anahtar var. Yine de YENİ anahtar üretilsin mi? (Play'e daha önce yükleme yaptıysanız HAYIR deyin)"; then
      die "Vazgeçildi. Eski anahtarı $ks yoluna koyup tekrar çalıştırın."
    fi
    # PKCS12'de anahtar ve depo şifresi aynıdır
    # Satır sonu olmadan yazılır: sırra da aynen gider (Gradle şifreyi birebir karşılaştırır)
    (umask 077; printf '%s' "$(openssl rand -base64 48 | tr -d '/+=\n' | cut -c1-32)" > "$pwf")
    keytool -genkeypair -v -storetype PKCS12 -keystore "$ks" -alias "$ALIAS" \
      -keyalg RSA -keysize 4096 -validity 10000 \
      -storepass:file "$pwf" -keypass:file "$pwf" \
      -dname "CN=Nida Akin, O=Nida Akin, C=TR" >/dev/null 2>&1 || die "keytool anahtar üretemedi."
    chmod 600 "$ks"
    ok "Anahtar üretildi: $ks"
  fi

  b64 "$ks"   | set_secret ANDROID_KEYSTORE_BASE64
  tr -d '\r\n' < "$pwf" | set_secret ANDROID_KEYSTORE_PASSWORD
  printf '%s' "$ALIAS" | set_secret ANDROID_KEY_ALIAS
  tr -d '\r\n' < "$pwf" | set_secret ANDROID_KEY_PASSWORD

  local sha
  sha="$(keytool -list -v -keystore "$ks" -alias "$ALIAS" -storepass:file "$pwf" 2>/dev/null | awk -F': ' '/SHA256:/{print $2; exit}')"
  printf '%s' "$sha" > "$VAULT/yukleme-anahtari-sha256.txt"

  say ""
  say "${B}ÖNEMLİ — yedekleyin:${N} $VAULT klasörünü (anahtar + şifre) parola yöneticinize / güvenli bir kasaya kopyalayın."
  say "Kaybolursa Play Console → Uygulama bütünlüğü üzerinden yükleme anahtarı sıfırlatılabilir, ama zahmetlidir."
  say "Yükleme anahtarı SHA-256: ${B}$sha${N}"
  say "${D}(Doğrudan GitHub'dan indirilen APK'larla e-posta bağlantılarının açılması için sunucudaki ANDROID_CERT_SHA256'ya da eklenebilir.)${N}"
}

# ───────────────────────── 2) Google Play ─────────────────────────

play() {
  step "2/3 · Google Play"
  repo
  has_secret ANDROID_KEYSTORE_BASE64 || die "Önce imza anahtarı: ./scripts/mobil-kurulum.sh android"

  say "a) Play Console'da uygulamayı oluşturun: https://play.google.com/console → Uygulama oluştur"
  say "   Ad: ${B}Nida Akın${N} · Dil: Türkçe · Uygulama · Ücretsiz. (Paket adı ilk yüklemede ${B}$PACKAGE${N} olarak belirlenir.)"
  pause

  say "b) İlk AAB imzalı derlenip indirilecek; Play ilk yüklemenin elle yapılmasını ister."
  if confirm "İmzalı derleme şimdi başlatılsın mı?"; then
    if dispatch_android; then download_android "$VAULT/derlemeler"; fi
  else
    confirm "Son derlemenin çıktısı indirilsin mi?" && download_android "$VAULT/derlemeler"
  fi
  say ""
  say "   Play Console → Test ve yayınla → ${B}Dahili test${N} → Yeni sürüm oluştur → .aab dosyasını sürükleyin → Kaydet."
  say "   (Uygulama imzalama sorulursa: ${B}Google tarafından oluşturulan anahtarı kullan${N}.)"
  pause

  say "c) Otomatik yükleme için hizmet hesabı:"
  say "   1. https://console.cloud.google.com/iam-admin/serviceaccounts → (bir proje seçin/oluşturun) → Hizmet hesabı oluştur"
  say "      Ad: nidaakin-play · rol vermeyin → Bitti → hesaba tıklayın → Anahtarlar → Anahtar ekle → JSON → indirin."
  say "   2. Aynı projede 'Google Play Android Developer API'yi etkinleştirin:"
  say "      https://console.cloud.google.com/apis/library/androidpublisher.googleapis.com"
  say "   3. Play Console → Kullanıcılar ve izinler → Yeni kullanıcıları davet et → hizmet hesabının e-postası →"
  say "      Uygulama izinleri: Nida Akın → 'Sürümleri test kanallarına yayınla' + 'Sürümleri üretime yayınla' → Davet et."
  local json; json="$(ask_file "İndirilen JSON dosyasının yolu (sürükleyip bırakabilirsiniz):")"
  grep -q '"type": *"service_account"' "$json" || die "Bu bir hizmet hesabı JSON'u değil."
  set_secret PLAY_SERVICE_ACCOUNT_JSON < "$json"
  if confirm "Güvenlik için JSON dosyası bilgisayardan silinsin mi? (GitHub'a kaydedildi)"; then rm -f -- "$json" && ok "Silindi: $json"; fi

  say ""
  ok "Hazır. Sonraki sürümler: Actions → Mobil derleme → Run workflow → play_track: internal"
  say "   ya da etiketle: git tag mobile-v1.0.1 && git push origin mobile-v1.0.1"
  say "   E-posta bağlantıları için: Play Console → Uygulama bütünlüğü → Uygulama imzalama → ${B}SHA-256${N}'yı"
  say "   sunucuda ANDROID_CERT_SHA256 olarak ayarlayın (README → Mobil uygulama)."
}

# ───────────────────────── 3) Bildirimler ─────────────────────────

bildirim() {
  step "3/3 · Anlık bildirimler"
  need npx "Node.js 20+ kurun: https://nodejs.org"
  repo
  cd "$ROOT/mobile"
  [ -d node_modules ] || { say "Bağımlılıklar kuruluyor…"; npm ci --no-audit --no-fund >/dev/null; }

  # a) Expo proje kimliği (Expo push servisi için; derleme için Expo gerekmez)
  local pid
  pid="$(node -p "(require('./app.json').expo.extra||{}).eas?.projectId||''")"
  if [ -z "$pid" ]; then
    say "a) Expo hesabı (ücretsiz): https://expo.dev/signup — sonra giriş:"
    npx --yes eas-cli@latest whoami >/dev/null 2>&1 || npx --yes eas-cli@latest login
    npx --yes eas-cli@latest init --non-interactive --force || npx --yes eas-cli@latest init
    pid="$(node -p "(require('./app.json').expo.extra||{}).eas?.projectId||''")"
    [ -n "$pid" ] || die "Proje kimliği alınamadı."
  fi
  ok "Expo proje kimliği: $pid"
  set_variable EAS_PROJECT_ID "$pid"
  if ! git -C "$ROOT" diff --quiet -- mobile/app.json 2>/dev/null; then
    warn "mobile/app.json'a proje kimliği yazıldı — commit'leyin: git add mobile/app.json && git commit -m 'Expo proje kimliği' && git push"
  fi

  # b) Firebase → google-services.json (Android cihaza bildirim teslimi)
  say ""
  say "b) Firebase: https://console.firebase.google.com → Proje ekle (ör. nida-akin) → Android simgesi →"
  say "   Paket adı: ${B}$PACKAGE${N} → Uygulamayı kaydet → ${B}google-services.json${N}'u indirin (diğer adımları atlayın)."
  local gsf; gsf="$(ask_file "google-services.json yolu:")"
  grep -q "\"package_name\": *\"$PACKAGE\"" "$gsf" || die "Bu dosyada $PACKAGE paketi yok — Firebase'de doğru paket adını girdiğinizden emin olun."
  set_secret GOOGLE_SERVICES_JSON < "$gsf"

  # c) FCM V1 hizmet hesabı anahtarı → Expo (sunucu push gönderebilsin)
  say ""
  say "c) Firebase → Proje ayarları (⚙) → ${B}Hizmet hesapları${N} → 'Yeni özel anahtar oluştur' → JSON'u indirin."
  say "   Şimdi açılacak menüde: ${B}Android → production → Google Service Account → Push Notifications (FCM V1)${N}"
  say "   → 'Upload a new service account key' → indirdiğiniz JSON'u seçin."
  pause
  npx --yes eas-cli@latest credentials --platform android || warn "Kimlik bilgisi adımı tamamlanmadı; daha sonra: cd mobile && npx eas-cli credentials"

  say ""
  ok "Bildirimler hazır. Yeni bir Android derlemesinden itibaren (google-services.json gömülü) çalışır."
  say "   iOS: Apple hesabı açılınca aynı menüde iOS → Push Notifications → APNs anahtarı (docs/MOBIL-DERLEME.md §3)."
  [ "$DRY_RUN" = 1 ] || { confirm "Yeni Android derlemesi başlatılsın mı?" && dispatch_android || true; }
}

# ───────────────────────── Giriş ─────────────────────────

case "${1:-menu}" in
  android) android ;;
  play) play ;;
  bildirim|push) bildirim ;;
  hepsi|all) android; play; bildirim ;;
  menu)
    say "${B}Nida Akın — mobil mağaza kurulumu${N}"
    say "  1) Android imza anahtarı (GitHub sırları)"
    say "  2) Google Play (ilk yükleme + otomatik yükleme)"
    say "  3) Anlık bildirimler (Expo + Firebase)"
    say "  4) Hepsi"
    case "$(ask "Seçim [1-4]:")" in
      1) android ;; 2) play ;; 3) bildirim ;; 4) android; play; bildirim ;; *) die "Geçersiz seçim" ;;
    esac ;;
  -h|--help) sed -n '5,16p' "$0" | sed 's/^# \{0,1\}//' ;;
  *) die "Bilinmeyen komut: $1 (android | play | bildirim | hepsi)" ;;
esac
