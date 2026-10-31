/** Ana sayfa içerik formları: Hero, Tanıtım, Yaklaşım, Süreç, Randevu çağrısı */
import { Input, Textarea } from '@/components/panel/ui';
import { CharCount, FormCard, FormSection, SaveBar } from './FormBits';
import { Repeater } from './Repeater';
import { useSettingForm } from './settingsStore';

export function HeroForm() {
  const f = useSettingForm('hero');
  if (!f.draft) return null;
  const d = f.draft;
  return (
    <FormCard>
      <FormSection title="Karşılama alanı (Hero)" description="Ziyaretçinin siteye girdiğinde ilk gördüğü başlık ve açıklama. Kısa ve net tutun.">
        <Input label="Üst satır" hint="Başlığın üzerindeki küçük, büyük harfli metin" value={d.eyebrow} maxLength={80} error={f.errors.eyebrow} onChange={(e) => f.set('eyebrow', e.target.value)} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Başlık — 1. satır" value={d.titleLine1} maxLength={40} error={f.errors.titleLine1} onChange={(e) => f.set('titleLine1', e.target.value)} />
          <Input label="Başlık — 2. satır" hint="Pudra renginde vurgulanır" value={d.titleLine2} maxLength={40} error={f.errors.titleLine2} onChange={(e) => f.set('titleLine2', e.target.value)} />
        </div>
        <Textarea
          label="Açıklama"
          rows={3}
          value={d.description}
          maxLength={240}
          error={f.errors.description}
          hint={<CharCount value={d.description} max={240} />}
          onChange={(e) => f.set('description', e.target.value)}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Ana buton" hint="Randevu formunu açar" value={d.primaryCta} maxLength={30} error={f.errors.primaryCta} onChange={(e) => f.set('primaryCta', e.target.value)} />
          <Input label="İkincil bağlantı" hint="Hakkımda bölümüne götürür" value={d.secondaryCta} maxLength={30} error={f.errors.secondaryCta} onChange={(e) => f.set('secondaryCta', e.target.value)} />
        </div>
      </FormSection>
      <FormSection title="Öne çıkan üç özellik" description="Karşılama alanının altında simgelerle birlikte gösterilir.">
        <div className="grid gap-4 sm:grid-cols-3">
          {d.features.map((v, i) => (
            <Input
              key={i}
              label={`Özellik ${i + 1}`}
              value={v}
              maxLength={60}
              error={f.errors[`features.${i}`]}
              onChange={(e) => f.update((x) => void (x.features[i] = e.target.value))}
            />
          ))}
        </div>
      </FormSection>
      <SaveBar dirty={f.dirty} saving={f.saving} onSave={() => void f.save()} onReset={f.reset} viewHref="/" />
    </FormCard>
  );
}

export function IntroForm() {
  const f = useSettingForm('intro');
  if (!f.draft) return null;
  const d = f.draft;
  return (
    <FormCard>
      <FormSection title="Tanıtım bölümü" description="Karşılama alanından hemen sonra, açık zeminli bölüm. Yaklaşımınızı birkaç cümleyle anlatın.">
        <Textarea label="Başlık" rows={2} value={d.heading} maxLength={160} error={f.errors.heading} onChange={(e) => f.set('heading', e.target.value)} />
        <Textarea label="Metin" rows={5} value={d.body} maxLength={900} error={f.errors.body} hint={<CharCount value={d.body} max={900} />} onChange={(e) => f.set('body', e.target.value)} />
        <Input label="Vurgu cümlesi" hint="Metnin yanında, italik ve büyük yazılır" value={d.aside} maxLength={240} error={f.errors.aside} onChange={(e) => f.set('aside', e.target.value)} />
      </FormSection>
      <SaveBar dirty={f.dirty} saving={f.saving} onSave={() => void f.save()} onReset={f.reset} viewHref="/" />
    </FormCard>
  );
}

export function ApproachForm() {
  const f = useSettingForm('approach');
  if (!f.draft) return null;
  const d = f.draft;
  return (
    <FormCard>
      <FormSection title="Beslenme yaklaşımı" description="Markanızı farklı kılan yaklaşım. Üç ana ilke ile anlatılır.">
        <Input label="Başlık" value={d.heading} maxLength={120} error={f.errors.heading} onChange={(e) => f.set('heading', e.target.value)} />
        <Textarea label="Alt metin" rows={2} value={d.subheading} maxLength={240} error={f.errors.subheading} onChange={(e) => f.set('subheading', e.target.value)} />
      </FormSection>
      <FormSection title="Üç ilke" description="Her ilke için kısa bir başlık ve bir-iki cümlelik açıklama.">
        {d.pillars.map((p, i) => (
          <div key={i} className="grid gap-3 rounded-lg border border-panel-line bg-panel-bg/40 p-4 sm:grid-cols-[minmax(0,14rem)_1fr]">
            <Input label={`İlke ${i + 1}`} value={p.title} maxLength={60} error={f.errors[`pillars.${i}.title`]} onChange={(e) => f.update((x) => void (x.pillars[i].title = e.target.value))} />
            <Textarea label="Açıklama" rows={2} value={p.body} maxLength={300} error={f.errors[`pillars.${i}.body`]} onChange={(e) => f.update((x) => void (x.pillars[i].body = e.target.value))} />
          </div>
        ))}
      </FormSection>
      <SaveBar dirty={f.dirty} saving={f.saving} onSave={() => void f.save()} onReset={f.reset} viewHref="/" />
    </FormCard>
  );
}

export function ProcessForm() {
  const f = useSettingForm('process');
  if (!f.draft) return null;
  const d = f.draft;
  return (
    <FormCard>
      <FormSection title="Süreç nasıl işliyor?" description="Danışan yolculuğunun adımları. Numaralar otomatik verilir (en az 2, en fazla 6 adım).">
        <Input label="Başlık" value={d.heading} maxLength={120} error={f.errors.heading} onChange={(e) => f.set('heading', e.target.value)} />
        <Textarea label="Giriş metni" rows={2} value={d.intro} maxLength={300} error={f.errors.intro} onChange={(e) => f.set('intro', e.target.value)} />
        <Repeater
          items={d.steps}
          min={2}
          max={6}
          onChange={(steps) => f.set('steps', steps)}
          create={() => ({ title: '', body: '' })}
          addLabel="Adım ekle"
          itemLabel={(i) => `${String(i + 1).padStart(2, '0')} — Adım`}
          render={(s, i, upd) => (
            <div className="grid gap-3 sm:grid-cols-[minmax(0,12rem)_1fr]">
              <Input label="Başlık" value={s.title} maxLength={40} error={f.errors[`steps.${i}.title`]} onChange={(e) => upd({ ...s, title: e.target.value })} />
              <Input label="Açıklama" value={s.body} maxLength={240} error={f.errors[`steps.${i}.body`]} onChange={(e) => upd({ ...s, body: e.target.value })} />
            </div>
          )}
        />
      </FormSection>
      <SaveBar dirty={f.dirty} saving={f.saving} onSave={() => void f.save()} onReset={f.reset} viewHref="/" />
    </FormCard>
  );
}

export function CtaForm() {
  const f = useSettingForm('cta');
  if (!f.draft) return null;
  const d = f.draft;
  return (
    <FormCard>
      <FormSection title="Randevu çağrısı" description="Sayfanın altındaki koyu zeminli, ziyaretçiyi randevuya davet eden bölüm.">
        <Textarea label="Başlık" rows={2} value={d.heading} maxLength={160} error={f.errors.heading} onChange={(e) => f.set('heading', e.target.value)} />
        <Input label="Açıklama" value={d.body} maxLength={240} error={f.errors.body} onChange={(e) => f.set('body', e.target.value)} />
        <Input label="Buton metni" value={d.button} maxLength={30} error={f.errors.button} onChange={(e) => f.set('button', e.target.value)} />
      </FormSection>
      <SaveBar dirty={f.dirty} saving={f.saving} onSave={() => void f.save()} onReset={f.reset} viewHref="/" />
    </FormCard>
  );
}
