/**
 * Randevu detay modalı — durum işlemleri, yeniden planlama, dahili not, durum geçmişi.
 * Diğer modüller /panel/randevular?id=<id> bağlantısıyla da açabilir.
 */
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import {
  CalendarClock, Check, CheckCheck, Globe, Mail, MapPin, MessageSquareText, Phone, Trash2, UserRound, UserX, Video, X,
} from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { formatDateTime, formatDayStr, formatPhone, relativeTime, todayStr } from '@/lib/format';
import { APPOINTMENT_STATUS_LABEL, MEETING_TYPE_LABEL, type AppointmentStatus } from '@shared/constants';
import { Button, ErrorState, Modal, Skeleton, StatusBadge, Switch, Textarea, useFeedback } from '../ui';
import { SlotPicker } from './SlotPicker';
import { displayName, TRANSITIONS, type AppointmentDetail } from './types';

type Panel = null | 'reschedule' | 'reject' | 'cancel';

function Row({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <div className="flex gap-3 py-2.5">
      <span className="mt-0.5 text-panel-muted" aria-hidden>{icon}</span>
      <div className="min-w-0">
        <p className="text-[0.72rem] font-semibold tracking-wide text-panel-muted uppercase">{label}</p>
        <div className="mt-0.5 text-sm text-espresso">{children}</div>
      </div>
    </div>
  );
}

export default function AppointmentDetailModal({
  appointmentId, open, onClose, onChanged,
}: { appointmentId: string | null; open: boolean; onClose: () => void; onChanged?: () => void }) {
  const fb = useFeedback();
  const [a, setA] = useState<AppointmentDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [panel, setPanel] = useState<Panel>(null);
  const [note, setNote] = useState('');
  const [reason, setReason] = useState('');
  const [rDate, setRDate] = useState('');
  const [rTime, setRTime] = useState('');
  const [rFree, setRFree] = useState(false);

  const load = useCallback(async () => {
    if (!appointmentId) return;
    setError(null);
    try {
      const r = await api.get<{ appointment: AppointmentDetail }>(`/appointments/${appointmentId}`);
      setA(r.appointment);
      setNote(r.appointment.internalNote ?? '');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Randevu yüklenemedi');
    }
  }, [appointmentId]);

  useEffect(() => {
    if (open) {
      setA(null);
      setPanel(null);
      setReason('');
      void load();
    }
  }, [open, load]);

  const run = async (key: string, fn: () => Promise<unknown>, success: string) => {
    setBusy(key);
    try {
      await fn();
      fb.success(success);
      setPanel(null);
      await load();
      onChanged?.();
    } catch (e) {
      fb.error('İşlem tamamlanamadı', e instanceof ApiError ? e.message : undefined);
    } finally {
      setBusy(null);
    }
  };

  const setStatus = (status: AppointmentStatus, msg: string, n?: string) =>
    run(status, () => api.post(`/appointments/${a!.id}/status`, { status, note: n || null }), msg);

  const confirmFinal = async (status: AppointmentStatus, title: string, description: string, msg: string) => {
    const ok = await fb.confirm({ title, description, confirmLabel: APPOINTMENT_STATUS_LABEL[status], tone: status === 'NO_SHOW' ? 'danger' : 'primary' });
    if (ok) await setStatus(status, msg);
  };

  const remove = async () => {
    const ok = await fb.confirm({
      title: 'Randevu silinsin mi?',
      description: 'Bu işlem geri alınamaz. Kaydı saklamak istiyorsanız silmek yerine “İptal et” seçeneğini kullanın.',
      confirmLabel: 'Kalıcı olarak sil',
      tone: 'danger',
    });
    if (!ok) return;
    setBusy('delete');
    try {
      await api.del(`/appointments/${a!.id}`);
      fb.success('Randevu silindi');
      onChanged?.();
      onClose();
    } catch (e) {
      fb.error('Silinemedi', e instanceof ApiError ? e.message : undefined);
    } finally {
      setBusy(null);
    }
  };

  const allowed = a ? TRANSITIONS[a.status] : [];
  const name = a ? displayName(a) : '';

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={a ? name : 'Randevu'}
      description={a ? (a.date ? `${formatDayStr(a.date, 'd MMMM yyyy, cccc')} · ${a.time}` : 'Saat seçilmemiş geri arama talebi') : undefined}
    >
      {error ? (
        <ErrorState message={error} onRetry={load} />
      ) : !a ? (
        <div className="space-y-4" aria-busy="true">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-10 w-2/3" />
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={a.status} />
            <span className="text-[0.78rem] text-panel-muted">
              {a.source === 'WEBSITE' ? 'Web sitesinden talep' : 'Panelden oluşturuldu'} · {relativeTime(a.createdAt)}
            </span>
          </div>

          {/* Birincil işlemler */}
          {a.status !== 'COMPLETED' && (
            <div className="flex flex-wrap gap-2">
              {allowed.includes('CONFIRMED') && a.date && (
                <Button icon={<Check className="h-4 w-4" />} loading={busy === 'CONFIRMED'} onClick={() => setStatus('CONFIRMED', 'Randevu onaylandı')}>
                  {a.status === 'CANCELLED' || a.status === 'NO_SHOW' ? 'Yeniden onayla' : 'Onayla'}
                </Button>
              )}
              {(a.status === 'PENDING' || a.status === 'NEW_REQUEST') && (
                <Button variant="secondary" icon={<X className="h-4 w-4" />} onClick={() => setPanel(panel === 'reject' ? null : 'reject')}>Reddet</Button>
              )}
              {a.status !== 'NO_SHOW' && (
                <Button variant="secondary" icon={<CalendarClock className="h-4 w-4" />} onClick={() => { setPanel(panel === 'reschedule' ? null : 'reschedule'); setRDate(a.date ?? todayStr()); setRTime(''); setRFree(false); }}>
                  {a.date ? 'Tarihi / saati değiştir' : 'Tarih ve saat ata'}
                </Button>
              )}
              {allowed.includes('COMPLETED') && (
                <Button variant="secondary" icon={<CheckCheck className="h-4 w-4" />} loading={busy === 'COMPLETED'} onClick={() => confirmFinal('COMPLETED', 'Görüşme tamamlandı olarak işaretlensin mi?', `${name} ile görüşme tamamlandı olarak kaydedilecek.`, 'Tamamlandı olarak işaretlendi')}>
                  Tamamlandı
                </Button>
              )}
              {allowed.includes('NO_SHOW') && (
                <Button variant="ghost" icon={<UserX className="h-4 w-4" />} loading={busy === 'NO_SHOW'} onClick={() => confirmFinal('NO_SHOW', 'Danışan gelmedi olarak işaretlensin mi?', 'Bu kayıt raporlarda “Gelmedi” olarak görünür.', 'Gelmedi olarak işaretlendi')}>
                  Gelmedi
                </Button>
              )}
              {a.status === 'CONFIRMED' && (
                <Button variant="ghost" className="text-danger hover:bg-danger/10" onClick={() => setPanel(panel === 'cancel' ? null : 'cancel')}>İptal et</Button>
              )}
            </div>
          )}

          {(panel === 'reject' || panel === 'cancel') && (
            <div className="rounded-xl border border-panel-line bg-panel-bg/60 p-4">
              <Textarea
                label={panel === 'reject' ? 'Reddetme nedeni (isteğe bağlı, yalnızca panelde görünür)' : 'İptal nedeni (isteğe bağlı)'}
                rows={2}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                maxLength={500}
              />
              <div className="mt-3 flex justify-end gap-2">
                <Button variant="ghost" size="sm" onClick={() => setPanel(null)}>Vazgeç</Button>
                <Button variant="danger" size="sm" loading={busy === 'CANCELLED'} onClick={() => setStatus('CANCELLED', panel === 'reject' ? 'Talep reddedildi' : 'Randevu iptal edildi', reason)}>
                  {panel === 'reject' ? 'Talebi reddet' : 'Randevuyu iptal et'}
                </Button>
              </div>
            </div>
          )}

          {panel === 'reschedule' && (
            <div className="space-y-4 rounded-xl border border-panel-line bg-panel-bg/60 p-4">
              <div className="flex flex-wrap items-end gap-4">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="r-date" className="text-[0.8rem] font-semibold text-cocoa">Tarih</label>
                  <input id="r-date" type="date" min={todayStr()} value={rDate} onChange={(e) => { setRDate(e.target.value); setRTime(''); }} className="h-10 rounded-lg border border-panel-line bg-white px-3 text-sm tabular focus:border-cocoa focus:outline-none" />
                </div>
                <div className="pb-2"><Switch checked={rFree} onChange={setRFree} label="Çalışma saatleri dışında" /></div>
              </div>
              <SlotPicker date={rDate} duration={a.durationMinutes ?? undefined} ignoreId={a.id} value={rTime} onChange={setRTime} freeTime={rFree} />
              <div className="flex justify-end gap-2">
                <Button variant="ghost" size="sm" onClick={() => setPanel(null)}>Vazgeç</Button>
                <Button
                  size="sm"
                  disabled={!rDate || !rTime}
                  loading={busy === 'reschedule'}
                  onClick={() => run('reschedule', () => api.patch(`/appointments/${a.id}`, { date: rDate, time: rTime, allowOutsideHours: rFree }), 'Randevu zamanı güncellendi')}
                >
                  Yeni zamanı kaydet
                </Button>
              </div>
            </div>
          )}

          <div className="grid gap-x-8 sm:grid-cols-2">
            <div className="divide-y divide-panel-line/70">
              <Row icon={<UserRound className="h-4 w-4" />} label="Danışan">
                {a.client ? (
                  <Link to={`/panel/danisanlar/${a.client.id}`} className="font-semibold underline decoration-panel-line underline-offset-4 hover:decoration-cocoa">{name}</Link>
                ) : (
                  <span>{a.contactName} <span className="text-panel-muted">— danışan kaydı onayla oluşturulur</span></span>
                )}
              </Row>
              <Row icon={<Phone className="h-4 w-4" />} label="Telefon">
                <a href={`tel:${a.contactPhone}`} className="tabular hover:underline">{formatPhone(a.contactPhone)}</a>
              </Row>
              <Row icon={<Mail className="h-4 w-4" />} label="E-posta">
                {a.contactEmail ? <a href={`mailto:${a.contactEmail}`} className="break-all hover:underline">{a.contactEmail}</a> : <span className="text-panel-muted">Belirtilmedi</span>}
              </Row>
            </div>
            <div className="divide-y divide-panel-line/70">
              <Row icon={<CalendarClock className="h-4 w-4" />} label="Tarih ve saat">
                {a.date ? <span className="tabular">{formatDayStr(a.date, 'd MMMM yyyy')} · {a.time} ({a.durationMinutes} dk)</span> : <span className="text-panel-muted">Atanmadı</span>}
              </Row>
              <Row icon={a.meetingType === 'ONLINE' ? <Video className="h-4 w-4" /> : <MapPin className="h-4 w-4" />} label="Görüşme türü">
                {MEETING_TYPE_LABEL[a.meetingType]}{a.service ? ` · ${a.service.title}` : ''}
              </Row>
              <Row icon={<Globe className="h-4 w-4" />} label="KVKK">
                <span className="text-[0.82rem]">
                  {a.kvkkNoticeAcceptedAt ? `Aydınlatma onayı: ${formatDateTime(a.kvkkNoticeAcceptedAt)}` : 'Aydınlatma kaydı yok'}
                  {a.explicitConsentAt && <><br />Açık rıza: {formatDateTime(a.explicitConsentAt)}</>}
                </span>
              </Row>
            </div>
          </div>

          {a.clientMessage && (
            <div className="rounded-xl bg-panel-bg px-4 py-3">
              <p className="mb-1 flex items-center gap-2 text-[0.72rem] font-semibold tracking-wide text-panel-muted uppercase"><MessageSquareText className="h-3.5 w-3.5" /> Danışanın mesajı</p>
              <p className="text-sm leading-relaxed whitespace-pre-line text-espresso">{a.clientMessage}</p>
            </div>
          )}

          <div>
            <Textarea label="Dahili not" hint="Yalnızca panel kullanıcıları görür. Sağlık bilgisi için danışan profilindeki şifreli görüşme notlarını kullanın." rows={3} value={note} onChange={(e) => setNote(e.target.value)} maxLength={2000} />
            {note !== (a.internalNote ?? '') && (
              <div className="mt-2 flex justify-end">
                <Button size="sm" loading={busy === 'note'} onClick={() => run('note', () => api.patch(`/appointments/${a.id}`, { internalNote: note.trim() || null }), 'Not kaydedildi')}>Notu kaydet</Button>
              </div>
            )}
          </div>

          <div>
            <p className="mb-3 text-[0.72rem] font-semibold tracking-wide text-panel-muted uppercase">Durum geçmişi</p>
            <ol className="relative space-y-3 border-l border-panel-line pl-5">
              {a.statusHistory.map((h) => (
                <li key={h.id} className="relative">
                  <span className="absolute top-1.5 -left-[23.5px] h-2 w-2 rounded-full bg-cocoa ring-4 ring-white" aria-hidden />
                  <p className="text-sm text-espresso">
                    {h.newStartsAt ? (
                      <>Zaman değişti: <span className="tabular">{h.previousStartsAt ? formatDateTime(h.previousStartsAt) : '—'} → {formatDateTime(h.newStartsAt)}</span></>
                    ) : h.fromStatus ? (
                      <>{APPOINTMENT_STATUS_LABEL[h.fromStatus]} → <strong>{APPOINTMENT_STATUS_LABEL[h.toStatus]}</strong></>
                    ) : (
                      <>Oluşturuldu: <strong>{APPOINTMENT_STATUS_LABEL[h.toStatus]}</strong></>
                    )}
                  </p>
                  <p className="text-[0.75rem] text-panel-muted">
                    {formatDateTime(h.changedAt)}{h.changedBy ? ` · ${h.changedBy.firstName} ${h.changedBy.lastName}` : ''}{h.note ? ` · ${h.note}` : ''}
                  </p>
                </li>
              ))}
            </ol>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-panel-line pt-4">
            {a.client ? (
              <Link to={`/panel/danisanlar/${a.client.id}`} className="inline-flex items-center gap-2 text-sm font-semibold text-cocoa hover:underline">
                <UserRound className="h-4 w-4" /> Danışan profiline git
              </Link>
            ) : <span />}
            {a.status !== 'COMPLETED' && (
              <Button variant="ghost" size="sm" className="text-danger hover:bg-danger/10" icon={<Trash2 className="h-4 w-4" />} loading={busy === 'delete'} onClick={remove}>
                Sil
              </Button>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}
