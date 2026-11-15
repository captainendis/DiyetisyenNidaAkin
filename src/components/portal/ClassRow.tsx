// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/** Danışan hesabında tek bir pilates dersi satırı: tarih, saat, ders adı ve danışanın katılım durumu */
import { formatDate, formatTime } from '@/lib/format';
import { CLASS_ATTENDANCE_LABEL } from '@shared/constants';
import type { PortalClassSession } from '@shared/classes';
import { cn } from '@/lib/text';

const CLASS_TONE: Partial<Record<PortalClassSession['myStatus'], string>> = {
  BOOKED: 'bg-success/12 text-success-ink',
  ATTENDED: 'bg-espresso/[0.07] text-cocoa',
  NO_SHOW: 'bg-danger/10 text-danger-ink',
  EXCUSED: 'bg-warning/15 text-warning-ink',
};

export function ClassRow({ s }: { s: PortalClassSession }) {
  const cancelled = s.status === 'CANCELLED';
  return (
    <li className="flex items-center justify-between gap-4 rounded-lg bg-white px-5 py-4 ring-1 ring-espresso/[0.07]">
      <div className="min-w-0">
        <p className={cn('font-display nums text-[1.4rem] leading-tight', cancelled && 'line-through opacity-60')}>{formatDate(s.startsAt)}</p>
        <p className="mt-0.5 text-[0.92rem] text-cocoa">
          <span className="font-semibold tabular-nums">{formatTime(s.startsAt)}–{formatTime(s.endsAt)}</span> · {s.title}
        </p>
      </div>
      <span className={cn('shrink-0 rounded-full px-2.5 py-1 text-[0.78rem] font-semibold', cancelled ? 'bg-danger/10 text-danger-ink' : (CLASS_TONE[s.myStatus] ?? 'bg-espresso/[0.07] text-cocoa'))}>
        {cancelled ? 'Ders iptal' : s.myStatus === 'BOOKED' ? 'Kaydın var' : CLASS_ATTENDANCE_LABEL[s.myStatus]}
      </span>
    </li>
  );
}
