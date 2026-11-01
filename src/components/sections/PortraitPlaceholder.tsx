// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

import { useSiteImages } from '@/config/media';
import { Picture } from './Picture';
import { cn } from '@/lib/text';

/**
 * Portre alanı. Panel → Web Sitesi İçeriği → Görseller'den portre yüklendiğinde gerçek fotoğrafı gösterir.
 * Boşken: ince çerçeveli, monogramlı zarif bir yer tutucu (stok kişi fotoğrafı kullanılmaz).
 */
export function PortraitPlaceholder({ className, caption = true }: { className?: string; caption?: boolean }) {
  const { portrait, venue } = useSiteImages();
  if (portrait) {
    return (
      <figure className={cn('relative aspect-[4/5] overflow-hidden bg-sand', className)}>
        <Picture {...portrait} sizes="(min-width: 1024px) 40vw, 90vw" className="block h-full w-full" imgClassName="h-full w-full object-cover" />
      </figure>
    );
  }
  // Portre yüklenene kadar görüşmelerin yapıldığı mekân gösterilir: yer tutucu
  // kutusu herkese açık sayfada sitenin bitmediğini söylüyordu.
  return (
    <figure className={cn('relative aspect-[4/5] overflow-hidden bg-sand', className)}>
      <Picture {...venue} sizes="(min-width: 1024px) 40vw, 90vw" className="block h-full w-full" imgClassName="h-full w-full object-cover" />
      {caption && (
        <figcaption className="absolute right-0 bottom-0 left-0 bg-gradient-to-t from-espresso/80 to-transparent px-5 pt-10 pb-4 text-[0.8rem] text-cream/90">
          Görüşmelerin yapıldığı stüdyo
        </figcaption>
      )}
    </figure>
  );
}
