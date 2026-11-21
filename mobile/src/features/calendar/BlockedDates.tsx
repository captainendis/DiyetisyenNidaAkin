// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/** Tarihe özel istisnalar: tatil, izin, takvim kapatma, özel saatler */
import { useState } from 'react';
import { View } from 'react-native';
import {
  BLOCKED_DATE_KIND_LABEL,
  BLOCKED_DATE_KINDS,
  BLOCKED_DATE_REASON_LABEL,
  BLOCKED_DATE_REASONS,
  type BlockedDateKind,
  type BlockedDateReason,
} from '@shared/constants';
import { addDays, todayStr } from '@shared/time';
import { Badge, Button, Card, confirm, DateField, Empty, ErrorView, FieldRow, IconButton, Loading, SelectField, Sheet, SwitchField, T, TextField, TimeField, useToast } from '@/components/ui';
import { api, ApiError, errorMessage } from '@/lib/api';
import { formatDayStr } from '@/lib/format';
import { queryClient, useApiQuery } from '@/lib/query';
import { colors, space, type Tone } from '@/theme';
import type { AffectedAppointment, BlockedDate } from './types';

const REASON_TONE: Record<BlockedDateReason, Tone> = { HOLIDAY: 'gold', LEAVE: 'info', MANUAL: 'rose', OTHER: 'neutral' };

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
    if (
      g &&
      b.date === addDays(g.last.date, 1) &&
      b.kind === g.first.kind &&
      b.reason === g.first.reason &&
      b.label === g.first.label &&
      b.startTime === g.first.startTime &&
      b.endTime === g.first.endTime
    ) {
      g.ids.push(b.id);
      g.last = b;
    } else out.push({ ids: [b.id], first: b, last: b });
  }
  return out;
}

const KIND_HINT: Record<BlockedDateKind, string> = {
  FULL_DAY: 'Seçilen gün(ler)de hiç randevu alınmaz.',
  CUSTOM_HOURS: 'O gün haftalık saatler yerine aşağıdaki saatler geçerli olur (öğle arası korunur).',
  TIME_RANGE: 'Yalnızca belirtilen saat aralığı kapatılır.',
};

export function BlockedDates({ onWarnings }: { onWarnings: (w: AffectedAppointment[]) => void }) {
  const toast = useToast();
  const [showPast, setShowPast] = useState(false);
  const from = showPast ? undefined : todayStr();
  const list = useApiQuery(['availability', 'blocked-dates', from ?? 'all'], () => api.get<{ items: BlockedDate[] }>('/availability/blocked-dates', { from }));
  const [draft, setDraft] = useState<Draft | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const afterChange = () => {
    void queryClient.invalidateQueries({ queryKey: ['availability', 'blocked-dates'] });
    void queryClient.invalidateQueries({ queryKey: ['appointments'] });
  };

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
        label: draft.label.trim() || null,
        startTime: draft.kind === 'FULL_DAY' ? null : draft.startTime || null,
        endTime: draft.kind === 'FULL_DAY' ? null : draft.endTime || null,
      });
      toast(res.items.length > 1 ? `${res.items.length} gün eklendi` : 'Takvim istisnası eklendi');
      onWarnings(res.warnings);
      setDraft(null);
      afterChange();
    } catch (e) {
      if (e instanceof ApiError && e.status === 422) setErrors(e.fields);
      else toast(errorMessage(e), 'error');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (ids: string[], label: string) => {
    const ok = await confirm({
      title: 'İstisnayı kaldır',
      message: `${label} için tanımlı istisna kaldırılacak; bu tarihlerde normal çalışma saatleri geçerli olur.`,
      confirmText: 'Kaldır',
      destructive: true,
    });
    if (!ok) return;
    try {
      for (const id of ids) await api.del(`/availability/blocked-dates/${id}`);
      toast('İstisna kaldırıldı');
    } catch (e) {
      toast(errorMessage(e), 'error');
    }
    afterChange();
  };

  const groups = group(list.data?.items ?? []);

  return (
    <View style={{ gap: space.md }}>
      <T variant="caption">Belirli tarihlerde takvimi kapatın veya o güne özel çalışma saatleri tanımlayın.</T>
      <Button
        title="İstisna ekle"
        icon="plus"
        size="sm"
        style={{ alignSelf: 'flex-start' }}
        onPress={() => {
          setErrors({});
          setDraft(empty());
        }}
      />
      <SwitchField label="Geçmiş tarihleri de göster" value={showPast} onChange={setShowPast} />
      {list.error ? (
        <ErrorView error={list.error} onRetry={() => void list.refetch()} />
      ) : !list.data ? (
        <Loading />
      ) : !groups.length ? (
        <Card>
          <Empty icon="calendar" title="Planlanmış istisna yok" text="Resmî tatilleri, izin günlerinizi veya o güne özel çalışma saatlerini buradan ekleyin." />
        </Card>
      ) : (
        <Card padded={false} style={{ overflow: 'hidden' }}>
          {groups.map((g, i) => {
            const range = g.ids.length > 1 ? `${formatDayStr(g.first.date, 'd MMM')} – ${formatDayStr(g.last.date, 'd MMM yyyy')}` : formatDayStr(g.first.date, 'd MMMM yyyy, cccc');
            return (
              <View key={g.first.id} style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg, borderBottomWidth: i < groups.length - 1 ? 1 : 0, borderBottomColor: colors.line }}>
                <View style={{ flex: 1, gap: 4 }}>
                  <T variant="subheading">{range}</T>
                  <Badge label={BLOCKED_DATE_REASON_LABEL[g.first.reason]} tone={REASON_TONE[g.first.reason]} />
                  <T variant="caption">
                    {BLOCKED_DATE_KIND_LABEL[g.first.kind]}
                    {g.first.kind !== 'FULL_DAY' ? ` · ${g.first.startTime}–${g.first.endTime}` : ''}
                    {g.first.label ? ` · ${g.first.label}` : ''}
                    {g.ids.length > 1 ? ` · ${g.ids.length} gün` : ''}
                  </T>
                </View>
                <IconButton name="trash-2" label={`${range} istisnasını kaldır`} color={colors.dangerInk} onPress={() => void remove(g.ids, range)} />
              </View>
            );
          })}
        </Card>
      )}

      <Sheet
        visible={!!draft}
        onClose={() => setDraft(null)}
        title="Takvim istisnası ekle"
        full
        footer={
          <>
            <Button title="Vazgeç" variant="secondary" style={{ flex: 1 }} onPress={() => setDraft(null)} />
            <Button title="Ekle" style={{ flex: 1 }} loading={saving} onPress={() => void save()} />
          </>
        }
      >
        {draft ? (
          <>
            <SelectField<BlockedDateKind>
              label="Tür"
              value={draft.kind}
              onChange={(kind) => setDraft({ ...draft, kind })}
              options={BLOCKED_DATE_KINDS.map((k) => ({ value: k, label: BLOCKED_DATE_KIND_LABEL[k] }))}
              help={KIND_HINT[draft.kind]}
            />
            <DateField label={draft.multi ? 'Başlangıç tarihi' : 'Tarih'} required value={draft.date} error={errors.date} onChange={(date) => setDraft({ ...draft, date })} />
            <SwitchField label="Birden fazla gün (tarih aralığı)" help="En fazla 120 gün." value={draft.multi} onChange={(multi) => setDraft({ ...draft, multi })} />
            {draft.multi ? (
              <DateField label="Bitiş tarihi (dahil)" value={draft.endDate} minimumDate={draft.date} error={errors.endDate} onChange={(endDate) => setDraft({ ...draft, endDate })} />
            ) : null}
            {draft.kind !== 'FULL_DAY' ? (
              <FieldRow>
                <TimeField
                  label={draft.kind === 'CUSTOM_HOURS' ? 'Çalışma başlangıcı' : 'Kapalı aralık başlangıcı'}
                  required
                  value={draft.startTime}
                  error={errors.startTime}
                  onChange={(startTime) => setDraft({ ...draft, startTime })}
                />
                <TimeField
                  label={draft.kind === 'CUSTOM_HOURS' ? 'Çalışma bitişi' : 'Kapalı aralık bitişi'}
                  required
                  value={draft.endTime}
                  error={errors.endTime}
                  onChange={(endTime) => setDraft({ ...draft, endTime })}
                />
              </FieldRow>
            ) : null}
            <SelectField<BlockedDateReason>
              label="Neden"
              value={draft.reason}
              onChange={(reason) => setDraft({ ...draft, reason })}
              options={BLOCKED_DATE_REASONS.map((r) => ({ value: r, label: BLOCKED_DATE_REASON_LABEL[r] }))}
            />
            <TextField
              label="Açıklama (isteğe bağlı)"
              placeholder="Ör. Cumhuriyet Bayramı, Yıllık izin"
              maxLength={120}
              value={draft.label}
              error={errors.label}
              help="Yalnızca panelde görünür."
              onChange={(label) => setDraft({ ...draft, label })}
            />
          </>
        ) : null}
      </Sheet>
    </View>
  );
}
