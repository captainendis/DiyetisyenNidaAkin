// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

import { Link } from 'react-router';
import { AlertTriangle } from 'lucide-react';
import { formatDayStr } from '@/lib/format';
import type { AffectedAppointment } from './types';

/** Takvim değişikliğinden etkilenen onaylı randevular (engellenmez, uyarılır) */
export function AffectedWarning({ items, onDismiss }: { items: AffectedAppointment[]; onDismiss: () => void }) {
  if (!items.length) return null;
  return (
    <div className="mb-6 rounded-xl border border-warning/40 bg-warning/10 p-5" role="alert">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-warning-ink" />
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-[#6f4d1d]">{items.length} onaylı randevu yeni takvimin dışında kalıyor</p>
          <p className="mt-1 text-[0.82rem] text-[#6f4d1d]/85">
            Değişiklik kaydedildi, ancak bu randevular otomatik olarak iptal edilmedi. Danışanlarla iletişime geçip randevuları yeniden planlayın veya iptal edin.
          </p>
          <ul className="mt-3 space-y-1.5">
            {items.slice(0, 10).map((a) => (
              <li key={a.appointmentId} className="text-sm">
                <Link to={`/panel/randevular?id=${a.appointmentId}`} className="font-semibold text-cocoa underline decoration-warning underline-offset-2 hover:decoration-cocoa">
                  {formatDayStr(a.date, 'd MMMM cccc')} · {a.time} — {a.contactName}
                </Link>
              </li>
            ))}
            {items.length > 10 && <li className="text-sm text-[#6f4d1d]">ve {items.length - 10} randevu daha</li>}
          </ul>
        </div>
        <button type="button" onClick={onDismiss} className="text-[0.8rem] font-semibold text-[#6f4d1d] hover:underline">Kapat</button>
      </div>
    </div>
  );
}
