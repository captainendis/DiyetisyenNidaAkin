// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

'use client';

import { useState } from 'react';
import { Link } from '@/lib/router';
import { RequirePermission } from '@/components/panel/PanelAuth';
import { PageHeader } from '@/components/panel/ui';
import { WeeklySchedule } from '@/components/panel/calendar/WeeklySchedule';
import { BlockedDates } from '@/components/panel/calendar/BlockedDates';
import { AffectedWarning } from '@/components/panel/calendar/AffectedWarning';
import type { AffectedAppointment } from '@/components/panel/calendar/types';

export default function CalendarSettingsPage() {
  const [warnings, setWarnings] = useState<AffectedAppointment[]>([]);
  return (
    <RequirePermission perm="availability:write">
      <PageHeader
        eyebrow="Ayarlar"
        title="Çalışma takvimi"
        description={
          <>
            Randevu alınabilecek gün ve saatleri belirleyin. Web sitesinden talep alma süresi gibi kurallar{' '}
            <Link to="/panel/ayarlar?sekme=randevu" className="font-semibold text-cocoa underline underline-offset-2">Randevu Ayarları</Link>’ndadır.
          </>
        }
      />
      <AffectedWarning items={warnings} onDismiss={() => setWarnings([])} />
      <div className="space-y-6">
        <WeeklySchedule onWarnings={setWarnings} />
        <BlockedDates onWarnings={setWarnings} />
      </div>
    </RequirePermission>
  );
}
