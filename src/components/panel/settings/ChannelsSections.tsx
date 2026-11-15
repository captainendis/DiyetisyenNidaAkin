// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/** E-posta (SMTP), WhatsApp Cloud API ve hazır WhatsApp mesajları. Gizli değerler tarayıcıya hiç dönmez. */
import { useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { useApi } from '@/hooks/useApi';
import { Button, ErrorState, Input, Skeleton, Switch, Textarea, useFeedback } from '@/components/panel/ui';
import { CharCount, FormCard, FormSection, Notice, SaveBar } from '@/components/panel/content/FormBits';
import { useSettingForm } from '@/components/panel/content/settingsStore';
import {
  defaultSmtpView, defaultWhatsappCloudView, WHATSAPP_PLACEHOLDERS, WHATSAPP_TEMPLATE_LABEL, WHATSAPP_TEMPLATE_PARAMS,
  type SmtpSettingsView, type WhatsappCloudView, type WhatsappTemplateKey,
} from '@shared/integrations';

const msg = (e: unknown) => (e instanceof ApiError ? e.message : undefined);

export function SmtpSection() {
  const fb = useFeedback();
  const res = useApi(() => api.get<{ smtp: SmtpSettingsView; envFallback: boolean }>('/settings/smtp'), []);
  const [d, setD] = useState<SmtpSettingsView>(defaultSmtpView);
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  useEffect(() => {
    if (res.data) {
      setD(res.data.smtp);
      setPassword('');
    }
  }, [res.data]);

  if (res.error) return <ErrorState message={res.error.message} onRetry={res.reload} />;
  if (!res.data) return <Skeleton className="h-96 w-full rounded-xl" />;
  const saved = res.data.smtp;
  const dirty = password !== '' || JSON.stringify({ ...d, hasPassword: 0 }) !== JSON.stringify({ ...saved, hasPassword: 0 });
  const set = <K extends keyof SmtpSettingsView>(k: K, v: SmtpSettingsView[K]) => {
    setD((x) => ({ ...x, [k]: v }));
    setErrors((e) => ({ ...e, [k]: '' }));
  };

  const save = async () => {
    setSaving(true);
    setErrors({});
    try {
      const { hasPassword: _h, ...fields } = d;
      await api.put('/settings/smtp', { ...fields, ...(password ? { password } : {}) });
      fb.success('E-posta ayarları kaydedildi');
      res.reload();
    } catch (e) {
      if (e instanceof ApiError && e.status === 422) {
        setErrors(e.fields);
        fb.error('Kaydedilemedi', 'İşaretli alanları kontrol edin.');
      } else fb.error('Kaydedilemedi', msg(e));
    } finally {
      setSaving(false);
    }
  };

  const test = async () => {
    setTesting(true);
    try {
      const r = await api.post<{ to: string }>('/settings/smtp/test', {});
      fb.success('Test e-postası gönderildi', `${r.to} adresini kontrol edin.`);
    } catch (e) {
      fb.error('Test e-postası gönderilemedi', msg(e));
    } finally {
      setTesting(false);
    }
  };

  return (
    <FormCard>
      <FormSection title="Giden e-posta (SMTP)" description="Şifre sıfırlama, hesap bağlantıları ve e-posta bildirimleri bu sunucu üzerinden gönderilir.">
        {!saved.host && (
          <Notice>
            {res.data.envFallback
              ? 'Burada sunucu adresi boş olduğu için sunucunun kendi e-posta yapılandırması kullanılıyor. Aşağıdaki alanları doldurursanız bunun yerine bu ayarlar kullanılır.'
              : 'E-posta gönderimi henüz yapılandırılmadı. Bilgileri e-posta sağlayıcınızdan (ör. alan adı barındırma firmanız) alabilirsiniz.'}
          </Notice>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Sunucu adresi" placeholder="smtp.ornek.com" value={d.host} maxLength={255} error={errors.host} onChange={(e) => set('host', e.target.value)} />
          <Input label="Port" type="number" min={1} max={65535} value={Number.isFinite(d.port) ? d.port : ''} error={errors.port} hint="Genellikle 587 (STARTTLS) veya 465 (TLS)." onChange={(e) => set('port', e.target.value === '' ? NaN : Number(e.target.value))} />
        </div>
        <Switch checked={d.secure} onChange={(v) => set('secure', v)} label="TLS ile doğrudan bağlan" description="465 portu için açın, 587 portu için kapalı bırakın." />
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Kullanıcı adı" autoComplete="off" value={d.username} maxLength={200} error={errors.username} onChange={(e) => set('username', e.target.value)} />
          <Input
            label="Şifre"
            type="password"
            autoComplete="new-password"
            placeholder={saved.hasPassword ? '••••••••' : ''}
            value={password}
            maxLength={500}
            error={errors.password}
            hint={saved.hasPassword ? 'Kayıtlı bir şifre var. Değiştirmek istemiyorsanız boş bırakın.' : 'Şifre şifrelenerek saklanır ve bir daha gösterilmez.'}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
      </FormSection>
      <FormSection title="Gönderen" description="Alıcıların e-postada göreceği ad ve adres.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Gönderen adı" placeholder="Nida Akın" value={d.fromName} maxLength={100} error={errors.fromName} onChange={(e) => set('fromName', e.target.value)} />
          <Input label="Gönderen e-posta" type="email" placeholder="info@ornek.com" value={d.fromEmail} error={errors.fromEmail} onChange={(e) => set('fromEmail', e.target.value)} />
        </div>
      </FormSection>
      <FormSection title="Bağlantıyı sına" description="Kayıtlı ayarlarla, giriş yaptığınız hesabın e-posta adresine bir deneme iletisi gönderilir.">
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="secondary" loading={testing} disabled={dirty} onClick={() => void test()}>Test e-postası gönder</Button>
          {dirty && <span className="text-[0.78rem] text-panel-muted">Önce değişiklikleri kaydedin.</span>}
        </div>
      </FormSection>
      <SaveBar dirty={dirty} saving={saving} onSave={() => void save()} onReset={() => { setD(saved); setPassword(''); setErrors({}); }} />
    </FormCard>
  );
}

const TEMPLATE_FIELDS: { key: keyof WhatsappCloudView['templates']; label: string; hint: string }[] = [
  { key: 'requestStaff', label: 'Yeni talep (personele)', hint: 'Yeni randevu veya pilates talebi geldiğinde personel numarasına gider.' },
  { key: 'confirmedClient', label: 'Randevu onayı (danışana)', hint: 'Randevu onaylandığında danışanın telefonuna gider.' },
  { key: 'reminderClient', label: 'Hatırlatma (danışana)', hint: 'Randevudan yaklaşık bir gün önce danışanın telefonuna gider.' },
];

export function WhatsappCloudSection() {
  const fb = useFeedback();
  const res = useApi(() => api.get<{ whatsapp: WhatsappCloudView }>('/settings/whatsapp'), []);
  const [d, setD] = useState<WhatsappCloudView>(defaultWhatsappCloudView);
  const [token, setToken] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  useEffect(() => {
    if (res.data) {
      setD(res.data.whatsapp);
      setToken('');
    }
  }, [res.data]);

  if (res.error) return <ErrorState message={res.error.message} onRetry={res.reload} />;
  if (!res.data) return <Skeleton className="h-96 w-full rounded-xl" />;
  const saved = res.data.whatsapp;
  const dirty = token !== '' || JSON.stringify(d) !== JSON.stringify(saved);
  const set = <K extends keyof WhatsappCloudView>(k: K, v: WhatsappCloudView[K]) => {
    setD((x) => ({ ...x, [k]: v }));
    setErrors((e) => ({ ...e, [k]: '' }));
  };

  const save = async () => {
    setSaving(true);
    setErrors({});
    try {
      const { hasToken: _h, ...fields } = d;
      await api.put('/settings/whatsapp', { ...fields, ...(token ? { accessToken: token } : {}) });
      fb.success('WhatsApp ayarları kaydedildi');
      res.reload();
    } catch (e) {
      if (e instanceof ApiError && e.status === 422) {
        setErrors(e.fields);
        fb.error('Kaydedilemedi', 'İşaretli alanları kontrol edin.');
      } else fb.error('Kaydedilemedi', msg(e));
    } finally {
      setSaving(false);
    }
  };

  const test = async () => {
    setTesting(true);
    try {
      await api.post('/settings/whatsapp/test', {});
      fb.success('Test mesajı gönderildi', 'Personel numarasındaki WhatsApp’ı kontrol edin.');
    } catch (e) {
      fb.error('Test mesajı gönderilemedi', msg(e));
    } finally {
      setTesting(false);
    }
  };

  return (
    <FormCard>
      <FormSection title="WhatsApp Business (otomatik mesaj)" description="İsteğe bağlıdır. Açık değilse hiçbir mesaj otomatik gönderilmez; “WhatsApp’tan yaz” düğmesi ise bu ayardan bağımsız çalışır.">
        <Notice>
          <p className="font-semibold">Gerekenler</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5">
            <li>Bir Meta Business hesabı ve WhatsApp Business (Cloud API) uygulaması</li>
            <li>Mesajların gönderileceği telefon numarasının “telefon numarası kimliği”</li>
            <li>Kalıcı erişim anahtarı (sistem kullanıcısı üzerinden oluşturulur; geçici anahtarlar kısa sürede dolar)</li>
            <li>Meta tarafından onaylanmış mesaj şablonları. Şablonların gövde değişkenleri aşağıda belirtilen sırayla olmalıdır.</li>
          </ul>
        </Notice>
        <Switch checked={d.enabled} onChange={(v) => set('enabled', v)} label="Otomatik WhatsApp mesajlarını aç" description="Yalnızca aşağıdaki bilgiler ve ilgili şablon adı doluysa gönderim yapılır." />
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Telefon numarası kimliği" inputMode="numeric" value={d.phoneNumberId} maxLength={40} error={errors.phoneNumberId} onChange={(e) => set('phoneNumberId', e.target.value)} />
          <Input
            label="Erişim anahtarı"
            type="password"
            autoComplete="new-password"
            placeholder={saved.hasToken ? '••••••••' : ''}
            value={token}
            maxLength={1000}
            error={errors.accessToken}
            hint={saved.hasToken ? 'Kayıtlı bir anahtar var. Değiştirmek istemiyorsanız boş bırakın.' : 'Şifrelenerek saklanır ve bir daha gösterilmez.'}
            onChange={(e) => setToken(e.target.value)}
          />
          <Input label="Graph API sürümü" value={d.apiVersion} error={errors.apiVersion} hint="Ör. v21.0" onChange={(e) => set('apiVersion', e.target.value)} />
          <Input label="Şablon dili" value={d.templateLanguage} error={errors.templateLanguage} hint="Şablonun Meta’daki dil kodu. Ör. tr" onChange={(e) => set('templateLanguage', e.target.value)} />
        </div>
        <Input label="Personel bildirim numarası" inputMode="numeric" placeholder="905xxxxxxxxx" value={d.staffNumber} error={errors.staffNumber} hint="Yeni talep bildirimlerinin gideceği numara. Yalnızca rakam, ülke koduyla." onChange={(e) => set('staffNumber', e.target.value)} />
      </FormSection>
      <FormSection title="Onaylı şablon adları" description="Meta panelinde onaylanmış şablonun tam adını yazın. Boş bırakılan olay için mesaj gönderilmez.">
        {TEMPLATE_FIELDS.map((f) => (
          <Input
            key={f.key}
            label={f.label}
            placeholder="sablon_adi"
            value={d.templates[f.key]}
            error={errors[`templates.${f.key}`]}
            hint={`${f.hint} Gövde değişkenleri sırayla: ${WHATSAPP_TEMPLATE_PARAMS[f.key].map((p, i) => `{{${i + 1}}} ${p}`).join(', ')}.`}
            onChange={(e) => setD((x) => ({ ...x, templates: { ...x.templates, [f.key]: e.target.value } }))}
          />
        ))}
      </FormSection>
      <FormSection title="Bağlantıyı sına" description="Kayıtlı ayarlarla, personel numarasına “Yeni talep” şablonuyla örnek bir mesaj gönderilir.">
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="secondary" loading={testing} disabled={dirty} onClick={() => void test()}>Test mesajı gönder</Button>
          {dirty && <span className="text-[0.78rem] text-panel-muted">Önce değişiklikleri kaydedin.</span>}
        </div>
      </FormSection>
      <SaveBar dirty={dirty} saving={saving} onSave={() => void save()} onReset={() => { setD(saved); setToken(''); setErrors({}); }} />
    </FormCard>
  );
}

export function WhatsappTemplatesSection() {
  const f = useSettingForm('whatsappTemplates', { successMessage: 'Hazır mesajlar kaydedildi' });
  if (!f.draft) return null;
  const d = f.draft;
  return (
    <FormCard>
      <FormSection
        title="Hazır WhatsApp mesajları"
        description={`Randevu ekranındaki “WhatsApp’tan yaz” düğmesi bu metinleri kullanır; ek bir hesap gerekmez. Değişkenler: ${WHATSAPP_PLACEHOLDERS.join(' ')}`}
      >
        {(Object.keys(WHATSAPP_TEMPLATE_LABEL) as WhatsappTemplateKey[]).map((k) => (
          <Textarea
            key={k}
            label={WHATSAPP_TEMPLATE_LABEL[k]}
            rows={3}
            maxLength={1000}
            value={d[k]}
            error={f.errors[k]}
            hint={<CharCount value={d[k]} max={1000} />}
            onChange={(e) => f.set(k, e.target.value)}
          />
        ))}
      </FormSection>
      <SaveBar dirty={f.dirty} saving={f.saving} onSave={() => void f.save()} onReset={f.reset} note="Bu metinler web sitesinde görünmez." />
    </FormCard>
  );
}
