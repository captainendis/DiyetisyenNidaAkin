"""
Mekân fotoğraflarını web için hazırlar (WebP + AVIF, birden çok genişlik).

Kullanım:  python3 scripts/prepare-images.py [kaynak_klasör]
Varsayılan kaynak: assets-src/

Şu an yalnızca tek bir referans görsel mevcut (assets-src/mekan-referans.png). Bu görsel,
üzerinde arayüz öğeleri bulunan bir tasarım çalışması olduğu için mekânın fotoğraf olan
bölümleri arayüz öğelerine dokunmadan kırpılır. Mimari, perspektif ve detaylar korunur;
yalnızca hafif kontrast ve sıcaklık düzenlemesi yapılır.

Gerçek, yüksek çözünürlüklü fotoğraflar geldiğinde: dosyaları assets-src/ içine koyup
CROPS listesini güncelleyin ve betiği yeniden çalıştırın.
"""
import sys
from pathlib import Path
from PIL import Image, ImageEnhance

SRC = Path(sys.argv[1] if len(sys.argv) > 1 else "assets-src")
OUT = Path("public/images")
OUT.mkdir(parents=True, exist_ok=True)

# (çıktı adı, kaynak dosya, kırpma kutusu (sol, üst, sağ, alt), hedef genişlikler)
CROPS = [
    ("mekan-cephe", "mekan-referans.png", (622, 106, 1290, 934), [480, 668, 1000]),
    ("mekan-masa", "mekan-referans.png", (900, 470, 1290, 934), [390, 585]),
    ("mekan-tabela", "mekan-referans.png", (842, 118, 1052, 470), [210, 315]),
]


def grade(im: Image.Image) -> Image.Image:
    im = ImageEnhance.Contrast(im).enhance(1.06)
    im = ImageEnhance.Color(im).enhance(1.04)
    r, g, b = im.split()
    r = r.point(lambda v: min(255, int(v * 1.015)))
    b = b.point(lambda v: int(v * 0.97))
    return Image.merge("RGB", (r, g, b))


for name, src, box, widths in CROPS:
    im = grade(Image.open(SRC / src).convert("RGB").crop(box))
    for w in widths:
        h = round(im.height * w / im.width)
        resized = im.resize((w, h), Image.LANCZOS)
        resized.save(OUT / f"{name}-{w}.webp", "WEBP", quality=82, method=6)
        resized.save(OUT / f"{name}-{w}.avif", "AVIF", quality=60)
    print(f"✓ {name}: {im.width}x{im.height} → {widths}")
