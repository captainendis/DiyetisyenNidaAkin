// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/**
 * Haftalık çalışma saatleri. Her gün bir kart; dokununca gün ayarları alttan açılır.
 * Değişiklikler yerelde tutulur; ekranın altındaki "Kaydet" ile 7 gün birlikte gönderilir (PUT /availability/rules).
 */
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Switch, View } from 'react-native';
import { WEEKDAY_LABEL } from '@shared/constants';
import { Button, Card, FieldRow, Icon, Notice, Sheet, SwitchField, T, TextField, TimeField, useToast } from '@/components/ui';
import { api, ApiError, errorMessage } from '@/lib/api';
import { useApiQuery, queryClient } from '@/lib/query';
import { colors, space } from '@/theme';
import { cleanRule, slotsPerDay, type AffectedAppointment, type Rule } from './types';

export function useWeeklyRules(onWarnings: (w: AffectedAppointment[]) => void) {
  const toast = useToast();
  const q = useApiQuery(['availability', 'rules'], () => api.get<{ rules: Rule[] }>('/availability/rules').then((r) => r.rules.map(cleanRule)));
  const [rules, setRules] = useState<Rule[] | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (q.data) setRules(q.data);
  }, [q.data]);
  const dirty = useMemo(() => !!rules && !!q.data && JSON.stringify(rules) !== JSON.stringify(q.data), [rules, q.data]);

  const update = (i: number, patch: Partial<Rule>) => {
    setRules((rs) => rs!.map((r, j) => (j === i ? { ...r, ...patch } : r)));
    setErrors((e) => Object.fromEntries(Object.entries(e).filter(([k]) => !k.startsWith(`rules.${i}.`))));
  };

  const copyMonday = () => {
    if (!rules) return;
    const mon = rules[0]!;
    setRules(rules.map((r) => (r.weekday >= 2 && r.weekday <= 5 ? { ...mon, weekday: r.weekday } : r)));
    toast('Pazartesi ayarları Salı–Cuma günlerine kopyalandı. Kaydetmeyi unutmayın.', 'info');
  };

  const reset = () => {
    if (q.data) setRules(q.data);
    setErrors({});
  };

  const save = async () => {
    if (!rules) return;
    const local: Record<string, string> = {};
    rules.forEach((r, i) => {
      if (r.isWorking && (!r.startTime || !r.endTime)) local[`rules.${i}.startTime`] = 'Çalışılan gün için başlangıç ve bitiş saati girin';
      if (!Number.isFinite(r.slotMinutes) || r.slotMinutes < 10 || r.slotMinutes > 240) local[`rules.${i}.slotMinutes`] = 'Randevu süresi 10–240 dk olmalı';
      if (!Number.isFinite(r.bufferMinutes) || r.bufferMinutes < 0 || r.bufferMinutes > 120) local[`rules.${i}.bufferMinutes`] = 'Dinlenme süresi 0–120 dk olmalı';
    });
    if (Object.keys(local).length) {
      setErrors(local);
      toast('Kaydedilemedi. İşaretli günleri kontrol edin.', 'error');
      return;
    }
    setSaving(true);
    try {
      const res = await api.put<{ rules: Rule[]; warnings: AffectedAppointment[] }>('/availability/rules', { rules });
      const clean = res.rules.map(cleanRule);
      queryClient.setQueryData(['availability', 'rules'], clean);
      setRules(clean);
      setErrors({});
      onWarnings(res.warnings);
      toast('Çalışma saatleri kaydedildi. Web sitesindeki randevu saatleri güncellendi.');
      void queryClient.invalidateQueries({ queryKey: ['appointments'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    } catch (e) {
      if (e instanceof ApiError && e.status === 422) setErrors(e.fields);
      toast(e instanceof ApiError && e.status === 422 ? 'Kaydedilemedi. İşaretli günleri kontrol edin.' : errorMessage(e), 'error');
    } finally {
      setSaving(false);
    }
  };

  return { q, rules, errors, saving, dirty, update, copyMonday, reset, save };
}

export type WeeklyCtl = ReturnType<typeof useWeeklyRules>;

const rowErrors = (errors: Record<string, string>, i: number) => [...new Set(Object.entries(errors).filter(([k]) => k.startsWith(`rules.${i}.`)).map(([, v]) => v))];

export function WeeklySchedule({ ctl }: { ctl: WeeklyCtl }) {
  const [editing, setEditing] = useState<number | null>(null);
  const rules = ctl.rules!;
  const weeklyTotal = rules.reduce((n, r) => n + slotsPerDay(r), 0);
  const noneWorking = !rules.some((r) => r.isWorking);

  return (
    <View style={{ gap: space.md }}>
      <T variant="caption">Web sitesindeki randevu formu yalnızca bu saatlerdeki boş zaman dilimlerini gösterir.</T>
      {noneWorking ? (
        <Notice
          tone="rose"
          icon="calendar"
          title="Çalışma saatleri henüz tanımlanmadı"
          text="Web sitesindeki randevu formu yalnızca “beni arayın” talebi alır. Çalıştığınız günleri açıp saatlerinizi girin."
        />
      ) : null}
      <Card padded={false} style={{ overflow: 'hidden' }}>
        {rules.map((r, i) => {
          const n = slotsPerDay(r);
          const errs = rowErrors(ctl.errors, i);
          const summary = !r.isWorking
            ? 'Kapalı'
            : !r.startTime || !r.endTime
              ? 'Saatleri girin'
              : `${r.startTime}–${r.endTime}${r.breakStart && r.breakEnd ? ` · öğle ${r.breakStart}–${r.breakEnd}` : ''} · ${r.slotMinutes} dk + ${r.bufferMinutes} dk ara`;
          return (
            <View key={r.weekday} style={[styles.day, i < rules.length - 1 && styles.line, !r.isWorking && { backgroundColor: '#F8F4EE' }]}>
              <Pressable onPress={() => setEditing(i)} style={{ flex: 1, gap: 2 }} accessibilityRole="button" accessibilityLabel={`${WEEKDAY_LABEL[r.weekday]}: ${summary}. Düzenle`}>
                <T variant="subheading" color={r.isWorking ? colors.text : colors.muted}>{WEEKDAY_LABEL[r.weekday]}</T>
                <T variant="caption">{summary}</T>
                {r.isWorking && n > 0 ? <T variant="caption" color={colors.successInk}>{n} randevu / gün</T> : null}
                {errs.length ? <T variant="caption" color={colors.dangerInk}>{errs.join(' · ')}</T> : null}
              </Pressable>
              <Switch
                value={r.isWorking}
                onValueChange={(v) => ctl.update(i, { isWorking: v })}
                accessibilityLabel={`${WEEKDAY_LABEL[r.weekday]} çalışıyor`}
                trackColor={{ true: colors.gold, false: colors.line }}
              />
              <Pressable onPress={() => setEditing(i)} hitSlop={13} accessibilityRole="button" accessibilityLabel={`${WEEKDAY_LABEL[r.weekday]} ayarları`}>
                <Icon name="chevron-right" size={18} color={colors.muted} />
              </Pressable>
            </View>
          );
        })}
      </Card>
      <Button title="Pazartesi’yi hafta içine kopyala" icon="copy" variant="secondary" size="sm" disabled={!rules[0]?.isWorking} style={{ alignSelf: 'flex-start' }} onPress={ctl.copyMonday} />
      <T variant="caption">
        {weeklyTotal > 0 ? `Bu ayarlarla haftada en fazla ${weeklyTotal} randevu alınabilir.` : 'Çalışma günü tanımlı değil.'}
      </T>
      {editing !== null ? <DaySheet rule={rules[editing]!} index={editing} errors={ctl.errors} onChange={(p) => ctl.update(editing, p)} onClose={() => setEditing(null)} /> : null}
    </View>
  );
}

function NumInput({ label, value, onChange, error, disabled }: { label: string; value: number; onChange: (v: number) => void; error?: string; disabled?: boolean }) {
  return (
    <TextField
      label={label}
      value={Number.isFinite(value) ? String(value) : ''}
      onChange={(v) => onChange(v === '' ? NaN : Number(v.replace(/\D/g, '')))}
      keyboardType="number-pad"
      maxLength={3}
      error={error}
      editable={!disabled}
    />
  );
}

function DaySheet({ rule: r, index: i, errors, onChange, onClose }: { rule: Rule; index: number; errors: Record<string, string>; onChange: (p: Partial<Rule>) => void; onClose: () => void }) {
  const err = (f: string) => errors[`rules.${i}.${f}`];
  const off = !r.isWorking;
  const n = slotsPerDay(r);
  return (
    <Sheet visible onClose={onClose} title={WEEKDAY_LABEL[r.weekday]!} subtitle={off ? 'Kapalı' : n > 0 ? `${n} randevu / gün` : 'Saatleri girin'} footer={<Button title="Tamam" full style={{ flex: 1 }} onPress={onClose} />}>
      <SwitchField label="Bu gün çalışıyorum" value={r.isWorking} onChange={(v) => onChange({ isWorking: v })} />
      {!off ? (
        <>
          <T variant="label">Çalışma saatleri</T>
          <FieldRow>
            <TimeField label="Başlangıç" value={r.startTime} onChange={(v) => onChange({ startTime: v || null })} error={err('startTime')} />
            <TimeField label="Bitiş" value={r.endTime} onChange={(v) => onChange({ endTime: v || null })} error={err('endTime')} />
          </FieldRow>
          <T variant="label">Öğle arası (isteğe bağlı)</T>
          <FieldRow>
            <TimeField label="Başlangıç" value={r.breakStart} clearable placeholder="Yok" onChange={(v) => onChange({ breakStart: v || null })} error={err('breakStart')} />
            <TimeField label="Bitiş" value={r.breakEnd} clearable placeholder="Yok" onChange={(v) => onChange({ breakEnd: v || null })} error={err('breakEnd')} />
          </FieldRow>
          <FieldRow>
            <NumInput label="Randevu süresi (dk)" value={r.slotMinutes} onChange={(v) => onChange({ slotMinutes: v })} error={err('slotMinutes')} />
            <NumInput label="Ara dinlenme (dk)" value={r.bufferMinutes} onChange={(v) => onChange({ bufferMinutes: v })} error={err('bufferMinutes')} />
          </FieldRow>
        </>
      ) : (
        <T muted>Bu gün web sitesinden randevu alınmaz.</T>
      )}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  day: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: 12, paddingHorizontal: space.lg, minHeight: 64 },
  line: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
});
