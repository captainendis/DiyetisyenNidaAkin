// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/** Tarif diyet türü etiketleri: ikon + her zaman görünen metin (kart: kompakt, ayrıntı: açıklama notuyla) */
import { DIET_ICONS } from '@/components/icons/DietIcons';
import { cn } from '@/lib/text';
import { DIET_TAG_LABEL, DIET_TAG_NOTE, visibleDietTags, type DietTag } from '@shared/recipe';

export function DietBadges({ tags, className }: { tags: DietTag[] | undefined; className?: string }) {
  const list = visibleDietTags(tags);
  if (!list.length) return null;
  return (
    <ul className={cn('flex flex-wrap gap-x-4 gap-y-1.5', className)} aria-label="Diyet türü">
      {list.map((t) => {
        const Icon = DIET_ICONS[t];
        return (
          <li key={t} title={DIET_TAG_NOTE[t]} className="flex items-center gap-1.5 text-[0.8rem] font-semibold text-cocoa">
            <Icon className="h-5 w-5 shrink-0 text-gold-ink" />
            {DIET_TAG_LABEL[t]}
          </li>
        );
      })}
    </ul>
  );
}

/** Ayrıntı sayfası: etiket + kısa açıklama */
export function DietNotes({ tags, className }: { tags: DietTag[] | undefined; className?: string }) {
  const list = visibleDietTags(tags);
  if (!list.length) return null;
  return (
    <section className={className} aria-label="Diyet türü">
      <ul className="space-y-3">
        {list.map((t) => {
          const Icon = DIET_ICONS[t];
          return (
            <li key={t} className="flex items-start gap-3">
              <Icon className="mt-0.5 h-7 w-7 shrink-0 text-gold-ink" />
              <p className="text-[0.92rem] leading-relaxed text-cocoa">
                <strong className="font-semibold text-espresso">{DIET_TAG_LABEL[t]}. </strong>
                {DIET_TAG_NOTE[t]}
              </p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
