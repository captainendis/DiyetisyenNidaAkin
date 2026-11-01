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
import type { Client, Measurement } from './types';

const num = (v: string) => (v.trim() === '' ? null : Number(v.replace(',', '.')));
const fmt = (v: number | null, unit: string) => (v == null ? '—' : `${v.toLocaleString('tr-TR')} ${unit}`);

export function MeasurementsTab({ client, onClientChanged }: { client: Client; onClientChanged: (c: Client) => void }) {
  const { can } = usePanelAuth();
  const consent = !!client.healthConsentAt;
  const { data, error, loading, reload, setData } = useApi(
    () => api.get<{ items: Measurement[] }>(`/clients/${client.id}/measurements`),
    [client.id],
  );
  const [f, setF] = useState({ measuredOn: todayStr(), heightCm: '', weightKg: '', targetWeightKg: '', note: '' });
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
        note: f.note || null,
      });
      setData((d) => ({ items: [res.measurement, ...(d?.items ?? [])].sort((a, b) => b.measuredOn.localeCompare(a.measuredOn)) }));
      setF((s) => ({ ...s, weightKg: '', note: '' }));
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
            { key: 'b', header: 'BKİ', className: 'tabular', cell: (m) => (m.bmi != null ? m.bmi.toLocaleString('tr-TR') : '—') },
            { key: 'n', header: 'Not', cell: (m) => <span className="block max-w-[16rem] truncate text-panel-muted">{m.note ?? ''}</span> },
            ...(can('clinical:write') ? [{ key: 'x', header: <span className="sr-only">İşlemler</span>, className: 'text-right', cell: (m: Measurement) => <IconButton label="Ölçümü sil" onClick={() => void remove(m)}><Trash2 className="h-4 w-4" /></IconButton> }] : []),
          ]}
          mobileCard={(m) => (
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="tabular font-semibold text-espresso">{formatDayStr(m.measuredOn)}</p>
                <p className="tabular mt-0.5 text-sm text-cocoa">{fmt(m.weightKg, 'kg')} · {fmt(m.heightCm, 'cm')}{m.bmi ? ` · BKİ ${m.bmi.toLocaleString('tr-TR')}` : ''}</p>
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
