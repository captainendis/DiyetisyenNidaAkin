// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/** Tarihe özel istisnalar: tatil, izin, takvim kapatma, özel saatler */
import { useState } from 'react';
import { CalendarOff, Plus, Trash2 } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { useApi } from '@/hooks/useApi';
import { Badge, Button, Card, CardHeader, Checkbox, EmptyState, ErrorState, IconButton, Input, Modal, Select, SkeletonRows, useFeedback, type BadgeTone } from '@/components/panel/ui';
import {
  BLOCKED_DATE_KIND_LABEL, BLOCKED_DATE_KINDS, BLOCKED_DATE_REASON_LABEL, BLOCKED_DATE_REASONS, type BlockedDateKind, type BlockedDateReason,
} from '@shared/constants';
import { formatDayStr, todayStr } from '@/lib/format';
import type { AffectedAppointment, BlockedDate } from './types';

const REASON_TONE: Record<BlockedDateReason, BadgeTone> = { HOLIDAY: 'accent', LEAVE: 'info', MANUAL: 'dark', OTHER: 'neutral' };

interface Draft {
  date: string;
  multi: boolean;
  endDate: string;
  kind: BlockedDateKind;
  reason: BlockedDateReason;
  label: string;
  startTime: string;
  endTime: string;
}
const empty = (): Draft => ({ date: todayStr(), multi: false, endDate: '', kind: 'FULL_DAY', reason: 'LEAVE', label: '', startTime: '', endTime: '' });

/** Ardışık, aynı tür/nedenli günleri tek satırda gruplar */
function group(items: BlockedDate[]) {
  const out: { ids: string[]; first: BlockedDate; last: BlockedDate }[] = [];
  for (const b of items) {
    const g = out[out.length - 1];
    const next = g && (() => {
      const d = new Date(`${g.last.date}T12:00:00Z`);
      d.setUTCDate(d.getUTCDate() + 1);
      return d.toISOString().slice(0, 10);
    })();
    if (g && b.date === next && b.kind === g.first.kind && b.reason === g.first.reason && b.label === g.first.label && b.startTime === g.first.startTime && b.endTime === g.first.endTime) {
      g.ids.push(b.id);
      g.last = b;
    } else out.push({ ids: [b.id], first: b, last: b });
  }
  return out;
}

export function BlockedDates({ onWarnings }: { onWarnings: (w: AffectedAppointment[]) => void }) {
  const fb = useFeedback();
  const [showPast, setShowPast] = useState(false);
  const from = showPast ? undefined : todayStr();
  const list = useApi(() => api.get<{ items: BlockedDate[] }>('/availability/blocked-dates', { from }), [from]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!draft) return;
    setSaving(true);
    setErrors({});
    try {
      const res = await api.post<{ items: BlockedDate[]; warnings: AffectedAppointment[] }>('/availability/blocked-dates', {
        date: draft.date,
        endDate: draft.multi && draft.endDate ? draft.endDate : null,
        kind: draft.kind,
        reason: draft.reason,
        label: draft.label || null,
        startTime: draft.kind === 'FULL_DAY' ? null : draft.startTime || null,
        endTime: draft.kind === 'FULL_DAY' ? null : draft.endTime || null,
      });
      fb.success(res.items.length > 1 ? `${res.items.length} gün eklendi` : 'Takvim istisnası eklendi');
      onWarnings(res.warnings);
      setDraft(null);
      void list.reload();
    } catch (e) {
      if (e instanceof ApiError && e.status === 422) setErrors(e.fields);
      else fb.error('Eklenemedi', e instanceof ApiError ? e.message : undefined);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (ids: string[], label: string) => {
    if (!(await fb.confirm({ title: 'İstisnayı kaldır', description: `${label} için tanımlı istisna kaldırılacak; bu tarihlerde normal çalışma saatleri geçerli olur.`, confirmLabel: 'Kaldır', tone: 'danger' }))) return;
    try {
      for (const id of ids) await api.del(`/availability/blocked-dates/${id}`);
      fb.success('İstisna kaldırıldı');
    } catch {
      fb.error('Kaldırılamadı');
    }
    void list.reload();
  };

  const groups = group(list.data?.items ?? []);

  return (
    <Card>
      <CardHeader
        title="Tatil, izin ve özel günler"
        description="Belirli tarihlerde takvimi kapatın veya o güne özel çalışma saatleri tanımlayın."
        action={<Button size="sm" icon={<Plus className="h-4 w-4" />} onClick={() => (setErrors({}), setDraft(empty()))}>İstisna ekle</Button>}
        className="pb-4"
      />
      <div className="flex justify-end border-t border-panel-line px-5 py-2">
        <Checkbox label="Geçmiş tarihleri de göster" checked={showPast} onChange={(e) => setShowPast(e.target.checked)} />
      </div>
      {list.loading && !list.data ? (
        <SkeletonRows rows={3} />
      ) : list.error ? (
        <ErrorState message={list.error.message} onRetry={list.reload} />
      ) : !groups.length ? (
        <EmptyState icon={<CalendarOff className="h-5 w-5" />} title="Planlanmış istisna yok" description="Resmî tatilleri, izin günlerinizi veya o güne özel çalışma saatlerini buradan ekleyin." className="border-t border-panel-line" />
      ) : (
        <ul className="divide-y divide-panel-line border-t border-panel-line">
          {groups.map((g) => {
            const range = g.ids.length > 1 ? `${formatDayStr(g.first.date, 'd MMM')} – ${formatDayStr(g.last.date, 'd MMM yyyy')}` : formatDayStr(g.first.date, 'd MMMM yyyy, cccc');
            return (
              <li key={g.first.id} className="flex items-center gap-4 px-5 py-3.5">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-espresso">{range}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-[0.8rem] text-panel-muted">
                    <Badge tone={REASON_TONE[g.first.reason]}>{BLOCKED_DATE_REASON_LABEL[g.first.reason]}</Badge>
                    <span>
                      {BLOCKED_DATE_KIND_LABEL[g.first.kind]}
                      {g.first.kind !== 'FULL_DAY' && ` · ${g.first.startTime}–${g.first.endTime}`}
                    </span>
                    {g.first.label && <span>· {g.first.label}</span>}
                    {g.ids.length > 1 && <span className="tabular">· {g.ids.length} gün</span>}
                  </div>
                </div>
                <IconButton label="Kaldır" className="hover:text-danger" onClick={() => void remove(g.ids, range)}>
                  <Trash2 className="h-4 w-4" />
                </IconButton>
              </li>
            );
          })}
        </ul>
      )}

      <Modal
        open={!!draft}
        onClose={() => setDraft(null)}
        title="Takvim istisnası ekle"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDraft(null)}>Vazgeç</Button>
            <Button onClick={() => void save()} loading={saving}>Ekle</Button>
          </>
        }
      >
        {draft && (
          <div className="space-y-4">
            <Select
              label="Tür"
              value={draft.kind}
              onChange={(e) => setDraft({ ...draft, kind: e.target.value as BlockedDateKind })}
              options={BLOCKED_DATE_KINDS.map((k) => ({ value: k, label: BLOCKED_DATE_KIND_LABEL[k] }))}
              hint={
                draft.kind === 'FULL_DAY'
                  ? 'Seçilen gün(ler)de hiç randevu alınmaz.'
                  : draft.kind === 'CUSTOM_HOURS'
                    ? 'O gün haftalık saatler yerine aşağıdaki saatler geçerli olur (öğle arası korunur).'
                    : 'Yalnızca belirtilen saat aralığı kapatılır.'
              }
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <Input label={draft.multi ? 'Başlangıç tarihi' : 'Tarih'} type="date" required value={draft.date} error={errors.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })} />
              {draft.multi && <Input label="Bitiş tarihi (dahil)" type="date" min={draft.date} value={draft.endDate} error={errors.endDate} onChange={(e) => setDraft({ ...draft, endDate: e.target.value })} />}
            </div>
            <Checkbox label="Birden fazla gün (tarih aralığı)" description="En fazla 120 gün." checked={draft.multi} onChange={(e) => setDraft({ ...draft, multi: e.target.checked })} />
            {draft.kind !== 'FULL_DAY' && (
              <div className="grid gap-4 sm:grid-cols-2">
                <Input label={draft.kind === 'CUSTOM_HOURS' ? 'Çalışma başlangıcı' : 'Kapalı aralık başlangıcı'} type="time" step={300} required value={draft.startTime} error={errors.startTime} onChange={(e) => setDraft({ ...draft, startTime: e.target.value })} />
                <Input label={draft.kind === 'CUSTOM_HOURS' ? 'Çalışma bitişi' : 'Kapalı aralık bitişi'} type="time" step={300} required value={draft.endTime} error={errors.endTime} onChange={(e) => setDraft({ ...draft, endTime: e.target.value })} />
              </div>
            )}
            <Select label="Neden" value={draft.reason} onChange={(e) => setDraft({ ...draft, reason: e.target.value as BlockedDateReason })} options={BLOCKED_DATE_REASONS.map((r) => ({ value: r, label: BLOCKED_DATE_REASON_LABEL[r] }))} />
            <Input label="Açıklama (isteğe bağlı)" placeholder="Ör. Cumhuriyet Bayramı, Yıllık izin" maxLength={120} value={draft.label} error={errors.label} hint="Yalnızca panelde görünür." onChange={(e) => setDraft({ ...draft, label: e.target.value })} />
          </div>
        )}
      </Modal>
    </Card>
  );
}
