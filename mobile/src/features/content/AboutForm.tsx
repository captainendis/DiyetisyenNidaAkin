// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

import { Notice, TextField } from '@/components/ui';
import { charCount, FormSection, Repeater } from './FormBits';
import { useSettingField } from './settingsStore';

export function AboutForm() {
  const { d, set, err } = useSettingField('about');
  return (
    <>
      <FormSection title="Giriş" description="Hakkımda sayfasının ve ana sayfadaki tanıtım bölümünün başlığı.">
        <TextField label="Üst etiket" value={d.eyebrow} maxLength={60} error={err('eyebrow')} onChange={(v) => set('eyebrow', v)} />
        <TextField label="Başlık" rows={2} value={d.heading} maxLength={160} error={err('heading')} onChange={(v) => set('heading', v)} />
        <TextField label="Giriş paragrafı" rows={4} value={d.lead} maxLength={500} error={err('lead')} help={charCount(d.lead, 500)} onChange={(v) => set('lead', v)} />
      </FormSection>
      <FormSection title="Metin" description="Mesleki yaklaşımınızı, danışanlarınıza yaklaşımınızı ve beslenme felsefenizi anlatan paragraflar.">
        <Repeater
          items={d.paragraphs}
          max={6}
          onChange={(v) => set('paragraphs', v)}
          create={() => ''}
          addLabel="Paragraf ekle"
          itemLabel={(i) => `Paragraf ${i + 1}`}
          render={(p, i, upd) => (
            <TextField accessibilityLabel={`Paragraf ${i + 1}`} rows={5} value={p} maxLength={1200} error={err(`paragraphs.${i}`)} help={charCount(p, 1200)} onChange={upd} />
          )}
        />
      </FormSection>
      <FormSection title="Yaklaşım ilkeleri" description="Kısa başlık + açıklama; en fazla 6.">
        <Repeater
          items={d.pillars}
          max={6}
          onChange={(v) => set('pillars', v)}
          create={() => ({ title: '', body: '' })}
          addLabel="İlke ekle"
          itemLabel={(i) => `İlke ${i + 1}`}
          render={(p, i, upd) => (
            <>
              <TextField label="Başlık" value={p.title} maxLength={60} error={err(`pillars.${i}.title`)} onChange={(v) => upd({ ...p, title: v })} />
              <TextField label="Açıklama" rows={3} value={p.body} maxLength={300} error={err(`pillars.${i}.body`)} onChange={(v) => upd({ ...p, body: v })} />
            </>
          )}
        />
      </FormSection>
      <FormSection title="Eğitim ve belgeler" description="Yalnızca doğrulanmış bilgileri ekleyin. Liste boşsa web sitesinde bu alan hiç gösterilmez.">
        <Repeater
          items={d.credentials}
          max={10}
          onChange={(v) => set('credentials', v)}
          create={() => ({ label: '', value: '' })}
          addLabel="Bilgi ekle"
          itemLabel={(i) => `Kayıt ${i + 1}`}
          empty={<Notice text="Doğrulanmış eğitim/sertifika bilgilerini ekleyin. Örnek yapı: “Lisans” ve altında “Üniversite adı, bölüm, yıl”." />}
          render={(c, i, upd) => (
            <>
              <TextField label="Başlık" placeholder="Lisans, Sertifika…" value={c.label} maxLength={80} error={err(`credentials.${i}.label`)} onChange={(v) => upd({ ...c, label: v })} />
              <TextField label="Bilgi" placeholder="Kurum, program, yıl" value={c.value} maxLength={200} error={err(`credentials.${i}.value`)} onChange={(v) => upd({ ...c, value: v })} />
            </>
          )}
        />
      </FormSection>
    </>
  );
}
