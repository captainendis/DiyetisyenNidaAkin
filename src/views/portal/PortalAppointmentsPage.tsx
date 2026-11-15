// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

'use client';

/**
 * /hesabim/randevular — diyet ve pilates için ortak: yanıt bekleyen taleplerim, randevularım,
 * önümüzdeki iki haftanın boş zamanları (diyet görüşmesi boş saatleri, pilates boş yerleri).
 * Diğer danışanların bilgisi hiçbir yerde görünmez; yalnızca sayılar.
 */
import { useEffect } from 'react';
import { DateTime } from 'luxon';
import { Link } from '@/lib/router';
import { api, portalApi } from '@/lib/api';
import { useApi } from '@/hooks/useApi';
import { formatDate, formatDayStr, formatTime, todayStr } from '@/lib/format';
import { APPOINTMENT_STATUS_LABEL, MEETING_TYPE_LABEL, PILATES_FORMAT_LABEL, TIME_ZONE, pilatesPreferenceText } from '@shared/constants';
import type { PortalAppointment, PortalPilatesAvailability, PortalRequest } from '@shared/portal';
import { usePortalAuth } from '@/components/portal/PortalAuth';
import { Empty, LoadError, Loading, Panel, PanelTitle, PortalLinkButton, PortalPageHeader } from '@/components/portal/ui';
import { cn } from '@/lib/text';

const TONE: Partial<Record<PortalAppointment['status'], string>> = {
  CONFIRMED: 'bg-success/12 text-success-ink',
  PENDING: 'bg-warning/15 text-warning-ink',
  COMPLETED: 'bg-espresso/[0.07] text-cocoa',
  CANCELLED: 'bg-danger/10 text-danger-ink',
  NO_SHOW: 'bg-danger/10 text-danger-ink',
};

function Row({ a }: { a: PortalAppointment }) {
  return (
    <li className="flex items-center justify-between gap-4 rounded-lg bg-white px-5 py-4 ring-1 ring-espresso/[0.07]">
      <div className="min-w-0">
        <p className="font-display nums text-[1.4rem] leading-tight">{a.startsAt && formatDate(a.startsAt)}</p>
        <p className="mt-0.5 text-[0.92rem] text-cocoa">
          <span className="font-semibold tabular-nums">{a.startsAt && formatTime(a.startsAt)}</span> · {MEETING_TYPE_LABEL[a.meetingType]}
          {a.service && <span className="text-taupe"> · {a.service}</span>}
        </p>
      </div>
      <span className={cn('shrink-0 rounded-full px-2.5 py-1 text-[0.78rem] font-semibold', TONE[a.status] ?? 'bg-espresso/[0.07] text-cocoa')}>{APPOINTMENT_STATUS_LABEL[a.status]}</span>
    </li>
  );
}

function RequestRow({ r }: { r: PortalRequest }) {
  const pilates = r.kind === 'PILATES';
  return (
    <li className="flex items-center justify-between gap-4 rounded-lg bg-white px-5 py-4 ring-1 ring-espresso/[0.07]">
      <div className="min-w-0">
        <p className="font-semibold">{pilates ? `Pilates · ${r.pilatesFormat ? PILATES_FORMAT_LABEL[r.pilatesFormat] : 'ders'}` : `Diyet görüşmesi${r.service ? ` · ${r.service}` : ''}`}</p>
        <p className="mt-0.5 text-[0.9rem] text-taupe">
          {r.startsAt ? <span className="tabular-nums">İstediğin zaman: {formatDate(r.startsAt)} {formatTime(r.startsAt)}</span> : pilates ? pilatesPreferenceText(r.preferredDays, r.preferredDayparts) : 'Zaman birlikte planlanacak'}
          <span> · {formatDate(r.createdAt)} tarihinde gönderildi</span>
        </p>
      </div>
      <span className="shrink-0 rounded-full bg-warning/15 px-2.5 py-1 text-[0.78rem] font-semibold text-warning-ink">Yanıt bekliyor</span>
    </li>
  );
}

/** Önümüzdeki 14 gün: diyet görüşmesi boş saat sayıları + pilates boş yerleri */
function Availability({ pilatesLink }: { pilatesLink: string }) {
  const from = todayStr();
  const to = DateTime.fromISO(from, { zone: TIME_ZONE }).plus({ days: 13 }).toISODate()!;
  const consult = useApi(() => api.get<{ days: { date: string; available: number }[] }>('/public/availability/days', { from, to }), [from]);
  const pilates = useApi(() => portalApi.get<PortalPilatesAvailability>('/pilates/availability'), []);
  const openDays = consult.data?.days.filter((d) => d.available > 0) ?? [];
  return (
    <div className="space-y-6">
      <Panel>
        <PanelTitle action={<Link to="/randevu" className="text-[0.88rem] font-medium text-taupe hover:text-espresso">Talep et</Link>}>Diyet görüşmesi · boş saatler</PanelTitle>
        {consult.error ? (
          <p className="text-[0.92rem] text-taupe">Şu an yüklenemedi.</p>
        ) : !consult.data ? (
          <div className="h-24 animate-pulse rounded-lg bg-espresso/[0.05]" />
        ) : openDays.length ? (
          <ul className="flex flex-wrap gap-2">
            {openDays.map((d) => (
              <li key={d.date} className="rounded-full bg-cream px-3 py-1.5 text-[0.85rem]">
                <span className="capitalize">{formatDayStr(d.date, 'd MMM ccc')}</span> <span className="tabular-nums text-taupe">· {d.available} saat</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[0.92rem] leading-relaxed text-cocoa">Önümüzdeki iki haftada çevrim içi boş saat yok. Saat seçmeden talep bırakabilirsin.</p>
        )}
      </Panel>
      <Panel>
        <PanelTitle action={<Link to={pilatesLink} className="text-[0.88rem] font-medium text-taupe hover:text-espresso">Talep et</Link>}>Pilates · boş yerler</PanelTitle>
        {pilates.error ? (
          <p className="text-[0.92rem] text-taupe">Şu an yüklenemedi.</p>
        ) : !pilates.data ? (
          <div className="h-24 animate-pulse rounded-lg bg-espresso/[0.05]" />
        ) : pilates.data.groups.length || pilates.data.sessions.length ? (
          <div className="space-y-4">
            {pilates.data.groups.length > 0 && (
              <ul className="space-y-1.5">
                {pilates.data.groups.map((g) => (
                  <li key={g.id} className="flex items-baseline justify-between gap-3 text-[0.92rem]">
                    <span className="min-w-0 truncate">{g.name}</span>
                    <span className="shrink-0 tabular-nums text-success-ink">{g.free} kişilik yer</span>
                  </li>
                ))}
              </ul>
            )}
            {pilates.data.sessions.length > 0 && (
              <div>
                <p className="mb-1.5 text-[0.85rem] font-semibold text-taupe">Boş yeri olan dersler</p>
                <ul className="space-y-1">
                  {pilates.data.sessions.slice(0, 8).map((s) => (
                    <li key={s.id} className="flex items-baseline justify-between gap-3 text-[0.9rem]">
                      <span className="min-w-0 truncate"><span className="tabular-nums">{formatDate(s.startsAt)} {formatTime(s.startsAt)}</span> · {s.title}</span>
                      <span className="shrink-0 tabular-nums text-taupe">{s.free} yer</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ) : (
          <p className="text-[0.92rem] leading-relaxed text-cocoa">Gruplarda şu an boş yer yok. Talep bırakırsan yer açıldığında haber verilir.</p>
        )}
      </Panel>
    </div>
  );
}

export default function PortalAppointmentsPage() {
  const { me } = usePortalAuth();
  const { data, error, loading, reload } = useApi(() => portalApi.get<{ items: PortalAppointment[] }>('/appointments'), []);
  const requests = useApi(() => portalApi.get<{ items: PortalRequest[] }>('/requests'), []);
  useEffect(() => {
    document.title = 'Randevularım | Nida Akın';
  }, []);
  const now = Date.now();
  // Onay bekleyenler "Yanıt bekleyen taleplerin" altında görünür
  const scheduled = (data?.items ?? []).filter((a) => a.status !== 'PENDING');
  const upcoming = scheduled.filter((a) => a.startsAt && new Date(a.startsAt).getTime() > now && a.status !== 'CANCELLED').reverse();
  const past = scheduled.filter((a) => !upcoming.includes(a));
  const pilatesLink = me?.programs.pilates ? '/hesabim/pilates' : '/randevu?tur=pilates';
  const open = requests.data?.items ?? [];

  return (
    <>
      <PortalPageHeader
        title="Randevular"
        lead="Taleplerin, randevuların ve önümüzdeki iki haftanın boş zamanları. Randevunu değiştirmek ya da iptal etmek için diyetisyeninle iletişime geç."
        actions={
          <div className="flex flex-wrap gap-2">
            <PortalLinkButton to="/randevu" className="bg-espresso text-ivory ring-0 hover:bg-cocoa">Diyet randevusu talep et</PortalLinkButton>
            <PortalLinkButton to={pilatesLink}>Pilates dersi talep et</PortalLinkButton>
          </div>
        }
      />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0 space-y-10">
          {open.length > 0 && (
            <section aria-labelledby="talepler">
              <h2 id="talepler" className="mb-3 text-[0.92rem] font-semibold text-taupe">Yanıt bekleyen taleplerin</h2>
              <ul className="space-y-3">{open.map((r) => <RequestRow key={r.id} r={r} />)}</ul>
            </section>
          )}
          {loading && !data ? (
            <Loading />
          ) : error ? (
            <LoadError message={error.message} onRetry={reload} />
          ) : !upcoming.length && !past.length ? (
            !open.length && <Empty title="Henüz randevun yok.">Diyet görüşmesi ya da pilates dersi için yukarıdan talep oluşturabilirsin; onaylanınca burada görünür.</Empty>
          ) : (
            <>
              {upcoming.length > 0 && (
                <section aria-labelledby="yaklasan">
                  <h2 id="yaklasan" className="mb-3 text-[0.92rem] font-semibold text-taupe">Yaklaşan</h2>
                  <ul className="space-y-3">{upcoming.map((a) => <Row key={a.id} a={a} />)}</ul>
                </section>
              )}
              {past.length > 0 && (
                <section aria-labelledby="gecmis">
                  <h2 id="gecmis" className="mb-3 text-[0.92rem] font-semibold text-taupe">Geçmiş görüşmeler</h2>
                  <ul className="space-y-3">{past.map((a) => <Row key={a.id} a={a} />)}</ul>
                </section>
              )}
            </>
          )}
          {me?.programs.pilates && (
            <p className="text-[0.95rem] text-taupe">Pilates derslerin <Link to="/hesabim/pilates" className="font-semibold text-espresso underline underline-offset-4">Pilates</Link> sayfasında.</p>
          )}
        </div>
        <Availability pilatesLink={pilatesLink} />
      </div>
    </>
  );
}
