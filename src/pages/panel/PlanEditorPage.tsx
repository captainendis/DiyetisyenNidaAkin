// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/** /panel/planlar/:id — plan düzenleyici + canlı A4 önizleme */
import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { ArrowLeft, BookmarkPlus, Download, Save, Trash2 } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { useApi } from '@/hooks/useApi';
import { RequirePermission, usePanelAuth } from '@/components/panel/PanelAuth';
import { Badge, Button, Card, ErrorState, Skeleton, Tabs, useFeedback } from '@/components/panel/ui';
import { PlanEditorForm } from '@/components/panel/plans/PlanEditorForm';
import { PlanPreview } from '@/components/panel/plans/PlanPreview';
import { downloadPlanPdf, type PlanDetail } from '@/components/panel/plans/api';
import { cn } from '@/lib/format';
import type { NutritionPlanData } from '@shared/plan';

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
/** Kaydetmeden önce boş satırları temizle */
const tidy = (d: NutritionPlanData): NutritionPlanData => ({
  ...d,
  meals: d.meals.map((m) => ({ ...m, options: m.options.map((o) => o.map((l) => l.trim()).filter(Boolean)) })),
  habits: { ...d.habits, items: d.habits.items.filter((h) => h.title.trim() || h.text.trim()) },
  portions: { ...d.portions, items: d.portions.items.filter((p) => p.name.trim() || p.amount.trim()) },
});

function Editor({ plan, onSaved }: { plan: PlanDetail; onSaved: (p: PlanDetail) => void }) {
  const [data, setData] = useState<NutritionPlanData>(() => clone(plan.data));
  const [name, setName] = useState(plan.name);
  const [saving, setSaving] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [fit, setFit] = useState<{ scale: number; fits: boolean } | null>(null);
  const [mobileView, setMobileView] = useState<'form' | 'preview'>('form');
  const { can } = usePanelAuth();
  const editable = can('clinical:write');
  const fb = useFeedback();
  const nav = useNavigate();

  const dirty = JSON.stringify(data) !== JSON.stringify(plan.data) || name !== plan.name;
  useEffect(() => {
    if (!dirty) return;
    const on = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', on);
    return () => window.removeEventListener('beforeunload', on);
  }, [dirty]);

  const set = useCallback((fn: (d: NutritionPlanData) => void) => setData((d) => { const n = clone(d); fn(n); return n; }), []);

  const save = async (silent = false) => {
    setSaving(true);
    try {
      const clean = tidy(data);
      await api.patch(`/plans/${plan.id}`, { name: name.trim() || plan.name, data: clean });
      onSaved({ ...plan, name: name.trim() || plan.name, data: clean });
      setData(clone(clean));
      if (!silent) fb.success('Plan kaydedildi');
      return true;
    } catch (e) {
      const first = e instanceof ApiError ? Object.values(e.fields)[0] : undefined;
      fb.error('Kaydedilemedi', first ?? (e instanceof ApiError ? e.message : undefined));
      return false;
    } finally {
      setSaving(false);
    }
  };

  const pdf = async () => {
    if (dirty && editable && !(await save(true))) return;
    setPdfBusy(true);
    try {
      const r = await downloadPlanPdf(plan.id);
      if (!r.fits) fb.toast({ tone: 'warning', title: 'Plan sayfaya tam sığmadı', description: 'Bazı satırları kısaltın veya bir seçeneği çıkarın.' });
      else fb.success('PDF indirildi');
    } catch (e) {
      fb.error('PDF oluşturulamadı', e instanceof ApiError ? e.message : undefined);
    } finally {
      setPdfBusy(false);
    }
  };

  const saveAsTemplate = async () => {
    try {
      const res = await api.post<{ plan: { id: string } }>('/plans', { isTemplate: true, name: `${name} (şablon)`, data: { ...tidy(data), title: 'Beslenme planı' } });
      fb.success('Şablon olarak kaydedildi', 'Şablonlar sekmesinde bulabilirsiniz.');
      void res;
    } catch (e) {
      fb.error('Şablon kaydedilemedi', e instanceof ApiError ? e.message : undefined);
    }
  };

  const remove = async () => {
    if (!(await fb.confirm({ title: 'Plan silinsin mi?', description: 'Bu işlem geri alınamaz.', confirmLabel: 'Sil', tone: 'danger' }))) return;
    try {
      await api.del(`/plans/${plan.id}`);
      fb.success('Plan silindi');
      nav(plan.clientId ? `/panel/danisanlar/${plan.clientId}?sekme=planlar` : '/panel/planlar?gorunum=sablonlar');
    } catch (e) {
      fb.error('Silinemedi', e instanceof ApiError ? e.message : undefined);
    }
  };

  const back = plan.clientId ? `/panel/danisanlar/${plan.clientId}?sekme=planlar` : '/panel/planlar?gorunum=sablonlar';

  return (
    <>
      <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <Link to={back} className="mb-2 inline-flex items-center gap-1.5 text-[0.8rem] font-semibold text-panel-muted hover:text-cocoa">
            <ArrowLeft className="h-4 w-4" /> {plan.client ? `${plan.client.firstName} ${plan.client.lastName}` : 'Şablonlar'}
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={!editable}
              aria-label="Plan adı"
              maxLength={80}
              className="min-w-0 rounded-md bg-transparent font-display text-[2rem] [font-variant-numeric:lining-nums] leading-tight font-medium text-espresso hover:bg-white/60 focus:bg-white focus:outline-none sm:text-[2.3rem]"
            />
            {plan.isTemplate && <Badge tone="accent">Şablon</Badge>}
            {dirty && <Badge tone="warning">Kaydedilmedi</Badge>}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {editable && <Button variant="ghost" icon={<Trash2 className="h-4 w-4" />} onClick={() => void remove()}>Sil</Button>}
          {editable && !plan.isTemplate && <Button variant="secondary" icon={<BookmarkPlus className="h-4 w-4" />} onClick={() => void saveAsTemplate()}>Şablon olarak kaydet</Button>}
          {editable && <Button variant="secondary" loading={saving} disabled={!dirty} icon={<Save className="h-4 w-4" />} onClick={() => void save()}>Kaydet</Button>}
          <Button variant="primary" loading={pdfBusy} icon={<Download className="h-4 w-4" />} onClick={() => void pdf()}>PDF indir</Button>
        </div>
      </div>

      <Tabs<'form' | 'preview'>
        className="mb-4 lg:hidden"
        value={mobileView}
        onChange={setMobileView}
        tabs={[{ value: 'form', label: 'Düzenle' }, { value: 'preview', label: 'Önizleme' }]}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)]">
        <Card className={cn(mobileView === 'preview' && 'hidden lg:block')}>
          <fieldset disabled={!editable}>
            <PlanEditorForm data={data} set={set} />
          </fieldset>
        </Card>
        <div className={cn('lg:sticky lg:top-24 lg:self-start', mobileView === 'form' && 'hidden lg:block')}>
          <PlanPreview data={data} onFit={setFit} />
          <p className={cn('mt-3 text-[0.8rem]', fit && !fit.fits ? 'font-semibold text-danger' : fit && fit.scale < 0.85 ? 'font-semibold text-[#93682a]' : 'text-panel-muted')} role="status">
            {!fit
              ? 'Önizleme hazırlanıyor…'
              : !fit.fits
                ? 'İçerik tek sayfaya sığmıyor — bazı satırları kısaltın ya da bir seçenek/öğün çıkarın.'
                : fit.scale < 0.85
                  ? `Tek sayfaya sığdı ama yazı %${Math.round(fit.scale * 100)} boyuta küçüldü — telefonda okunur, baskıda küçük kalabilir. Satırları kısaltmayı düşünün.`
                  : fit.scale < 1
                  ? `Tek sayfaya sığdı · yazı boyutu %${Math.round(fit.scale * 100)} olarak ayarlandı.`
                  : 'Tek sayfaya sığıyor · tam boyut.'}
          </p>
          <p className="mt-1 text-[0.75rem] text-panel-muted">PDF bu önizlemeyle aynıdır; metin vektördür, telefonda yakınlaştırınca netliğini korur.</p>
        </div>
      </div>
    </>
  );
}

function Body() {
  const { id } = useParams();
  const { data, loading, error, reload, setData } = useApi(() => api.get<{ plan: PlanDetail }>(`/plans/${id}`), [id]);
  if (loading && !data) {
    return (
      <div className="grid gap-6 lg:grid-cols-2">
        <Skeleton className="h-[70vh] rounded-xl" />
        <Skeleton className="h-[70vh] rounded-xl" />
      </div>
    );
  }
  if (error || !data) return <ErrorState message={error?.message} onRetry={reload} />;
  return <Editor key={data.plan.id} plan={data.plan} onSaved={(p) => setData({ plan: p })} />;
}

export default function PlanEditorPage() {
  return (
    <RequirePermission perm="clinical:read">
      <Body />
    </RequirePermission>
  );
}
