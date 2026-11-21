// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

import { WebView } from 'react-native-webview';
import { View } from 'react-native';
import { Badge, Notice, T, TextField } from '@/components/ui';
import { colors, space } from '@/theme';
import { FormSection, nullIfEmpty as n } from './FormBits';
import { useSettingField } from './settingsStore';

const CONTACT_LABELS: Record<string, string> = {
  phone: 'Telefon',
  whatsapp: 'WhatsApp',
  email: 'E-posta',
  addressLine: 'Adres',
  district: 'İlçe',
  city: 'Şehir',
  postalCode: 'Posta kodu',
  venueName: 'Mekân adı',
  venueNote: 'Mekân notu',
  mapEmbedUrl: 'Harita',
  mapLinkUrl: 'Yol tarifi bağlantısı',
  hoursNote: 'Çalışma saatleri notu',
};

const isEmbed = (v: string | null) => !!v && (v.startsWith('https://www.google.com/maps/embed') || (v.startsWith('https://www.google.com/maps?') && v.includes('output=embed')));

export function ContactForm() {
  const { d, set, err } = useSettingField('contact');
  const missing = Object.entries(d).filter(([, v]) => v === null).map(([k]) => CONTACT_LABELS[k] ?? k);
  return (
    <>
      <View style={{ marginBottom: space.lg }}>
        {missing.length ? (
          <Notice
            tone="warning"
            title={`Eksik bilgiler: ${missing.join(', ')}`}
            text="Boş alanlar web sitesinde “yakında eklenecek” olarak gösterilir ve arama motorlarına gönderilen yapılandırılmış verilere (Schema.org) eklenmez. Yalnızca doğrulanmış bilgileri girin."
          />
        ) : (
          <Notice tone="success" text="Tüm iletişim alanları dolu." />
        )}
      </View>
      <FormSection title="Telefon ve e-posta" description="Web sitesinin iletişim sayfasında ve alt bilgide gösterilir.">
        <TextField label="Telefon" keyboardType="phone-pad" placeholder="+90 5xx xxx xx xx" value={d.phone ?? ''} error={err('phone')} onChange={(v) => set('phone', n(v))} />
        <TextField
          label="WhatsApp numarası"
          keyboardType="number-pad"
          placeholder="905xxxxxxxxx"
          help="Yalnızca rakam, ülke koduyla. Boşsa sitede WhatsApp bağlantıları gizlenir."
          value={d.whatsapp ?? ''}
          error={err('whatsapp')}
          onChange={(v) => set('whatsapp', n(v.replace(/\D/g, '')))}
        />
        <TextField label="E-posta" keyboardType="email-address" autoCapitalize="none" autoCorrect={false} placeholder="ornek@alanadi.com" value={d.email ?? ''} error={err('email')} onChange={(v) => set('email', n(v))} />
        <TextField label="Çalışma saatleri notu" placeholder="Ör. Hafta içi 10.00 – 19.00" help="Ziyaretçiye gösterilen metin. Randevu saatleri ise Çalışma Takvimi'nden yönetilir." value={d.hoursNote ?? ''} maxLength={160} error={err('hoursNote')} onChange={(v) => set('hoursNote', n(v))} />
      </FormSection>
      <FormSection title="Mekân ve adres" description="Danışmanlığın verildiği mekân ve açık adresi.">
        <TextField label="Mekân adı" placeholder="Ör. stüdyo / merkez adı" value={d.venueName ?? ''} maxLength={120} error={err('venueName')} onChange={(v) => set('venueName', n(v))} />
        <TextField label="Mekân notu" rows={2} placeholder="Ör. giriş, kat veya bulma tarifi" help="İletişim sayfasında adresin altında gösterilir." value={d.venueNote ?? ''} maxLength={240} error={err('venueNote')} onChange={(v) => set('venueNote', n(v))} />
        <TextField label="Açık adres" placeholder="Mahalle, cadde/sokak, bina no" value={d.addressLine ?? ''} maxLength={240} error={err('addressLine')} onChange={(v) => set('addressLine', n(v))} />
        <TextField label="İlçe" value={d.district ?? ''} maxLength={80} error={err('district')} onChange={(v) => set('district', n(v))} />
        <TextField label="Şehir" value={d.city ?? ''} maxLength={80} error={err('city')} onChange={(v) => set('city', n(v))} />
        <TextField label="Posta kodu" keyboardType="number-pad" value={d.postalCode ?? ''} maxLength={10} error={err('postalCode')} onChange={(v) => set('postalCode', n(v))} />
      </FormSection>
      <FormSection title="Harita" description="Google Haritalar’da mekânı bulun → Paylaş → Harita yerleştir → HTML kodundaki src=&quot;…&quot; bağlantısını yapıştırın (…/maps/embed?… veya …&output=embed).">
        <TextField label="Harita yerleştirme bağlantısı" autoCapitalize="none" autoCorrect={false} keyboardType="url" placeholder="https://www.google.com/maps/embed?pb=…" value={d.mapEmbedUrl ?? ''} error={err('mapEmbedUrl')} onChange={(v) => set('mapEmbedUrl', n(v))} />
        <TextField label="Yol tarifi bağlantısı" autoCapitalize="none" autoCorrect={false} keyboardType="url" placeholder="https://maps.app.goo.gl/…" value={d.mapLinkUrl ?? ''} error={err('mapLinkUrl')} onChange={(v) => set('mapLinkUrl', n(v))} />
        {isEmbed(d.mapEmbedUrl) ? (
          <View style={{ height: 220, borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: colors.line }} accessibilityLabel="Harita önizlemesi">
            <WebView source={{ uri: d.mapEmbedUrl! }} originWhitelist={['https://*']} setSupportMultipleWindows={false} style={{ flex: 1 }} />
          </View>
        ) : null}
      </FormSection>
    </>
  );
}

const SOCIAL = [
  { key: 'instagram', label: 'Instagram', ph: 'https://www.instagram.com/kullaniciadi' },
  { key: 'youtube', label: 'YouTube', ph: 'https://www.youtube.com/@kanal' },
  { key: 'x', label: 'X (Twitter)', ph: 'https://x.com/kullaniciadi' },
  { key: 'linkedin', label: 'LinkedIn', ph: 'https://www.linkedin.com/in/…' },
] as const;

export function SocialForm() {
  const { d, set, err } = useSettingField('social');
  return (
    <FormSection title="Sosyal medya" description="Yalnızca size ait, doğrulanmış hesapları ekleyin. Boş bırakılan hesaplar sitede gösterilmez.">
      {SOCIAL.map((x) => (
        <View key={x.key} style={{ gap: 6 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
            <T variant="label">{x.label}</T>
            {d[x.key] ? <Badge label="Aktif" tone="success" /> : <Badge label="Gizli" />}
          </View>
          <TextField
            accessibilityLabel={x.label}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            placeholder={x.ph}
            value={d[x.key] ?? ''}
            error={err(x.key)}
            onChange={(v) => set(x.key, n(v))}
          />
        </View>
      ))}
    </FormSection>
  );
}
