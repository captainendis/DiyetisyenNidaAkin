// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/** Web sitesindeki hizmet kartının sadeleştirilmiş önizlemesi */
import { ServiceIcon } from '@/components/icons/ServiceIcon';
import { formatMoney } from '@/lib/format';

export function ServicePreviewCard({ title, summary, icon, durationMinutes, priceCents, showPrice, index = 0 }: { title: string; summary: string; icon: string; durationMinutes?: number | null; priceCents?: number | null; showPrice?: boolean; index?: number }) {
  return (
    <div className="relative overflow-hidden rounded-sm border border-cream/12 bg-espresso p-6 text-cream">
      <div className="flex items-start justify-between">
        <ServiceIcon name={icon} className="h-11 w-11 text-rose" />
        <span className="font-display text-[0.95rem] text-gold [font-variant-numeric:lining-nums_tabular-nums]">{String(index + 1).padStart(2, '0')}</span>
      </div>
      <p className="mt-8 font-display text-[1.6rem] leading-[1.1] font-medium">{title || 'Hizmet başlığı'}</p>
      <p className="mt-3 text-[0.85rem] leading-relaxed text-mist">{summary || 'Kısa açıklama burada görünür.'}</p>
      {(durationMinutes || (showPrice && priceCents != null)) && (
        <p className="mt-5 border-t border-cream/10 pt-4 text-[0.75rem] tracking-[0.12em] text-cream/70 uppercase">
          {durationMinutes ? `${durationMinutes} dk` : ''}
          {durationMinutes && showPrice && priceCents != null ? ' · ' : ''}
          {showPrice && priceCents != null ? formatMoney(priceCents) : ''}
        </p>
      )}
    </div>
  );
}
