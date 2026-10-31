/**
 * Genel Bakış — günün kararı: "Sıradaki kim, neyi onaylamam gerekiyor?"
 * Ajanda ve onay bekleyen talepler en üstte; istatistikler ve haftalık grafik destekleyici.
 * Tüm sayılar canlı veriden gelir; karşılaştırma dönemleri adıyla yazılır.
 */
import { useState } from 'react';
import { Link } from 'react-router';
import { DateTime } from 'luxon';
import { CalendarDays, CalendarPlus, Check, Clock, Inbox, MapPin, UserPlus, Users, Video, X } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { useApi } from '@/hooks/useApi';
import { cn, formatDayStr, formatPhone, relativeTime } from '@/lib/format';
import { MEETING_TYPE_LABEL, TIME_ZONE } from '@shared/constants';
import { minutesOf, timeOf } from '@shared/time';
import { usePanelAuth } from '@/components/panel/PanelAuth';
import { Button, Card, CardHeader, EmptyState, ErrorState, SkeletonRows, StatusBadge, useFeedback } from '@/components/panel/ui';
import { StatCard, StatCardSkeleton } from '@/components/panel/dashboard/StatCard';
import { StackedBarChart } from '@/components/panel/charts/StackedBarChart';
import AppointmentDetailModal from '@/components/panel/appointments/AppointmentDetailModal';
import { CHART_COLORS, displayName, type AppointmentDTO } from '@/components/panel/appointments/types';
import type { Agenda, DashboardStats, Weekly } from '@/components/panel/dashboard/types';

function AgendaItem({ a, onOpen, isNext }: { a: AppointmentDTO; onOpen: () => void; isNext: boolean }) {
  const end = a.time && a.durationMinutes ? timeOf(minutesOf(a.time) + a.durationMinutes) : null;
  const muted = a.status === 'CANCELLED' || a.status === 'NO_SHOW';
  return (
    <li>
      <button type="button" onClick={onOpen} className={cn('group flex w-full items-center gap-4 px-5 py-3.5 text-left transition-colors hover:bg-panel-bg/60', muted && 'opacity-55')}>
        <div className="w-14 shrink-0 text-right">
          <p className="text-[1.05rem] font-bold text-espresso tabular">{a.time}</p>
          {end && <p className="text-[0.72rem] text-panel-muted tabular">{end}</p>}
        </div>
        <span className={cn('h-10 w-[3px] shrink-0 rounded-full', isNext ? 'bg-rose-deep' : 'bg-panel-line')} aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 truncate font-semibold text-espresso">
            {displayName(a)}
            {isNext && <span className="rounded bg-rose/30 px-1.5 py-px text-[0.66rem] font-bold tracking-wide text-[#7a4a3c] uppercase">Sıradaki</span>}
          </p>
          <p className="mt-0.5 flex items-center gap-1.5 truncate text-[0.78rem] text-panel-muted">
            {a.meetingType === 'ONLINE' ? <Video className="h-3.5 w-3.5" /> : <MapPin className="h-3.5 w-3.5" />}
            {MEETING_TYPE_LABEL[a.meetingType]}
            {a.service && <> · {a.service.title}</>}
          </p>
        </div>
        <StatusBadge status={a.status} />
      </button>
    </li>
  );
}

export default function DashboardPage() {
  const { user, can, refreshUnread } = usePanelAuth();
  const fb = useFeedback();
  const [openId, setOpenId] = useState<string | null>(null);
  const [key, setKey] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const bump = () => {
    setKey((k) => k + 1);
    refreshUnread();
  };

  const stats = useApi(() => api.get<DashboardStats>('/dashboard/stats'), [key]);
  const agenda = useApi(() => api.get<Agenda>('/dashboard/agenda'), [key]);
  const weekly = useApi(() => api.get<Weekly>('/dashboard/weekly'), [key]);

  const now = DateTime.now().setZone(TIME_ZONE);
  const nowStr = now.toFormat('HH:mm');
  const hello = user?.salutation || user?.firstName || '';
  const nextId = agenda.data?.items.find((a) => (a.status === 'CONFIRMED' || a.status === 'PENDING') && a.time && timeOf(minutesOf(a.time) + (a.durationMinutes ?? 0)) > nowStr)?.id;
  const canWrite = can('appointments:write');

  const quick = async (a: AppointmentDTO, status: 'CONFIRMED' | 'CANCELLED') => {
    if (status === 'CANCELLED') {
      const ok = await fb.confirm({
        title: 'Talep reddedilsin mi?',
        description: <><strong>{displayName(a)}</strong> adlı kişinin talebi “İptal Edildi” olarak işaretlenecek. Kişiye otomatik bildirim gönderilmez; gerekirse telefonla bilgilendirin.</>,
        confirmLabel: 'Reddet',
        tone: 'danger',
      });
      if (!ok) return;
    }
    setBusy(a.id + status);
    try {
      await api.post(`/appointments/${a.id}/status`, { status, note: status === 'CANCELLED' ? 'Genel bakıştan reddedildi' : null });
      fb.success(status === 'CONFIRMED' ? 'Randevu onaylandı' : 'Talep reddedildi', displayName(a));
      bump();
    } catch (e) {
      fb.error('İşlem tamamlanamadı', e instanceof ApiError ? e.message : undefined);
    } finally {
      setBusy(null);
    }
  };

  const c = stats.data?.cards;
  const seriesOf = (k: keyof NonNullable<typeof c>) => c?.[k].series.map((s) => s.value) ?? [];

  return (
    <>
      <header className="mb-8">
        <div>
          <h1 className="font-display text-[2.3rem] leading-tight font-medium text-espresso sm:text-[2.8rem]">Merhaba, {hello}</h1>
          <p className="mt-1 text-sm text-panel-muted">Bugünkü danışan ve randevu durumunuz.</p>
        </div>
        <p className="mt-1 text-sm text-panel-muted capitalize tabular sm:hidden">{now.toFormat('d MMMM yyyy, cccc')}</p>
      </header>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        {/* Bugünün ajandası */}
        <Card>
          <CardHeader
            title="Bugünün ajandası"
            description={agenda.data ? `${agenda.data.items.filter((a) => a.status !== 'CANCELLED').length} randevu · ${formatDayStr(agenda.data.date, 'd MMMM')}` : ' '}
            action={<Link to="/panel/randevular?view=day" className="text-[0.8rem] font-semibold text-cocoa hover:underline">Gün görünümü</Link>}
          />
          <div className="mt-3 border-t border-panel-line">
            {agenda.error ? (
              <ErrorState message={agenda.error.message} onRetry={agenda.reload} />
            ) : !agenda.data ? (
              <SkeletonRows rows={4} />
            ) : agenda.data.items.length === 0 ? (
              <EmptyState
                icon={<CalendarDays className="h-5 w-5" />}
                title="Bugün için planlanmış randevunuz bulunmuyor."
                description="Yeni bir randevu oluşturabilir veya bekleyen talepleri gözden geçirebilirsiniz."
                action={canWrite && <Link to="/panel/randevular?new=1"><Button variant="secondary" size="sm" icon={<CalendarPlus className="h-4 w-4" />}>Yeni randevu</Button></Link>}
              />
            ) : (
              <ul className="divide-y divide-panel-line/70">
                {agenda.data.items.map((a) => <AgendaItem key={a.id} a={a} isNext={a.id === nextId} onOpen={() => setOpenId(a.id)} />)}
              </ul>
            )}
          </div>
        </Card>

        {/* Onay bekleyenler */}
        <Card className={cn(agenda.data?.pendingTotal ? 'border-warning/40' : '')}>
          <CardHeader
            title={<span className="flex items-center gap-2">Onay bekleyen talepler {!!agenda.data?.pendingTotal && <span className="rounded-md bg-warning/20 px-1.5 text-[0.75rem] text-[#7d5720] tabular">{agenda.data.pendingTotal}</span>}</span>}
            description="Web sitesinden gelen ve henüz yanıtlanmamış talepler"
            action={agenda.data && agenda.data.pendingTotal > agenda.data.pendingRequests.length && (
              <Link to="/panel/randevular?view=list&status=PENDING&status=NEW_REQUEST" className="text-[0.8rem] font-semibold text-cocoa hover:underline">Tümü</Link>
            )}
          />
          <div className="mt-3 border-t border-panel-line">
            {agenda.error ? null : !agenda.data ? (
              <SkeletonRows rows={3} />
            ) : agenda.data.pendingRequests.length === 0 ? (
              <EmptyState icon={<Inbox className="h-5 w-5" />} title="Bekleyen talep yok" description="Yeni bir randevu talebi geldiğinde burada ve bildirimlerde görünür." />
            ) : (
              <ul className="divide-y divide-panel-line/70">
                {agenda.data.pendingRequests.map((a) => (
                  <li key={a.id} className="px-5 py-3.5">
                    <button type="button" onClick={() => setOpenId(a.id)} className="block w-full text-left">
                      <p className="font-semibold text-espresso hover:underline">{displayName(a)}</p>
                      <p className="mt-0.5 flex items-center gap-1.5 text-[0.78rem] text-panel-muted">
                        <Clock className="h-3.5 w-3.5" />
                        {a.date ? <span className="tabular">{formatDayStr(a.date, 'd MMM ccc')} · {a.time}</span> : 'Saat seçilmedi — geri arama'}
                        <span aria-hidden>·</span> {MEETING_TYPE_LABEL[a.meetingType]}
                      </p>
                      <p className="mt-0.5 text-[0.74rem] text-panel-muted/80">{formatPhone(a.contactPhone)} · {relativeTime(a.createdAt)} geldi</p>
                    </button>
                    {canWrite && (
                      <div className="mt-2.5 flex gap-2">
                        {a.date ? (
                          <Button size="sm" icon={<Check className="h-3.5 w-3.5" />} loading={busy === a.id + 'CONFIRMED'} onClick={() => quick(a, 'CONFIRMED')}>Onayla</Button>
                        ) : (
                          <Button size="sm" onClick={() => setOpenId(a.id)}>Saat ata</Button>
                        )}
                        <Button size="sm" variant="secondary" icon={<X className="h-3.5 w-3.5" />} loading={busy === a.id + 'CANCELLED'} onClick={() => quick(a, 'CANCELLED')}>Reddet</Button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>
      </div>

      {/* İstatistikler */}
      <section aria-label="İstatistikler" className="mt-5 grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        {stats.error ? (
          <Card className="col-span-2 xl:col-span-4"><ErrorState message={stats.error.message} onRetry={stats.reload} /></Card>
        ) : !c ? (
          Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />)
        ) : (
          <>
            <StatCard
              label="Bugünkü randevular"
              value={c.today.value}
              definition="Bugün için planlanmış, iptal edilmemiş randevular (onaylı, onay bekleyen, tamamlanan, gelmedi)."
              comparison={<>{c.today.comparison.label}: <span className="font-semibold text-cocoa tabular">{c.today.comparison.value}</span></>}
              series={seriesOf('today')}
              seriesLabel="Son 7 günün günlük randevu sayısı"
            />
            <StatCard
              label="Bekleyen randevular"
              value={c.pending.value}
              definition="Şu anda “Onay Bekliyor” veya “Yeni Talep” durumundaki kayıtlar. Çizgi: son 7 günde web sitesinden gelen talepler."
              comparison={<>Son 7 günde <span className="font-semibold text-cocoa tabular">{c.pending.comparison.current}</span> web talebi · önceki 7 gün: <span className="tabular">{c.pending.comparison.value}</span></>}
              series={seriesOf('pending')}
              seriesLabel="Son 7 günde gelen web talepleri"
            />
            <StatCard
              label="Toplam danışan"
              value={c.clients.value}
              definition="Aktif ve pasif durumdaki danışan kayıtları (arşivlenenler hariç). Çizgi: son 7 günde eklenen danışanlar."
              comparison={<>Bu ay <span className="font-semibold text-cocoa tabular">{c.clients.comparison.current}</span> yeni · geçen ay: <span className="tabular">{c.clients.comparison.value}</span></>}
              series={seriesOf('clients')}
              seriesLabel="Son 7 günde eklenen danışanlar"
            />
            <StatCard
              label="Bu ayki görüşmeler"
              value={c.month.value}
              definition="Bu takvim ayındaki onaylı ve tamamlanmış randevular (gelecek tarihli onaylılar dahil)."
              comparison={<>{c.month.comparison.label}: <span className="font-semibold text-cocoa tabular">{c.month.comparison.value}</span></>}
              series={seriesOf('month')}
              seriesLabel="Son 7 günün onaylı ve tamamlanan görüşmeleri"
            />
          </>
        )}
      </section>

      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader title="Son 7 gün: randevular nasıl sonuçlandı?" description="Randevu tarihine göre, günlük" />
          <div className="px-5 pt-4 pb-5">
            {weekly.error ? (
              <ErrorState message={weekly.error.message} onRetry={weekly.reload} />
            ) : !weekly.data ? (
              <SkeletonRows rows={3} />
            ) : weekly.data.days.every((d) => d.completed + d.cancelled + d.open === 0) ? (
              <EmptyState title="Son 7 günde randevu kaydı yok" description="Randevular tamamlandıkça veya iptal edildikçe dağılım burada görünür." className="py-10" />
            ) : (
              <StackedBarChart
                caption="Son 7 günde randevuların sonuçları: tamamlanan, bekleyen ve iptal/gelmedi sayıları"
                series={[
                  { key: 'completed', label: 'Tamamlandı', color: CHART_COLORS.completed },
                  { key: 'open', label: 'Onaylı / bekleyen', color: CHART_COLORS.open },
                  { key: 'cancelled', label: 'İptal / gelmedi', color: CHART_COLORS.cancelled },
                ]}
                data={weekly.data.days.map((d) => {
                  const dt = DateTime.fromISO(d.date, { zone: TIME_ZONE });
                  return { key: d.date, label: dt.toFormat('ccc'), sublabel: dt.toFormat('d.MM'), values: { completed: d.completed, open: d.open, cancelled: d.cancelled } };
                })}
              />
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="Hızlı işlemler" />
          <div className="grid grid-cols-2 gap-2 p-5">
            {[
              { to: '/panel/danisanlar?new=1', label: 'Yeni danışan ekle', icon: UserPlus, perm: can('clients:write') },
              { to: '/panel/randevular?new=1', label: 'Yeni randevu oluştur', icon: CalendarPlus, perm: canWrite },
              { to: '/panel/randevular?view=week', label: 'Takvimi görüntüle', icon: CalendarDays, perm: true },
              { to: '/panel/danisanlar', label: 'Danışan listesini aç', icon: Users, perm: can('clients:read') },
            ]
              .filter((x) => x.perm)
              .map((x) => (
                <Link key={x.to} to={x.to} className="group flex flex-col gap-3 rounded-xl border border-panel-line p-4 transition-colors hover:border-cocoa/30 hover:bg-panel-bg/60">
                  <x.icon className="h-5 w-5 text-cocoa/70 group-hover:text-cocoa" />
                  <span className="text-[0.85rem] leading-snug font-semibold text-espresso">{x.label}</span>
                </Link>
              ))}
          </div>
        </Card>
      </div>

      <AppointmentDetailModal appointmentId={openId} open={!!openId} onClose={() => setOpenId(null)} onChanged={bump} />
    </>
  );
}
