import { PORTRAIT } from '@/config/media';
import { LogoMark } from '@/components/icons/Logo';
import { cn } from '@/lib/text';

/**
 * Portre alanı. src/config/media.ts → PORTRAIT doldurulduğunda gerçek fotoğrafı gösterir.
 * Boşken: ince çerçeveli, monogramlı zarif bir yer tutucu (stok kişi fotoğrafı kullanılmaz).
 */
export function PortraitPlaceholder({ className, caption = true }: { className?: string; caption?: boolean }) {
  if (PORTRAIT) {
    return (
      <figure className={cn('relative aspect-[4/5] overflow-hidden bg-sand', className)}>
        <img src={PORTRAIT.src} width={PORTRAIT.width} height={PORTRAIT.height} alt={PORTRAIT.alt} loading="lazy" className="h-full w-full object-cover" />
      </figure>
    );
  }
  return (
    <figure className={cn('relative aspect-[4/5] overflow-hidden bg-[linear-gradient(160deg,#ebdfcc_0%,#e2d2bb_55%,#d9c6ac_100%)]', className)} aria-label="Portre fotoğrafı için ayrılmış alan">
      <div className="absolute inset-4 border border-gold/45 sm:inset-5" aria-hidden />
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 text-cocoa/35">
        <LogoMark className="h-[34%] w-[34%]" strokeWidth={0.7} />
        <span className="font-display text-[1.6rem] tracking-[0.3em] text-cocoa/40">N · A</span>
      </div>
      {caption && (
        <figcaption className="absolute right-0 bottom-8 left-0 text-center text-[0.65rem] font-semibold tracking-[0.22em] text-cocoa/45 uppercase">
          Portre fotoğrafı eklenecek
        </figcaption>
      )}
    </figure>
  );
}
