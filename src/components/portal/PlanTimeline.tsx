// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/**
 * Beslenme listesinin ekran hâli — basılı plandaki zaman çizelgesinin aynısı (saat noktası + öğün + seçenekler),
 * telefonda okunacak şekilde seçenekler alt alta. Nokta rengi planın seçili temasından gelir.
 */
import { PLAN_THEMES, type NutritionPlanData } from '@shared/plan';
import { cn } from '@/lib/text';

export function PlanTimeline({ data, compact = false }: { data: Pick<NutritionPlanData, 'meals' | 'theme'>; compact?: boolean }) {
  const accent = (PLAN_THEMES[data.theme] ?? PLAN_THEMES.green).colors.accent;
  return (
    <ol className="relative space-y-5 before:absolute before:top-3 before:bottom-3 before:left-[7px] before:w-px before:bg-espresso/15">
      {data.meals.map((m, mi) => {
        const options = m.options.map((o) => o.filter(Boolean)).filter((o) => o.length);
        return (
          <li key={mi} className="relative pl-8">
            <span aria-hidden className="absolute top-[0.55rem] left-0 h-[15px] w-[15px] rounded-full ring-[1.5px] ring-espresso" style={{ background: accent }} />
            <p className="flex flex-wrap items-baseline gap-x-3">
              {m.time && <span className="font-display nums text-[1.7rem] leading-none font-semibold">{m.time}</span>}
              <span className="text-[0.95rem] font-semibold text-cocoa">{m.name}</span>
              {compact && options.length > 1 && <span className="text-[0.85rem] text-taupe">{options.length} seçenek</span>}
            </p>
            {!compact && (
              <div className={cn('mt-3 grid gap-3', options.length > 1 && 'sm:grid-cols-2 xl:grid-cols-3')}>
                {options.map((o, oi) => (
                  <div key={oi} className="rounded-md bg-white p-4 ring-1 ring-espresso/[0.07]">
                    {options.length > 1 && <p className="mb-1.5 text-[0.85rem] font-semibold text-taupe">{oi + 1}. seçenek</p>}
                    <ul className="space-y-1">
                      {o.map((line, li) => (
                        <li key={li} className="text-[1rem] leading-snug">{line}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}
