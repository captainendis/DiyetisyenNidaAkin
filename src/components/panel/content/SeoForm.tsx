import { Input, Textarea } from '@/components/panel/ui';
import { CharCount, FormCard, FormSection, SaveBar } from './FormBits';
import { useSettingForm } from './settingsStore';
import { SnippetPreview } from './SnippetPreview';

export function SeoForm() {
  const f = useSettingForm('seo', { successMessage: 'SEO ayarları kaydedildi' });
  if (!f.draft) return null;
  const d = f.draft;
  return (
    <FormCard>
      <FormSection title="Arama motoru görünümü" description="Google’da ve sosyal medya paylaşımlarında sitenizin nasıl görüneceği. Her sayfanın kendi başlığı vardır; buradaki değerler ana sayfa ve varsayılanlar içindir.">
        <Input label="Varsayılan başlık" hint={<CharCount value={d.defaultTitle} max={70} />} value={d.defaultTitle} maxLength={70} error={f.errors.defaultTitle} onChange={(e) => f.set('defaultTitle', e.target.value)} />
        <Input label="Sayfa başlığı eki" hint="Alt sayfa başlıklarının sonuna eklenir (ör. “Hizmetler | Nida Akın Diyetisyen”)" value={d.titleSuffix} maxLength={40} error={f.errors.titleSuffix} onChange={(e) => f.set('titleSuffix', e.target.value)} />
        <Textarea label="Varsayılan açıklama" rows={3} hint={<CharCount value={d.defaultDescription} max={170} />} value={d.defaultDescription} maxLength={170} error={f.errors.defaultDescription} onChange={(e) => f.set('defaultDescription', e.target.value)} />
        <SnippetPreview title={d.defaultTitle} description={d.defaultDescription} path="/" />
      </FormSection>
      <SaveBar dirty={f.dirty} saving={f.saving} onSave={() => void f.save()} onReset={f.reset} />
    </FormCard>
  );
}
