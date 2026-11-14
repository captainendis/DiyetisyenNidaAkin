#!/usr/bin/env bash
# Copyright (c) 2026 Nida Akın. All rights reserved.
# Developed by PaperAxis · paperaxis.com
#
# `npm run build` sonrası dağıtım paketini hazırlar (CI kullanır; elle de çalışır):
#   bash scripts/package-release.sh <revizyon> [çıktı.tar.gz]
# İçerik: .next/standalone (çalışan site) + dist-scripts + prisma (şema, migration'lar) + yönetim betikleri.
# .env ve benzeri gizli dosyalar pakete ASLA girmez.
set -euo pipefail
cd "$(dirname "$0")/.."
REV="${1:?Kullanım: package-release.sh <revizyon> [çıktı.tar.gz]}"
OUT="${2:-release-$REV.tar.gz}"

[ -f .next/standalone/server.js ] || { echo "✖ Önce npm run build çalıştırın" >&2; exit 1; }
[ -d dist-scripts ] || { echo "✖ dist-scripts yok (npm run build:scripts)" >&2; exit 1; }

printf '%s' "$REV" > .next/standalone/REVISION
tar -czf "$OUT" \
  --exclude='.env' --exclude='.env.*' --exclude='*.log' \
  --exclude='.next/standalone/storage' --exclude='.next/standalone/backups' \
  .next/standalone dist-scripts prisma prisma.config.ts package.json package-lock.json app.cjs \
  scripts/backup.sh scripts/deploy-remote.sh

# Paket gizli dosya içermemeli
if tar -tzf "$OUT" | grep -E '(^|/)\.env($|\.)' >/dev/null; then
  echo "✖ Pakette .env dosyası var — dağıtım durduruldu" >&2
  rm -f "$OUT"
  exit 1
fi
echo "✓ Paket hazır: $OUT ($(du -h "$OUT" | cut -f1))"
