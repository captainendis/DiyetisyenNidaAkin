// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

import { View } from 'react-native';
import { T, TextField } from '@/components/ui';
import { SITE_URL } from '@/lib/config';
import { colors, radius, space } from '@/theme';
import { charCount, FormSection } from './FormBits';
import { useSettingField } from './settingsStore';

/** Google arama sonucu önizlemesi (yaklaşık) */
export function SnippetPreview({ title, description, path }: { title: string; description: string; path: string }) {
  const host = SITE_URL.replace(/^https?:\/\//, '');
  const t = title.length > 62 ? `${title.slice(0, 60)}…` : title;
  const desc = description.length > 160 ? `${description.slice(0, 158)}…` : description;
  return (
    <View style={{ borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, padding: space.md, gap: 2, backgroundColor: colors.surface }} accessibilityLabel="Arama sonucu önizlemesi">
      <T variant="overline" color={colors.muted} style={{ marginBottom: 6 }}>Arama sonucu önizlemesi</T>
      <T style={{ fontSize: 12, color: '#4d5156' }} numberOfLines={1}>
        {host}
        {path !== '/' ? ` › ${path.replace(/^\//, '').split('/').join(' › ')}` : ''}
      </T>
      <T style={{ fontSize: 17, lineHeight: 22, color: '#1a0dab' }} numberOfLines={1}>{t || 'Başlık'}</T>
      <T style={{ fontSize: 13, lineHeight: 19, color: '#4d5156' }} numberOfLines={2}>{desc || 'Açıklama girilmedi — arama motoru sayfadan bir metin seçecektir.'}</T>
    </View>
  );
}

export function SeoForm() {
  const { d, set, err } = useSettingField('seo');
  return (
    <FormSection
      title="Arama motoru görünümü"
      description="Google’da ve sosyal medya paylaşımlarında sitenizin nasıl görüneceği. Her sayfanın kendi başlığı vardır; buradaki değerler ana sayfa ve varsayılanlar içindir."
    >
      <TextField label="Varsayılan başlık" help={charCount(d.defaultTitle, 70)} value={d.defaultTitle} maxLength={70} error={err('defaultTitle')} onChange={(v) => set('defaultTitle', v)} />
      <TextField label="Sayfa başlığı eki" help="Alt sayfa başlıklarının sonuna eklenir (ör. “Hizmetler | Nida Akın Diyetisyen”)" value={d.titleSuffix} maxLength={40} error={err('titleSuffix')} onChange={(v) => set('titleSuffix', v)} />
      <TextField label="Varsayılan açıklama" rows={3} help={charCount(d.defaultDescription, 170)} value={d.defaultDescription} maxLength={170} error={err('defaultDescription')} onChange={(v) => set('defaultDescription', v)} />
      <SnippetPreview title={d.defaultTitle} description={d.defaultDescription} path="/" />
    </FormSection>
  );
}
