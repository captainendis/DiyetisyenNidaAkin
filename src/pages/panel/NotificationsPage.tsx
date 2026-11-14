// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

import { useMemo, useState, type ComponentType } from 'react';
import { useNavigate } from 'react-router';
import { BellOff, CalendarCheck2, CalendarClock, CalendarPlus, CalendarX2, CheckCheck, Circle, Mail, MessageCircle, Trash2, UserPlus } from 'lucide-react';
import { DateTime } from 'luxon';
import { api } from '@/lib/api';
import { useApi } from '@/hooks/useApi';
import { cn, formatTime } from '@/lib/format';
import { NOTIFICATION_TYPE_LABEL, NOTIFICATION_TYPES, TIME_ZONE, type NotificationType } from '@shared/constants';
import { Badge, Button, Card, EmptyState, ErrorState, IconButton, PageHeader, Pagination, Select, SkeletonRows, Tabs, useFeedback } from '@/components/panel/ui';
import { usePanelAuth } from '@/components/panel/PanelAuth';

interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  appointmentId: string | null;
  clientId: string | null;
  readAt: string | null;
  createdAt: string;
}
interface ListRes { items: Notification[]; total: number; unread: number; page: number; pageSize: number }

const ICON: Record<NotificationType, ComponentType<{ className?: string }>> = {
  APPOINTMENT_REQUESTED: CalendarPlus,
  APPOINTMENT_CONFIRMED: CalendarCheck2,
  APPOINTMENT_CANCELLED: CalendarX2,
  APPOINTMENT_UPCOMING: CalendarClock,
  CLIENT_CREATED: UserPlus,
};

function dayLabel(iso: string) {
  const d = DateTime.fromISO(iso).setZone(TIME_ZONE).startOf('day');
  const today = DateTime.now().setZone(TIME_ZONE).startOf('day');
  const diff = Math.round(today.diff(d, 'days').days);
  if (diff === 0) return 'Bugün';
  if (diff === 1) return 'Dün';
  return d.toFormat(d.year === today.year ? 'd MMMM, cccc' : 'd MMMM yyyy');
}

function ChannelStatus() {
  const { data } = useApi(() => api.get<{ channels: { key: 'EMAIL' | 'WHATSAPP'; configured: boolean }[] }>('/notifications/channels'), []);
  if (!data) return null;
  const meta = { EMAIL: { label: 'E-posta', icon: Mail }, WHATSAPP: { label: 'WhatsApp', icon: MessageCircle } };
  return (
    <Card className="p-5">
      <h2 className="text-[0.95rem] font-bold text-espresso">Bildirim kanalları</h2>
      <p className="mt-1 text-[0.8rem] leading-relaxed text-panel-muted">Panel içi bildirimler her zaman aktiftir. Harici kanallar yapılandırılmadan hiçbir mesaj gönderilmez.</p>
      <ul className="mt-4 space-y-3">
        <li className="flex items-center justify-between gap-3 text-sm">
          <span className="flex items-center gap-2.5 text-cocoa"><Circle className="h-4 w-4 fill-success text-success-ink" aria-hidden /> Panel içi</span>
          <Badge tone="success">Aktif</Badge>
        </li>
        {data.channels.map((c) => {
          const M = meta[c.key];
          return (
            <li key={c.key} className="flex items-center justify-between gap-3 text-sm">
              <span className="flex items-center gap-2.5 text-cocoa"><M.icon className="h-4 w-4 text-panel-muted" aria-hidden /> {M.label}</span>
              {c.configured ? <Badge tone="success">Yapılandırıldı</Badge> : <Badge tone="neutral">Yapılandırılmadı</Badge>}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

export default function NotificationsPage() {
  const navigate = useNavigate();
  const { refreshUnread } = usePanelAuth();
  const { success, error: toastError } = useFeedback();
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [type, setType] = useState<'' | NotificationType>('');
  const [page, setPage] = useState(1);
  const { data, error, loading, reload, setData } = useApi(
    () => api.get<ListRes>('/notifications', { filter, type, page, pageSize: 30 }),
    [filter, type, page],
  );

  const groups = useMemo(() => {
    const out: { label: string; items: Notification[] }[] = [];
    for (const n of data?.items ?? []) {
      const l = dayLabel(n.createdAt);
      const g = out[out.length - 1];
      if (g?.label === l) g.items.push(n);
      else out.push({ label: l, items: [n] });
    }
    return out;
  }, [data]);

  const patchLocal = (id: string, readAt: string | null) =>
    setData((d) =>
      d
        ? {
            ...d,
            items: filter === 'unread' && readAt ? d.items.filter((x) => x.id !== id) : d.items.map((x) => (x.id === id ? { ...x, readAt } : x)),
            unread: Math.max(0, d.unread + (readAt ? -1 : 1)),
          }
        : d,
    );

  async function toggleRead(n: Notification) {
    const read = !n.readAt;
    try {
      await api.post(`/notifications/${n.id}/${read ? 'read' : 'unread'}`);
      patchLocal(n.id, read ? new Date().toISOString() : null);
      refreshUnread();
    } catch (e) {
      toastError('İşlem tamamlanamadı', (e as Error).message);
    }
  }

  async function open(n: Notification) {
    if (!n.readAt) {
      api.post(`/notifications/${n.id}/read`).then(refreshUnread).catch(() => {});
    }
    if (n.appointmentId) navigate(`/panel/randevular?id=${n.appointmentId}`);
    else if (n.clientId) navigate(`/panel/danisanlar/${n.clientId}`);
    else if (!n.readAt) patchLocal(n.id, new Date().toISOString());
  }

  async function remove(n: Notification) {
    try {
      await api.del(`/notifications/${n.id}`);
      setData((d) => (d ? { ...d, items: d.items.filter((x) => x.id !== n.id), total: d.total - 1, unread: d.unread - (n.readAt ? 0 : 1) } : d));
      refreshUnread();
    } catch (e) {
      toastError('Silinemedi', (e as Error).message);
    }
  }

  async function readAll() {
    try {
      const r = await api.post<{ updated: number }>('/notifications/read-all');
      success(r.updated ? `${r.updated} bildirim okundu olarak işaretlendi` : 'Okunmamış bildirim yok');
      refreshUnread();
      void reload();
    } catch (e) {
      toastError('İşlem tamamlanamadı', (e as Error).message);
    }
  }

  return (
    <>
      <PageHeader
        title="Bildirimler"
        description={data ? (data.unread ? `${data.unread} okunmamış bildirim` : 'Tüm bildirimler okundu') : 'Randevu talepleri ve danışan kayıtları'}
        actions={<Button variant="secondary" icon={<CheckCheck className="h-4 w-4" />} onClick={() => void readAll()} disabled={!data?.unread}>Tümünü okundu işaretle</Button>}
      />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <Card>
          <div className="flex flex-col gap-3 px-4 pt-3 sm:flex-row sm:items-end sm:justify-between sm:px-5">
            <Tabs<'all' | 'unread'>
              underline={false}
              value={filter}
              onChange={(v) => { setFilter(v); setPage(1); }}
              tabs={[{ value: 'all', label: 'Tümü' }, { value: 'unread', label: 'Okunmamış', count: data?.unread }]}
            />
            <Select
              aria-label="Bildirim türü"
              value={type}
              onChange={(e) => { setType(e.target.value as NotificationType | ''); setPage(1); }}
              placeholder="Tüm türler"
              options={NOTIFICATION_TYPES.map((t) => ({ value: t, label: NOTIFICATION_TYPE_LABEL[t] }))}
              wrapperClassName="pb-3 sm:w-56"
            />
          </div>
          <div className="border-t border-panel-line">
            {loading && !data ? (
              <SkeletonRows rows={5} />
            ) : error ? (
              <ErrorState message={error.message} onRetry={reload} />
            ) : !data?.items.length ? (
              <EmptyState
                icon={<BellOff className="h-5 w-5" />}
                title={filter === 'unread' ? 'Okunmamış bildirim yok.' : 'Henüz bildirim bulunmuyor.'}
                description="Web sitesinden yeni bir randevu talebi geldiğinde, randevular onaylandığında veya iptal edildiğinde burada görünür."
              />
            ) : (
              <>
                {groups.map((g) => (
                  <section key={g.label} aria-label={g.label}>
                    <h3 className="bg-panel-bg/60 px-5 py-2 text-[0.72rem] font-semibold tracking-wide text-panel-muted uppercase">{g.label}</h3>
                    <ul className="divide-y divide-panel-line">
                      {g.items.map((n) => {
                        const Icon = ICON[n.type];
                        const unread = !n.readAt;
                        const linked = !!(n.appointmentId || n.clientId);
                        return (
                          <li key={n.id} className={cn('group flex items-start gap-3 px-4 py-3.5 sm:px-5', unread && 'bg-rose/[0.07]')}>
                            <span className={cn('mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full', unread ? 'bg-cocoa text-rose' : 'bg-panel-bg text-cocoa/75')}>
                              <Icon className="h-4 w-4" />
                            </span>
                            <button type="button" onClick={() => void open(n)} className="min-w-0 flex-1 text-left" aria-label={`${n.title}${unread ? ' (okunmamış)' : ''}${linked ? ' — ilgili kaydı aç' : ''}`}>
                              <p className={cn('text-sm', unread ? 'font-bold text-espresso' : 'font-medium text-cocoa')}>{n.title}</p>
                              {n.body && <p className="mt-0.5 text-[0.82rem] text-panel-muted">{n.body}</p>}
                              <p className="tabular mt-1 text-[0.72rem] text-panel-muted">
                                {formatTime(n.createdAt)} · {NOTIFICATION_TYPE_LABEL[n.type]}
                              </p>
                            </button>
                            <div className="flex shrink-0 items-center opacity-100 sm:opacity-60 sm:group-hover:opacity-100 sm:focus-within:opacity-100">
                              <IconButton label={unread ? 'Okundu işaretle' : 'Okunmadı işaretle'} onClick={() => void toggleRead(n)}>
                                {unread ? <CheckCheck className="h-4 w-4" /> : <Circle className="h-3.5 w-3.5" />}
                              </IconButton>
                              <IconButton label="Bildirimi sil" onClick={() => void remove(n)}><Trash2 className="h-4 w-4" /></IconButton>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                ))}
                <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onChange={setPage} />
              </>
            )}
          </div>
        </Card>
        <div className="space-y-6">
          <ChannelStatus />
        </div>
      </div>
    </>
  );
}
