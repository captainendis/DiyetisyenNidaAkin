import { Input, Textarea } from '@/components/panel/ui';
import { CharCount, FormCard, FormSection, Notice, SaveBar } from './FormBits';
import { Repeater } from './Repeater';
import { useSettingForm } from './settingsStore';

export function AboutForm() {
  const f = useSettingForm('about');
  if (!f.draft) return null;
  const d = f.draft;
  return (
    <FormCard>
      <FormSection title="Giriş" description="Hakkımda sayfasının ve ana sayfadaki tanıtım bölümünün başlığı.">
        <Input label="Üst etiket" value={d.eyebrow} maxLength={60} error={f.errors.eyebrow} onChange={(e) => f.set('eyebrow', e.target.value)} />
        <Textarea label="Başlık" rows={2} value={d.heading} maxLength={160} error={f.errors.heading} onChange={(e) => f.set('heading', e.target.value)} />
        <Textarea label="Giriş paragrafı" rows={4} value={d.lead} maxLength={500} error={f.errors.lead} hint={<CharCount value={d.lead} max={500} />} onChange={(e) => f.set('lead', e.target.value)} />
      </FormSection>
      <FormSection title="Metin" description="Mesleki yaklaşımınızı, danışanlarınıza yaklaşımınızı ve beslenme felsefenizi anlatan paragraflar.">
        <Repeater
          items={d.paragraphs}
          max={6}
          onChange={(v) => f.set('paragraphs', v)}
          create={() => ''}
          addLabel="Paragraf ekle"
          itemLabel={(i) => `Paragraf ${i + 1}`}
          render={(p, i, upd) => <Textarea aria-label={`Paragraf ${i + 1}`} rows={4} value={p} maxLength={1200} error={f.errors[`paragraphs.${i}`]} onChange={(e) => upd(e.target.value)} />}
        />
      </FormSection>
      <FormSection title="Yaklaşım ilkeleri" description="Kısa başlık + açıklama; en fazla 6.">
        <Repeater
          items={d.pillars}
          max={6}
          onChange={(v) => f.set('pillars', v)}
          create={() => ({ title: '', body: '' })}
          addLabel="İlke ekle"
          itemLabel={(i) => `İlke ${i + 1}`}
          render={(p, i, upd) => (
            <>
              <Input label="Başlık" value={p.title} maxLength={60} error={f.errors[`pillars.${i}.title`]} onChange={(e) => upd({ ...p, title: e.target.value })} />
              <Textarea label="Açıklama" rows={2} value={p.body} maxLength={300} error={f.errors[`pillars.${i}.body`]} onChange={(e) => upd({ ...p, body: e.target.value })} />
            </>
          )}
        />
      </FormSection>
      <FormSection
        title="Eğitim ve belgeler"
        description="Yalnızca doğrulanmış bilgileri ekleyin. Liste boşsa web sitesinde bu alan hiç gösterilmez."
      >
        <Repeater
          items={d.credentials}
          max={10}
          onChange={(v) => f.set('credentials', v)}
          create={() => ({ label: '', value: '' })}
          addLabel="Bilgi ekle"
          itemLabel={(i) => `Kayıt ${i + 1}`}
          empty={<Notice>Doğrulanmış eğitim/sertifika bilgilerini ekleyin. Örnek yapı: “Lisans” — “Üniversite adı, bölüm, yıl”.</Notice>}
          render={(c, i, upd) => (
            <div className="grid gap-3 sm:grid-cols-[minmax(0,12rem)_1fr]">
              <Input label="Başlık" placeholder="Lisans, Sertifika…" value={c.label} maxLength={80} error={f.errors[`credentials.${i}.label`]} onChange={(e) => upd({ ...c, label: e.target.value })} />
              <Input label="Bilgi" placeholder="Kurum, program, yıl" value={c.value} maxLength={200} error={f.errors[`credentials.${i}.value`]} onChange={(e) => upd({ ...c, value: e.target.value })} />
            </div>
          )}
        />
      </FormSection>
      <SaveBar dirty={f.dirty} saving={f.saving} onSave={() => void f.save()} onReset={f.reset} viewHref="/hakkimda" />
    </FormCard>
  );
}
