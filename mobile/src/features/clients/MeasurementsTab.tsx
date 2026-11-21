// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/** Beslenme takibi: ölçüm ekleme, kilo grafiği, vücut kompozisyonu ve ölçüm geçmişi */
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Button, Card, DateField, Empty, FieldRow, Form, IconButton, Notice, QueryView, Section, Sheet, T, TextField, confirm, useToast } from '@/components/ui';
import { api, ApiError, errorMessage } from '@/lib/api';
import { useStaff } from '@/lib/auth';
import { formatDayStr, todayStr } from '@/lib/format';
import { queryClient, useApiQuery } from '@/lib/query';
import { composeAll } from '@shared/body-composition';
import { CIRCUMFERENCES, type CircumferenceKey } from '@shared/measurements';
import { colors, space } from '@/theme';
import { BodyComposition } from './BodyComposition';
import { ConsentGate } from './Consent';
import { WeightTrend } from './WeightTrend';
import { n1, withUnit } from './common';
import { clientKeys, type Client, type Measurement } from './types';

type Res = { items: Measurement[] };
type Num = 'heightCm' | 'weightKg' | 'targetWeightKg' | 'bodyFatPct' | 'muscleKg' | CircumferenceKey;

const emptyCirc = () => Object.fromEntries(CIRCUMFERENCES.map(({ key }) => [key, ''])) as Record<CircumferenceKey, string>;
const num = (v: string) => (v.trim() === '' ? null : Number(v.replace(',', '.')));

function MeasurementSheet({ client, visible, onClose, lastHeight, onSaved }: { client: Client; visible: boolean; onClose: () => void; lastHeight: number | null; onSaved: (m: Measurement) => void }) {
  const init = () => ({ measuredOn: todayStr(), heightCm: '', weightKg: '', targetWeightKg: '', bodyFatPct: '', muscleKg: '', note: '', ...emptyCirc() });
  const [f, setF] = useState(init);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [general, setGeneral] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const toast = useToast();

  useEffect(() => {
    if (visible) {
      setErrors({});
      setGeneral(null);
    }
  }, [visible]);

  const field = (key: Num, label: string, placeholder?: string, help?: string) => (
    <TextField label={label} keyboardType="decimal-pad" value={f[key]} onChange={(v) => setF((s) => ({ ...s, [key]: v }))} error={errors[key]} placeholder={placeholder} help={help} />
  );

  async function submit() {
    setPending(true);
    setErrors({});
    setGeneral(null);
    try {
      const res = await api.post<{ measurement: Measurement }>(`/clients/${client.id}/measurements`, {
        measuredOn: f.measuredOn,
        heightCm: num(f.heightCm),
        weightKg: num(f.weightKg),
        targetWeightKg: num(f.targetWeightKg),
        bodyFatPct: num(f.bodyFatPct),
        muscleKg: num(f.muscleKg),
        ...Object.fromEntries(CIRCUMFERENCES.map(({ key }) => [key, num(f[key])])),
        note: f.note || null,
      });
      onSaved(res.measurement);
      // Boy, hedef ve tarih bir sonraki ölçüm için kalır (web ile aynı)
      setF((s) => ({ ...s, weightKg: '', bodyFatPct: '', muscleKg: '', note: '', ...emptyCirc() }));
      toast('Ölçüm kaydedildi');
      onClose();
    } catch (err) {
      if (err instanceof ApiError) {
        setErrors(err.fields);
        if (!Object.keys(err.fields).length) setGeneral(err.message);
      } else setGeneral(errorMessage(err));
    } finally {
      setPending(false);
    }
  }

  const pairs: (typeof CIRCUMFERENCES)[number][][] = [];
  CIRCUMFERENCES.forEach((c, i) => (i % 2 ? pairs[pairs.length - 1]!.push(c) : pairs.push([c])));

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      full
      title="Yeni ölçüm"
      footer={
        <>
          <Button title="Vazgeç" variant="secondary" onPress={onClose} style={{ flex: 1 }} />
          <Button title="Ölçümü kaydet" loading={pending} onPress={() => void submit()} style={{ flex: 1 }} />
        </>
      }
    >
      <Form>
        <DateField label="Ölçüm tarihi" required maximumDate={todayStr()} value={f.measuredOn} onChange={(v) => setF((s) => ({ ...s, measuredOn: v }))} error={errors.measuredOn} />
        <FieldRow>
          {field('weightKg', 'Kilo (kg)')}
          {field('heightCm', 'Boy (cm)', lastHeight ? String(lastHeight) : undefined)}
        </FieldRow>
        {field('targetWeightKg', 'Hedef kilo (kg)', undefined, 'İsteğe bağlı')}
        <T variant="overline">Mezura ölçüleri (cm)</T>
        {pairs.map((p) => (
          <FieldRow key={p[0]!.key}>{p.map((c) => <View key={c.key}>{field(c.key, c.label)}</View>)}</FieldRow>
        ))}
        <T variant="overline">Vücut analizi cihazı (varsa)</T>
        <FieldRow>
          {field('bodyFatPct', 'Yağ oranı (%)')}
          {field('muscleKg', 'Kas kütlesi (kg)')}
        </FieldRow>
        <TextField label="Not" value={f.note} onChange={(v) => setF((s) => ({ ...s, note: v }))} error={errors.note} maxLength={500} />
        {general ? <Notice tone="danger" text={general} /> : null}
      </Form>
    </Sheet>
  );
}

export function MeasurementsTab({ client, onClientChanged }: { client: Client; onClientChanged: (c: Client) => void }) {
  const { can } = useStaff();
  const writable = can('clinical:write');
  const consent = !!client.healthConsentAt;
  const key = clientKeys.sub(client.id, 'measurements');
  const q = useApiQuery(key, () => api.get<Res>(`/clients/${client.id}/measurements`));
  const [adding, setAdding] = useState(false);
  const toast = useToast();
  const setItems = (fn: (items: Measurement[]) => Measurement[]) => queryClient.setQueryData<Res>(key, (d) => ({ items: fn(d?.items ?? []) }));

  async function remove(m: Measurement) {
    if (!(await confirm({ title: 'Ölçüm silinsin mi?', message: `${formatDayStr(m.measuredOn)} tarihli ölçüm kalıcı olarak silinecek.`, confirmText: 'Sil', destructive: true }))) return;
    try {
      await api.del(`/clients/${client.id}/measurements/${m.id}`);
      setItems((items) => items.filter((x) => x.id !== m.id));
      toast('Ölçüm silindi');
    } catch (e) {
      toast(errorMessage(e), 'error');
    }
  }

  const profile = { sex: client.sex, birthDate: client.birthDate };
  const lastHeight = q.data?.items.find((m) => m.heightCm != null)?.heightCm ?? null;

  return (
    <View>
      {!consent ? <ConsentGate client={client} onChanged={onClientChanged} what="beslenme takibi ölçümleri" /> : null}
      {consent && writable ? <Button title="Yeni ölçüm" icon="plus" onPress={() => setAdding(true)} style={{ marginBottom: space.lg }} /> : null}
      <QueryView query={q}>
        {(data) => {
          if (!data.items.length) {
            return consent ? (
              <Card>
                <Empty icon="activity" title="Henüz ölçüm kaydı yok." text={writable ? 'İlk ölçümü “Yeni ölçüm” ile ekleyebilirsiniz.' : undefined} />
              </Card>
            ) : null;
          }
          const comp = new Map(composeAll(data.items, profile).map((c) => [c.id, c]));
          return (
            <View>
              {data.items.filter((m) => m.weightKg != null).length >= 2 ? (
                <Card style={{ marginBottom: space.lg }}>
                  <WeightTrend items={data.items} />
                </Card>
              ) : null}
              <Section title="Vücut kompozisyonu">
                <Card>
                  <BodyComposition items={data.items} profile={profile} />
                </Card>
              </Section>
              <Section title="Ölçüm geçmişi" style={{ marginBottom: space.sm }}>
                <T variant="caption" style={{ marginBottom: space.sm, paddingHorizontal: 2 }}>Değerler şifreli saklanır.</T>
                <View style={{ gap: space.md }}>
                  {data.items.map((m) => {
                    const c = comp.get(m.id);
                    const circ = CIRCUMFERENCES.filter(({ key: k }) => m[k] != null);
                    const main = [
                      withUnit(m.weightKg, 'kg'),
                      withUnit(m.heightCm, 'cm'),
                      c?.bmi != null ? `BKİ ${n1(c.bmi)}` : null,
                      m.targetWeightKg != null ? `Hedef ${withUnit(m.targetWeightKg, 'kg')}` : null,
                    ].filter(Boolean);
                    const body = [
                      c?.fatPct != null ? `Yağ %${n1(c.fatPct)}${c.fatKg != null ? ` · ${n1(c.fatKg)} kg` : ''}` : null,
                      c?.muscleKg != null ? `Kas ${withUnit(c.muscleKg, 'kg')}` : c?.leanKg != null ? `Yağsız ${withUnit(c.leanKg, 'kg')}` : null,
                    ].filter(Boolean);
                    return (
                      <Card key={m.id} style={{ gap: 4 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space.sm }}>
                          <T variant="subheading" style={{ flex: 1 }}>{formatDayStr(m.measuredOn)}</T>
                          {writable ? <IconButton name="trash-2" label="Ölçümü sil" onPress={() => void remove(m)} color={colors.dangerInk} /> : null}
                        </View>
                        <T>{main.join(' · ')}</T>
                        {body.length ? <T variant="caption" color={colors.text}>{body.join(' · ')}</T> : null}
                        {circ.length ? (
                          <T variant="caption" color={colors.text}>{circ.map(({ key: k, label }) => `${label} ${m[k]!.toLocaleString('tr-TR')}`).join(' · ')} cm</T>
                        ) : null}
                        {m.note ? <T variant="caption">{m.note}</T> : null}
                      </Card>
                    );
                  })}
                </View>
              </Section>
            </View>
          );
        }}
      </QueryView>
      {consent && writable ? (
        <MeasurementSheet
          client={client}
          visible={adding}
          onClose={() => setAdding(false)}
          lastHeight={lastHeight}
          onSaved={(m) => setItems((items) => [m, ...items].sort((a, b) => b.measuredOn.localeCompare(a.measuredOn)))}
        />
      ) : null}
    </View>
  );
}
