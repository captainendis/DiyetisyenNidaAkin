// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

import { useState, type FormEvent } from 'react';
import { Ruler, Trash2 } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { useApi } from '@/hooks/useApi';
import { formatDayStr, todayStr } from '@/lib/format';
import { Button, Card, CardHeader, EmptyState, ErrorState, IconButton, Input, ResponsiveTable, SkeletonRows, useFeedback } from '@/components/panel/ui';
import { usePanelAuth } from '@/components/panel/PanelAuth';
import { ConsentGate } from './ConsentGate';
import { WeightTrend } from './WeightTrend';
import { BodyComposition } from './BodyComposition';
import { composeAll } from '@shared/body-composition';
import { CIRCUMFERENCES, type CircumferenceKey } from '@shared/measurements';
import type { Client, Measurement } from './types';

const emptyCirc = () => Object.fromEntries(CIRCUMFERENCES.map(({ key }) => [key, ''])) as Record<CircumferenceKey, string>;

const num = (v: string) => (v.trim() === '' ? null : Number(v.replace(',', '.')));
const fmt = (v: number | null, unit: string) => (v == null ? '—' : `${v.toLocaleString('tr-TR')} ${unit}`);

export function MeasurementsTab({ client, onClientChanged }: { client: Client; onClientChanged: (c: Client) => void }) {
  const { can } = usePanelAuth();
  const consent = !!client.healthConsentAt;
  const { data, error, loading, reload, setData } = useApi(
    () => api.get<{ items: Measurement[] }>(`/clients/${client.id}/measurements`),
    [client.id],
  );
  const [f, setF] = useState({ measuredOn: todayStr(), heightCm: '', weightKg: '', targetWeightKg: '', bodyFatPct: '', muscleKg: '', note: '', ...emptyCirc() });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);
  const { success, error: toastError, confirm } = useFeedback();

  const lastHeight = data?.items.find((m) => m.heightCm != null)?.heightCm;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setErrors({});
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
      setData((d) => ({ items: [res.measurement, ...(d?.items ?? [])].sort((a, b) => b.measuredOn.localeCompare(a.measuredOn)) }));
      setF((s) => ({ ...s, weightKg: '', bodyFatPct: '', muscleKg: '', note: '', ...emptyCirc() }));
      success('Ölçüm kaydedildi');
    } catch (err) {
      if (err instanceof ApiError) {
        setErrors(err.fields);
        if (!Object.keys(err.fields).length) toastError('Kaydedilemedi', err.message);
      }
    } finally {
      setPending(false);
    }
  }

  async function remove(m: Measurement) {
    if (!(await confirm({ title: 'Ölçüm silinsin mi?', description: `${formatDayStr(m.measuredOn)} tarihli ölçüm kalıcı olarak silinecek.`, confirmLabel: 'Sil', tone: 'danger' }))) return;
    try {
      await api.del(`/clients/${client.id}/measurements/${m.id}`);
      setData((d) => ({ items: (d?.items ?? []).filter((x) => x.id !== m.id) }));
      success('Ölçüm silindi');
    } catch (e) {
      toastError('Silinemedi', (e as Error).message);
    }
  }

  // Geçmiş tablosunda yalnızca en az bir kez girilmiş mezura ölçüleri sütun olarak gösterilir
  const usedCirc = CIRCUMFERENCES.filter(({ key }) => data?.items.some((m) => m[key] != null));

  const profile = { sex: client.sex, birthDate: client.birthDate };
  const comp = new Map(composeAll(data?.items ?? [], profile).map((c) => [c.id, c]));
  const showLean = [...comp.values()].some((c) => c.leanKg != null || c.muscleKg != null);
  const showFat = [...comp.values()].some((c) => c.fatPct != null);

  const history = loading ? (
    <Card><SkeletonRows rows={3} /></Card>
  ) : error ? (
    <Card><ErrorState message={error.message} onRetry={reload} /></Card>
  ) : !data?.items.length ? (
    consent ? <Card><EmptyState icon={<Ruler className="h-5 w-5" />} title="Henüz ölçüm kaydı yok." description="İlk ölçümü soldaki formdan ekleyebilirsiniz." /></Card> : null
  ) : (
    <>
      {data.items.filter((m) => m.weightKg != null).length >= 2 && (
        <Card className="p-5"><WeightTrend items={data.items} /></Card>
      )}
      <Card className="p-5">
        <h2 className="mb-4 text-[0.95rem] font-bold text-espresso">Vücut kompozisyonu</h2>
        <BodyComposition items={data.items} profile={profile} />
      </Card>
      <Card>
        <CardHeader title="Ölçüm geçmişi" description="Değerler şifreli saklanır." className="pb-3" />
        <ResponsiveTable
          rows={data.items}
          rowKey={(m) => m.id}
          columns={[
            { key: 'd', header: 'Tarih', cell: (m) => <span className="tabular font-semibold whitespace-nowrap text-espresso">{formatDayStr(m.measuredOn)}</span> },
            { key: 'w', header: 'Kilo', className: 'tabular', cell: (m) => fmt(m.weightKg, 'kg') },
            { key: 'h', header: 'Boy', className: 'tabular', cell: (m) => fmt(m.heightCm, 'cm') },
            { key: 't', header: 'Hedef', className: 'tabular', cell: (m) => fmt(m.targetWeightKg, 'kg') },
            ...usedCirc.map(({ key, label }) => ({ key, header: label, className: 'tabular whitespace-nowrap', cell: (m: Measurement) => fmt(m[key], 'cm') })),
            { key: 'b', header: 'BKİ', className: 'tabular', cell: (m) => { const b = comp.get(m.id)?.bmi; return b != null ? b.toLocaleString('tr-TR') : '—'; } },
            ...(showFat ? [{ key: 'fat', header: 'Yağ', className: 'tabular whitespace-nowrap', cell: (m: Measurement) => { const c = comp.get(m.id); return c?.fatPct != null ? `%${c.fatPct.toLocaleString('tr-TR')}${c.fatKg != null ? ` · ${c.fatKg.toLocaleString('tr-TR')} kg` : ''}` : '—'; } }] : []),
            ...(showLean ? [{ key: 'lean', header: 'Yağsız / kas', className: 'tabular whitespace-nowrap', cell: (m: Measurement) => { const c = comp.get(m.id); return c?.muscleKg != null ? `Kas ${fmt(c.muscleKg, 'kg')}` : fmt(c?.leanKg ?? null, 'kg'); } }] : []),
            { key: 'n', header: 'Not', cell: (m) => <span className="block max-w-[16rem] truncate text-panel-muted">{m.note ?? ''}</span> },
            ...(can('clinical:write') ? [{ key: 'x', header: <span className="sr-only">İşlemler</span>, className: 'text-right', cell: (m: Measurement) => <IconButton label="Ölçümü sil" onClick={() => void remove(m)}><Trash2 className="h-4 w-4" /></IconButton> }] : []),
          ]}
          mobileCard={(m) => (
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="tabular font-semibold text-espresso">{formatDayStr(m.measuredOn)}</p>
                <p className="tabular mt-0.5 text-sm text-cocoa">{fmt(m.weightKg, 'kg')} · {fmt(m.heightCm, 'cm')}{comp.get(m.id)?.bmi ? ` · BKİ ${comp.get(m.id)!.bmi!.toLocaleString('tr-TR')}` : ''}{comp.get(m.id)?.fatPct != null ? ` · Yağ %${comp.get(m.id)!.fatPct!.toLocaleString('tr-TR')}` : ''}</p>
                {CIRCUMFERENCES.some(({ key }) => m[key] != null) && (
                  <p className="tabular mt-0.5 text-[0.78rem] text-cocoa">
                    {CIRCUMFERENCES.filter(({ key }) => m[key] != null).map(({ key, label }) => `${label} ${m[key]!.toLocaleString('tr-TR')}`).join(' · ')} cm
                  </p>
                )}
                {m.note && <p className="mt-1 text-[0.78rem] text-panel-muted">{m.note}</p>}
              </div>
              {can('clinical:write') && <IconButton label="Ölçümü sil" onClick={() => void remove(m)}><Trash2 className="h-4 w-4" /></IconButton>}
            </div>
          )}
        />
      </Card>
    </>
  );

  return (
    <div className="space-y-6">
      {!consent && <ConsentGate client={client} onChanged={onClientChanged} what="beslenme takibi ölçümleri" />}
      <div className={consent ? 'grid gap-6 lg:grid-cols-[20rem_minmax(0,1fr)]' : 'space-y-6'}>
        {consent && can('clinical:write') && (
          <Card className="h-fit p-5">
            <h2 className="mb-4 text-[0.95rem] font-bold text-espresso">Yeni ölçüm</h2>
            <form onSubmit={submit} className="grid grid-cols-2 gap-3" noValidate>
              <Input wrapperClassName="col-span-2" label="Ölçüm tarihi" type="date" required max={todayStr()} value={f.measuredOn} onChange={(e) => setF({ ...f, measuredOn: e.target.value })} error={errors.measuredOn} />
              <Input label="Kilo (kg)" inputMode="decimal" value={f.weightKg} onChange={(e) => setF({ ...f, weightKg: e.target.value })} error={errors.weightKg} />
              <Input label="Boy (cm)" inputMode="decimal" placeholder={lastHeight ? String(lastHeight) : ''} value={f.heightCm} onChange={(e) => setF({ ...f, heightCm: e.target.value })} error={errors.heightCm} />
              <Input wrapperClassName="col-span-2" label="Hedef kilo (kg)" hint="İsteğe bağlı" inputMode="decimal" value={f.targetWeightKg} onChange={(e) => setF({ ...f, targetWeightKg: e.target.value })} error={errors.targetWeightKg} />
              <fieldset className="col-span-2 mt-1 grid grid-cols-2 gap-3 border-t border-espresso/10 pt-3">
                <legend className="col-span-2 mb-1 text-[0.82rem] font-bold text-espresso">Mezura ölçüleri (cm)</legend>
                {CIRCUMFERENCES.map(({ key, label }) => (
                  <Input key={key} label={label} inputMode="decimal" value={f[key]} onChange={(e) => setF({ ...f, [key]: e.target.value })} error={errors[key]} />
                ))}
              </fieldset>
              <fieldset className="col-span-2 mt-1 grid grid-cols-2 gap-3 border-t border-espresso/10 pt-3">
                <legend className="col-span-2 mb-1 text-[0.82rem] font-bold text-espresso">Vücut analizi cihazı <span className="font-medium text-panel-muted">(varsa)</span></legend>
                <Input label="Yağ oranı (%)" inputMode="decimal" value={f.bodyFatPct} onChange={(e) => setF({ ...f, bodyFatPct: e.target.value })} error={errors.bodyFatPct} />
                <Input label="Kas kütlesi (kg)" inputMode="decimal" value={f.muscleKg} onChange={(e) => setF({ ...f, muscleKg: e.target.value })} error={errors.muscleKg} />
              </fieldset>
              <Input wrapperClassName="col-span-2" label="Not" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} error={errors.note} maxLength={500} />
              <Button type="submit" className="col-span-2 mt-1" loading={pending}>Ölçümü kaydet</Button>
            </form>
          </Card>
        )}
        <div className="min-w-0 space-y-6">{history}</div>
      </div>
    </div>
  );
}
