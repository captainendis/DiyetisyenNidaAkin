import { Input } from '@/components/panel/ui';
import { Badge } from '@/components/panel/ui';
import { FormCard, FormSection, Notice, SaveBar } from './FormBits';
import { useSettingForm } from './settingsStore';

const n = (v: string) => (v.trim() === '' ? null : v);

const CONTACT_LABELS: Record<string, string> = {
  phone: 'Telefon', whatsapp: 'WhatsApp', email: 'E-posta', addressLine: 'Adres', district: 'İlçe', city: 'Şehir',
  postalCode: 'Posta kodu', venueName: 'Mekân adı', venueNote: 'Mekân notu', mapEmbedUrl: 'Harita', mapLinkUrl: 'Yol tarifi bağlantısı', hoursNote: 'Çalışma saatleri notu',
};

export function ContactForm() {
  const f = useSettingForm('contact', { successMessage: 'İletişim bilgileri kaydedildi' });
  if (!f.draft) return null;
  const d = f.draft;
  const missing = Object.entries(d).filter(([, v]) => v === null).map(([k]) => CONTACT_LABELS[k] ?? k);
  return (
    <FormCard>
      <div className="px-5 pt-5 sm:px-6">
        {missing.length > 0 ? (
          <Notice tone="warning">
            <p className="font-semibold">Eksik bilgiler: {missing.join(', ')}</p>
            <p className="mt-1">
              Boş alanlar web sitesinde “yakında eklenecek” olarak gösterilir ve arama motorlarına gönderilen yapılandırılmış verilere (Schema.org) <strong>eklenmez</strong>.
              Yalnızca doğrulanmış bilgileri girin.
            </p>
          </Notice>
        ) : (
          <Notice>Tüm iletişim alanları dolu.</Notice>
        )}
      </div>
      <FormSection title="Telefon ve e-posta" description="Web sitesinin iletişim sayfasında ve alt bilgide gösterilir.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Telefon" type="tel" placeholder="+90 5xx xxx xx xx" value={d.phone ?? ''} error={f.errors.phone} onChange={(e) => f.set('phone', n(e.target.value))} />
          <Input
            label="WhatsApp numarası"
            inputMode="numeric"
            placeholder="905xxxxxxxxx"
            hint="Yalnızca rakam, ülke koduyla. Boşsa sitede WhatsApp bağlantıları gizlenir."
            value={d.whatsapp ?? ''}
            error={f.errors.whatsapp}
            onChange={(e) => f.set('whatsapp', n(e.target.value.replace(/\D/g, '')))}
          />
        </div>
        <Input label="E-posta" type="email" placeholder="ornek@alanadi.com" value={d.email ?? ''} error={f.errors.email} onChange={(e) => f.set('email', n(e.target.value))} />
        <Input label="Çalışma saatleri notu" placeholder="Ör. Hafta içi 10.00 – 19.00" hint="Ziyaretçiye gösterilen metin. Randevu saatleri ise Çalışma Takvimi'nden yönetilir." value={d.hoursNote ?? ''} error={f.errors.hoursNote} onChange={(e) => f.set('hoursNote', n(e.target.value))} />
      </FormSection>
      <FormSection title="Mekân ve adres" description="Danışmanlığın verildiği mekân ve açık adresi.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Mekân adı" placeholder="Ör. stüdyo / merkez adı" value={d.venueName ?? ''} maxLength={120} error={f.errors.venueName} onChange={(e) => f.set('venueName', n(e.target.value))} />
          <Input label="Mekân notu" placeholder="Ör. giriş, kat veya bulma tarifi" hint="İletişim sayfasında adresin altında gösterilir." value={d.venueNote ?? ''} maxLength={240} error={f.errors.venueNote} onChange={(e) => f.set('venueNote', n(e.target.value))} />
        </div>
        <Input label="Açık adres" placeholder="Mahalle, cadde/sokak, bina no" value={d.addressLine ?? ''} error={f.errors.addressLine} onChange={(e) => f.set('addressLine', n(e.target.value))} />
        <div className="grid gap-4 sm:grid-cols-3">
          <Input label="İlçe" value={d.district ?? ''} error={f.errors.district} onChange={(e) => f.set('district', n(e.target.value))} />
          <Input label="Şehir" value={d.city ?? ''} error={f.errors.city} onChange={(e) => f.set('city', n(e.target.value))} />
          <Input label="Posta kodu" inputMode="numeric" value={d.postalCode ?? ''} error={f.errors.postalCode} onChange={(e) => f.set('postalCode', n(e.target.value))} />
        </div>
      </FormSection>
      <FormSection
        title="Harita"
        description={
          <>
            Google Haritalar’da mekânı bulun → <em>Paylaş</em> → <em>Harita yerleştir</em> → HTML kodundaki <code>src="…"</code> bağlantısını yapıştırın (…/maps/embed?… veya …&amp;output=embed).
          </>
        }
      >
        <Input label="Harita yerleştirme bağlantısı" placeholder="https://www.google.com/maps/embed?pb=…" value={d.mapEmbedUrl ?? ''} error={f.errors.mapEmbedUrl} onChange={(e) => f.set('mapEmbedUrl', n(e.target.value))} />
        <Input label="Yol tarifi bağlantısı" placeholder="https://maps.app.goo.gl/…" value={d.mapLinkUrl ?? ''} error={f.errors.mapLinkUrl} onChange={(e) => f.set('mapLinkUrl', n(e.target.value))} />
        {d.mapEmbedUrl && (d.mapEmbedUrl.startsWith('https://www.google.com/maps/embed') || (d.mapEmbedUrl.startsWith('https://www.google.com/maps?') && d.mapEmbedUrl.includes('output=embed'))) && (
          <iframe title="Harita önizleme" src={d.mapEmbedUrl} className="h-56 w-full rounded-lg border border-panel-line" loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
        )}
      </FormSection>
      <SaveBar dirty={f.dirty} saving={f.saving} onSave={() => void f.save()} onReset={f.reset} viewHref="/iletisim" />
    </FormCard>
  );
}

export function SocialForm() {
  const f = useSettingForm('social', { successMessage: 'Sosyal medya bağlantıları kaydedildi' });
  if (!f.draft) return null;
  const d = f.draft;
  const fields = [
    { key: 'instagram', label: 'Instagram', ph: 'https://www.instagram.com/kullaniciadi' },
    { key: 'youtube', label: 'YouTube', ph: 'https://www.youtube.com/@kanal' },
    { key: 'x', label: 'X (Twitter)', ph: 'https://x.com/kullaniciadi' },
    { key: 'linkedin', label: 'LinkedIn', ph: 'https://www.linkedin.com/in/…' },
  ] as const;
  return (
    <FormCard>
      <FormSection title="Sosyal medya" description="Yalnızca size ait, doğrulanmış hesapları ekleyin. Boş bırakılan hesaplar sitede gösterilmez.">
        {fields.map((x) => (
          <Input
            key={x.key}
            label={
              <span className="inline-flex items-center gap-2">
                {x.label} {d[x.key] ? <Badge tone="success">Aktif</Badge> : <Badge>Gizli</Badge>}
              </span>
            }
            type="url"
            placeholder={x.ph}
            value={d[x.key] ?? ''}
            error={f.errors[x.key]}
            onChange={(e) => f.set(x.key, n(e.target.value))}
          />
        ))}
      </FormSection>
      <SaveBar dirty={f.dirty} saving={f.saving} onSave={() => void f.save()} onReset={f.reset} viewHref="/iletisim" />
    </FormCard>
  );
}
