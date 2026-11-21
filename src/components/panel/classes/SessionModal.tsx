// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/**
 * Ders detayı: katılımcılar ve yoklama (katıldı / gelmedi / haber verdi), telafi-misafir ekleme,
 * zaman/kontenjan düzenleme, yapıldı / iptal / sil.
 */
import { useEffect, useState } from 'react';
import { Link } from '@/lib/router';
import { Ban, CalendarClock, CheckCheck, Pencil, RotateCcw, Trash2, UserMinus } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { useApi } from '@/hooks/useApi';
import { cn, formatDayStr, todayStr } from '@/lib/format';
import { CLASS_ATTENDANCE_LABEL, CLASS_SEAT_HOLDING, type ClassAttendanceStatus } from '@shared/constants';
import { minutesOf, timeOf } from '@shared/time';
import { Badge, Button, ErrorState, Input, Modal, Skeleton, Switch, Textarea, useFeedback } from '@/components/panel/ui';
import { usePanelAuth } from '@/components/panel/PanelAuth';
import { MultiClientPicker, SeatDots, SessionStatusBadge, clientName, type ClassSessionDTO } from './shared';

const MARKS: ClassAttendanceStatus[] = ['ATTENDED', 'NO_SHOW', 'EXCUSED'];
const MARK_ON: Record<ClassAttendanceStatus, string> = {
  BOOKED: 'bg-white text-cocoa ring-cocoa',
  ATTENDED: 'bg-success text-white ring-success',
  NO_SHOW: 'bg-danger-ink text-white ring-danger-ink',
  EXCUSED: 'bg-warning text-espresso ring-warning',
};

export function SessionModal({ sessionId, open, onClose, onChanged }: { sessionId: string | null; open: boolean; onClose: () => void; onChanged: () => void }) {
  const fb = useFeedback();
  const { can } = usePanelAuth();
  const canWrite = can('appointments:write');
  const { data, error, loading, reload, setData } = useApi(
    () => (sessionId ? api.get<{ session: ClassSessionDTO }>(`/classes/sessions/${sessionId}`) : Promise.resolve(null)),
    [sessionId],
  );
  const s = data?.session ?? null;
  const [busy, setBusy] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ title: '', date: '', time: '', duration: '', capacity: '', note: '', outside: false });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) setEditing(false);
  }, [open]);
  useEffect(() => {
    if (!s) return;
    setForm({ title: s.title, date: s.date, time: s.time, duration: String(s.durationMinutes), capacity: String(s.capacity), note: s.note ?? '', outside: false });
    setErrors({});
  }, [s?.id, editing]); // eslint-disable-line react-hooks/exhaustive-deps

  const started = s ? new Date(s.startsAt).getTime() <= Date.now() : false;

  /** Ortak mutasyon: yanıtla gelen dersi yerinde günceller */
  const run = async (key: string, fn: () => Promise<{ session: ClassSessionDTO }>, ok?: string) => {
    setBusy(key);
    try {
      const r = await fn();
      setData({ session: r.session });
      if (ok) fb.success(ok);
      onChanged();
      return true;
    } catch (e) {
      if (e instanceof ApiError) {
        if (Object.keys(e.fields).length) setErrors(e.fields);
        fb.error('İşlem yapılamadı', e.message);
      }
      return false;
    } finally {
      setBusy(null);
    }
  };

  const mark = (clientId: string, status: ClassAttendanceStatus) =>
    run(`m-${clientId}`, () => api.patch(`/classes/sessions/${s!.id}/attendees/${clientId}`, { status }));
  const remove = async (clientId: string, name: string) => {
    const ok = await fb.confirm({ title: `${name} bu dersten çıkarılsın mı?`, description: 'Grup üyeliği değişmez; yalnızca bu dersin listesinden çıkar.', confirmLabel: 'Çıkar', tone: 'danger' });
    if (ok) await run(`r-${clientId}`, () => api.del(`/classes/sessions/${s!.id}/attendees/${clientId}`));
  };
  const setStatus = async (status: 'SCHEDULED' | 'COMPLETED' | 'CANCELLED') => {
    if (status === 'CANCELLED') {
      const ok = await fb.confirm({ title: 'Ders iptal edilsin mi?', description: 'Saat takvimde boşalır. Katılımcılara ayrıca haber vermeyi unutmayın.', confirmLabel: 'Dersi iptal et', tone: 'danger' });
      if (!ok) return;
    }
    const msg = { SCHEDULED: 'Ders yeniden planlandı', COMPLETED: 'Ders yapıldı olarak işaretlendi', CANCELLED: 'Ders iptal edildi' }[status];
    await run(`s-${status}`, () => api.post(`/classes/sessions/${s!.id}/status`, { status }), msg);
  };
  const destroy = async () => {
    const ok = await fb.confirm({ title: 'Ders silinsin mi?', description: 'Ders ve katılım listesi kalıcı olarak silinir.', confirmLabel: 'Sil', tone: 'danger' });
    if (!ok) return;
    try {
      await api.del(`/classes/sessions/${s!.id}`);
      fb.success('Ders silindi');
      onChanged();
      onClose();
    } catch (e) {
      if (e instanceof ApiError) fb.error('Ders silinemedi', e.message);
    }
  };
  const saveEdit = async () => {
    if (!s) return;
    const body: Record<string, unknown> = { title: form.title.trim(), capacity: Number(form.capacity), note: form.note.trim() || null, allowOutsideHours: form.outside };
    if (s.status === 'SCHEDULED' && (form.date !== s.date || form.time !== s.time || Number(form.duration) !== s.durationMinutes)) {
      Object.assign(body, { date: form.date, time: form.time, durationMinutes: Number(form.duration) });
    }
    const ok = await run('edit', () => api.patch(`/classes/sessions/${s.id}`, body), 'Ders güncellendi');
    if (ok) setEditing(false);
  };

  const footer = s && canWrite && (
    <>
      {s.status !== 'COMPLETED' && (
        <Button variant="ghost" icon={<Trash2 className="h-4 w-4" />} onClick={destroy} className="mr-auto text-danger-ink hover:bg-danger/10">Sil</Button>
      )}
      {s.status === 'SCHEDULED' && (
        <>
          <Button variant="secondary" icon={<Ban className="h-4 w-4" />} loading={busy === 's-CANCELLED'} onClick={() => setStatus('CANCELLED')}>İptal et</Button>
          <Button
            icon={<CheckCheck className="h-4 w-4" />}
            loading={busy === 's-COMPLETED'}
            disabled={!started}
            title={started ? 'İşaretlenmemiş katılımcılar “katıldı” sayılır' : 'Ders başladıktan sonra işaretlenebilir'}
            onClick={() => setStatus('COMPLETED')}
          >
            Ders yapıldı
          </Button>
        </>
      )}
      {s.status !== 'SCHEDULED' && (
        <Button variant="secondary" icon={<RotateCcw className="h-4 w-4" />} loading={busy === 's-SCHEDULED'} onClick={() => setStatus('SCHEDULED')}>
          {s.status === 'CANCELLED' ? 'Yeniden planla' : 'Yapıldı işaretini geri al'}
        </Button>
      )}
    </>
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={s ? s.title : 'Ders'}
      description={s ? <span className="tabular capitalize">{formatDayStr(s.date, 'd MMMM yyyy, cccc')} · {s.time}–{timeOf(minutesOf(s.time) + s.durationMinutes)}</span> : undefined}
      footer={footer || undefined}
    >
      {error ? (
        <ErrorState message={error.message} onRetry={reload} />
      ) : !s || loading ? (
        <div className="space-y-3" aria-busy="true"><Skeleton className="h-6 w-1/3" /><Skeleton className="h-32 w-full" /></div>
      ) : (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center gap-3">
            <SessionStatusBadge status={s.status} />
            <SeatDots taken={s.seatsTaken} capacity={s.capacity} />
            {s.groupName ? <Badge tone="neutral">Grup: {s.groupName}</Badge> : <Badge tone="accent">Tek seferlik ders</Badge>}
            {canWrite && !editing && (
              <Button variant="ghost" size="sm" className="ml-auto" icon={<Pencil className="h-3.5 w-3.5" />} onClick={() => setEditing(true)}>Düzenle</Button>
            )}
          </div>

          {editing ? (
            <section className="space-y-3 rounded-xl bg-panel-bg/60 p-4 ring-1 ring-panel-line">
              <Input label="Ders adı" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} error={errors.title} maxLength={80} />
              <div className="grid gap-3 sm:grid-cols-4">
                <Input label="Tarih" type="date" min={todayStr()} disabled={s.status !== 'SCHEDULED'} value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="tabular" />
                <Input label="Saat" type="time" step={300} disabled={s.status !== 'SCHEDULED'} value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} className="tabular" />
                <Input label="Süre (dk)" type="number" min={15} max={240} step={5} disabled={s.status !== 'SCHEDULED'} value={form.duration} onChange={(e) => setForm({ ...form, duration: e.target.value })} className="tabular" />
                <Input label="Kontenjan" type="number" min={1} max={12} value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} error={errors.capacity} className="tabular" />
              </div>
              {s.status === 'SCHEDULED' && <Switch checked={form.outside} onChange={(v) => setForm({ ...form, outside: v })} label="Çalışma saatleri dışında olabilir" />}
              <Textarea label="Not" rows={2} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} maxLength={1000} />
              <div className="flex justify-end gap-2">
                <Button variant="secondary" size="sm" onClick={() => setEditing(false)}>Vazgeç</Button>
                <Button size="sm" loading={busy === 'edit'} onClick={saveEdit}>Kaydet</Button>
              </div>
            </section>
          ) : (
            s.note && <p className="rounded-lg bg-panel-bg px-3.5 py-2.5 text-sm whitespace-pre-line text-cocoa">{s.note}</p>
          )}

          <section>
            <h3 className="mb-2 text-[0.8rem] font-semibold tracking-wide text-panel-muted uppercase">Katılımcılar</h3>
            {s.attendees.length === 0 ? (
              <p className="rounded-lg border border-dashed border-panel-line px-4 py-6 text-center text-sm text-panel-muted">Bu derste henüz kimse yok.</p>
            ) : (
              <ul className="divide-y divide-panel-line rounded-xl border border-panel-line">
                {s.attendees.map((a) => {
                  const name = clientName(a.client);
                  const freed = !CLASS_SEAT_HOLDING.includes(a.status);
                  return (
                    <li key={a.clientId} className="flex flex-col gap-2.5 px-4 py-3 sm:flex-row sm:items-center">
                      <div className="min-w-0 flex-1">
                        <Link to={`/panel/danisanlar/${a.clientId}?sekme=pilates`} className={cn('font-semibold text-espresso hover:underline', freed && 'text-panel-muted line-through decoration-panel-muted/50')}>
                          {name}
                        </Link>
                        <p className="mt-0.5 flex items-center gap-2 text-[0.75rem] text-panel-muted">
                          {a.isMember ? 'Grup üyesi' : 'Telafi / misafir'}
                          {a.status === 'BOOKED' && <span>· Kayıtlı</span>}
                        </p>
                      </div>
                      {canWrite && s.status !== 'CANCELLED' ? (
                        <div className="flex items-center gap-1.5">
                          <div role="radiogroup" aria-label={`${name} yoklama`} className="inline-flex gap-1">
                            {MARKS.map((m) => {
                              const locked = m !== 'EXCUSED' && !started;
                              const on = a.status === m;
                              return (
                                <button
                                  key={m}
                                  type="button"
                                  role="radio"
                                  aria-checked={on}
                                  disabled={locked || busy === `m-${a.clientId}`}
                                  title={locked ? 'Ders başladıktan sonra işaretlenebilir' : on ? 'Kaydı “kayıtlı” durumuna geri almak için tekrar tıklayın' : undefined}
                                  onClick={() => mark(a.clientId, on ? 'BOOKED' : m)}
                                  className={cn(
                                    'h-8 rounded-md px-2.5 text-[0.75rem] font-semibold ring-1 ring-inset transition-colors disabled:cursor-not-allowed disabled:opacity-40',
                                    on ? MARK_ON[m] : 'bg-white text-cocoa ring-panel-line hover:ring-cocoa',
                                  )}
                                >
                                  {CLASS_ATTENDANCE_LABEL[m]}
                                </button>
                              );
                            })}
                          </div>
                          <button type="button" onClick={() => remove(a.clientId, name)} aria-label={`${name} kişisini dersten çıkar`} className="rounded-md p-1.5 text-panel-muted hover:bg-danger/10 hover:text-danger-ink">
                            <UserMinus className="h-4 w-4" />
                          </button>
                        </div>
                      ) : (
                        <Badge tone="neutral">{CLASS_ATTENDANCE_LABEL[a.status]}</Badge>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
            {canWrite && s.status !== 'CANCELLED' && (
              <div className="mt-4">
                {s.seatsTaken < s.capacity ? (
                  <MultiClientPicker
                    hideCount
                    label="Telafi / misafir ekle"
                    value={[]}
                    max={1}
                    exclude={s.attendees.filter((a) => a.status !== 'EXCUSED').map((a) => a.clientId)}
                    onChange={(v) => v[0] && run(`add`, () => api.post(`/classes/sessions/${s.id}/attendees`, { clientId: v[0]!.id }), `${clientName(v[0]!)} derse eklendi`)}
                    hint={`${s.capacity - s.seatsTaken} kişilik yer var. “Haber verdi” işaretlenen kişinin yeri boşalır.`}
                  />
                ) : (
                  <p className="flex items-center gap-2 text-[0.82rem] text-panel-muted">
                    <CalendarClock className="h-4 w-4" /> Ders dolu. Haber veren olursa “Haber verdi” işaretleyin; yeri telafi için açılır.
                  </p>
                )}
              </div>
            )}
          </section>
        </div>
      )}
    </Modal>
  );
}
