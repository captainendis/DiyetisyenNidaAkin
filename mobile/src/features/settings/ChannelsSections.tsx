// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/** E-posta (SMTP), WhatsApp Cloud API ve hazır WhatsApp mesajları (web: settings/ChannelsSections.tsx). Gizli değerler cihaza hiç dönmez. */
import { useState } from 'react';
import { View } from 'react-native';
import { Button, Notice, QueryView, Screen, SwitchField, T, TextField, useToast } from '@/components/ui';
import { api, ApiError, errorMessage } from '@/lib/api';
import { useApiQuery } from '@/lib/query';
import {
  WHATSAPP_PLACEHOLDERS,
  WHATSAPP_TEMPLATE_LABEL,
  WHATSAPP_TEMPLATE_PARAMS,
  type SmtpSettingsView,
  type WhatsappCloudView,
  type WhatsappTemplateKey,
} from '@shared/integrations';
import { space } from '@/theme';
import { charCount, FormSection, SaveBar, useUnsavedGuard } from '../content/FormBits';
import { useSettingField } from '../content/settingsStore';

function TestRow({ dirty, testing, onTest, label }: { dirty: boolean; testing: boolean; onTest: () => void; label: string }) {
  return (
    <View style={{ gap: space.sm }}>
      <Button title={label} variant="secondary" icon="send" loading={testing} disabled={dirty} onPress={onTest} style={{ alignSelf: 'flex-start' }} />
      {dirty ? <T variant="caption">Önce değişiklikleri kaydedin.</T> : null}
    </View>
  );
}

// ───────────────────────── SMTP ─────────────────────────

export function SmtpSection() {
  const q = useApiQuery(['settings', 'smtp'], () => api.get<{ smtp: SmtpSettingsView; envFallback: boolean }>('/settings/smtp'));
  return <QueryView query={q}>{(data) => <SmtpForm key={JSON.stringify(data.smtp)} saved={data.smtp} envFallback={data.envFallback} reload={() => void q.refetch()} />}</QueryView>;
}

function SmtpForm({ saved, envFallback, reload }: { saved: SmtpSettingsView; envFallback: boolean; reload: () => void }) {
  const toast = useToast();
  const [d, setD] = useState<SmtpSettingsView>(saved);
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const dirty = password !== '' || JSON.stringify({ ...d, hasPassword: 0 }) !== JSON.stringify({ ...saved, hasPassword: 0 });
  useUnsavedGuard(dirty && !saving);
  const set = <K extends keyof SmtpSettingsView>(k: K, v: SmtpSettingsView[K]) => {
    setD((x) => ({ ...x, [k]: v }));
    setErrors((e) => (e[k] ? { ...e, [k]: '' } : e));
  };

  const save = async () => {
    setSaving(true);
    setErrors({});
    try {
      const { hasPassword: _h, ...fields } = d;
      await api.put('/settings/smtp', { ...fields, ...(password ? { password } : {}) });
      toast('E-posta ayarları kaydedildi');
      setPassword('');
      reload();
    } catch (e) {
      if (e instanceof ApiError && e.status === 422) {
        setErrors(e.fields);
        toast('Kaydedilemedi. İşaretli alanları kontrol edin.', 'error');
      } else toast(`Kaydedilemedi: ${errorMessage(e)}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  const test = async () => {
    setTesting(true);
    try {
      const r = await api.post<{ to: string }>('/settings/smtp/test', {});
      toast(`Test e-postası gönderildi. ${r.to} adresini kontrol edin.`);
    } catch (e) {
      toast(`Test e-postası gönderilemedi: ${errorMessage(e)}`, 'error');
    } finally {
      setTesting(false);
    }
  };

  return (
    <Screen
      footer={
        <SaveBar
          dirty={dirty}
          saving={saving}
          onSave={() => void save()}
          onReset={() => {
            setD(saved);
            setPassword('');
            setErrors({});
          }}
        />
      }
    >
      <FormSection title="Giden e-posta (SMTP)" description="Şifre sıfırlama, hesap bağlantıları ve e-posta bildirimleri bu sunucu üzerinden gönderilir.">
        {!saved.host ? (
          <Notice
            text={
              envFallback
                ? 'Burada sunucu adresi boş olduğu için sunucunun kendi e-posta yapılandırması kullanılıyor. Aşağıdaki alanları doldurursanız bunun yerine bu ayarlar kullanılır.'
                : 'E-posta gönderimi henüz yapılandırılmadı. Bilgileri e-posta sağlayıcınızdan (ör. alan adı barındırma firmanız) alabilirsiniz.'
            }
          />
        ) : null}
        <TextField label="Sunucu adresi" placeholder="smtp.ornek.com" autoCapitalize="none" autoCorrect={false} value={d.host} maxLength={255} error={errors.host} onChange={(v) => set('host', v)} />
        <TextField
          label="Port"
          keyboardType="number-pad"
          value={Number.isFinite(d.port) ? String(d.port) : ''}
          error={errors.port}
          help="Genellikle 587 (STARTTLS) veya 465 (TLS)."
          onChange={(v) => set('port', v === '' ? NaN : Number(v.replace(/\D/g, '')))}
        />
        <SwitchField label="TLS ile doğrudan bağlan" help="465 portu için açın, 587 portu için kapalı bırakın." value={d.secure} onChange={(v) => set('secure', v)} />
        <TextField label="Kullanıcı adı" autoCapitalize="none" autoCorrect={false} autoComplete="off" value={d.username} maxLength={200} error={errors.username} onChange={(v) => set('username', v)} />
        <TextField
          label="Şifre"
          secureTextEntry
          autoComplete="off"
          textContentType="none"
          placeholder={saved.hasPassword ? '••••••••' : ''}
          value={password}
          maxLength={500}
          error={errors.password}
          help={saved.hasPassword ? 'Kayıtlı bir şifre var. Değiştirmek istemiyorsanız boş bırakın.' : 'Şifre şifrelenerek saklanır ve bir daha gösterilmez.'}
          onChange={setPassword}
        />
      </FormSection>
      <FormSection title="Gönderen" description="Alıcıların e-postada göreceği ad ve adres.">
        <TextField label="Gönderen adı" placeholder="Nida Akın" value={d.fromName} maxLength={100} error={errors.fromName} onChange={(v) => set('fromName', v)} />
        <TextField label="Gönderen e-posta" keyboardType="email-address" autoCapitalize="none" autoCorrect={false} placeholder="info@ornek.com" value={d.fromEmail} error={errors.fromEmail} onChange={(v) => set('fromEmail', v)} />
      </FormSection>
      <FormSection title="Bağlantıyı sına" description="Kayıtlı ayarlarla, giriş yaptığınız hesabın e-posta adresine bir deneme iletisi gönderilir.">
        <TestRow dirty={dirty} testing={testing} onTest={() => void test()} label="Test e-postası gönder" />
      </FormSection>
    </Screen>
  );
}

// ───────────────────────── WhatsApp Cloud API ─────────────────────────

const TEMPLATE_FIELDS: { key: keyof WhatsappCloudView['templates']; label: string; hint: string }[] = [
  { key: 'requestStaff', label: 'Yeni talep (personele)', hint: 'Yeni randevu veya pilates talebi geldiğinde personel numarasına gider.' },
  { key: 'confirmedClient', label: 'Randevu onayı (danışana)', hint: 'Randevu onaylandığında danışanın telefonuna gider.' },
  { key: 'reminderClient', label: 'Hatırlatma (danışana)', hint: 'Randevudan yaklaşık bir gün önce danışanın telefonuna gider.' },
];

export function WhatsappCloudSection() {
  const q = useApiQuery(['settings', 'whatsapp'], () => api.get<{ whatsapp: WhatsappCloudView }>('/settings/whatsapp'));
  return <QueryView query={q}>{(data) => <WhatsappForm key={JSON.stringify(data.whatsapp)} saved={data.whatsapp} reload={() => void q.refetch()} />}</QueryView>;
}

function WhatsappForm({ saved, reload }: { saved: WhatsappCloudView; reload: () => void }) {
  const toast = useToast();
  const [d, setD] = useState<WhatsappCloudView>(saved);
  const [token, setToken] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const dirty = token !== '' || JSON.stringify(d) !== JSON.stringify(saved);
  useUnsavedGuard(dirty && !saving);
  const set = <K extends keyof WhatsappCloudView>(k: K, v: WhatsappCloudView[K]) => {
    setD((x) => ({ ...x, [k]: v }));
    setErrors((e) => (e[k] ? { ...e, [k]: '' } : e));
  };

  const save = async () => {
    setSaving(true);
    setErrors({});
    try {
      const { hasToken: _h, ...fields } = d;
      await api.put('/settings/whatsapp', { ...fields, ...(token ? { accessToken: token } : {}) });
      toast('WhatsApp ayarları kaydedildi');
      setToken('');
      reload();
    } catch (e) {
      if (e instanceof ApiError && e.status === 422) {
        setErrors(e.fields);
        toast(`Kaydedilemedi: ${e.message}`, 'error');
      } else toast(`Kaydedilemedi: ${errorMessage(e)}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  const test = async () => {
    setTesting(true);
    try {
      await api.post('/settings/whatsapp/test', {});
      toast('Test mesajı gönderildi. Personel numarasındaki WhatsApp’ı kontrol edin.');
    } catch (e) {
      toast(`Test mesajı gönderilemedi: ${errorMessage(e)}`, 'error');
    } finally {
      setTesting(false);
    }
  };

  return (
    <Screen
      footer={
        <SaveBar
          dirty={dirty}
          saving={saving}
          onSave={() => void save()}
          onReset={() => {
            setD(saved);
            setToken('');
            setErrors({});
          }}
        />
      }
    >
      <FormSection title="WhatsApp Business (otomatik mesaj)" description="İsteğe bağlıdır. Açık değilse hiçbir mesaj otomatik gönderilmez; “WhatsApp’tan yaz” düğmesi ise bu ayardan bağımsız çalışır.">
        <Notice
          title="Gerekenler"
          text={[
            '• Bir Meta Business hesabı ve WhatsApp Business (Cloud API) uygulaması',
            '• Mesajların gönderileceği telefon numarasının “telefon numarası kimliği”',
            '• Kalıcı erişim anahtarı (sistem kullanıcısı üzerinden oluşturulur; geçici anahtarlar kısa sürede dolar)',
            '• Meta tarafından onaylanmış mesaj şablonları. Şablonların gövde değişkenleri aşağıda belirtilen sırayla olmalıdır.',
          ].join('\n')}
        />
        <SwitchField label="Otomatik WhatsApp mesajlarını aç" help="Yalnızca aşağıdaki bilgiler ve ilgili şablon adı doluysa gönderim yapılır." value={d.enabled} onChange={(v) => set('enabled', v)} />
        <TextField label="Telefon numarası kimliği" keyboardType="number-pad" value={d.phoneNumberId} maxLength={40} error={errors.phoneNumberId} onChange={(v) => set('phoneNumberId', v)} />
        <TextField
          label="Erişim anahtarı"
          secureTextEntry
          autoComplete="off"
          textContentType="none"
          autoCapitalize="none"
          placeholder={saved.hasToken ? '••••••••' : ''}
          value={token}
          maxLength={1000}
          error={errors.accessToken}
          help={saved.hasToken ? 'Kayıtlı bir anahtar var. Değiştirmek istemiyorsanız boş bırakın.' : 'Şifrelenerek saklanır ve bir daha gösterilmez.'}
          onChange={(v) => {
            setToken(v);
            setErrors((e) => (e.accessToken ? { ...e, accessToken: '' } : e));
          }}
        />
        <TextField label="Graph API sürümü" autoCapitalize="none" autoCorrect={false} value={d.apiVersion} error={errors.apiVersion} help="Ör. v21.0" onChange={(v) => set('apiVersion', v)} />
        <TextField label="Şablon dili" autoCapitalize="none" autoCorrect={false} value={d.templateLanguage} error={errors.templateLanguage} help="Şablonun Meta’daki dil kodu. Ör. tr" onChange={(v) => set('templateLanguage', v)} />
        <TextField
          label="Personel bildirim numarası"
          keyboardType="number-pad"
          placeholder="905xxxxxxxxx"
          value={d.staffNumber}
          error={errors.staffNumber}
          help="Yeni talep bildirimlerinin gideceği numara. Yalnızca rakam, ülke koduyla."
          onChange={(v) => set('staffNumber', v)}
        />
      </FormSection>
      <FormSection title="Onaylı şablon adları" description="Meta panelinde onaylanmış şablonun tam adını yazın. Boş bırakılan olay için mesaj gönderilmez.">
        {TEMPLATE_FIELDS.map((f) => (
          <TextField
            key={f.key}
            label={f.label}
            placeholder="sablon_adi"
            autoCapitalize="none"
            autoCorrect={false}
            value={d.templates[f.key]}
            error={errors[`templates.${f.key}`]}
            help={`${f.hint} Gövde değişkenleri sırayla: ${WHATSAPP_TEMPLATE_PARAMS[f.key].map((p, i) => `{{${i + 1}}} ${p}`).join(', ')}.`}
            onChange={(v) => {
              setD((x) => ({ ...x, templates: { ...x.templates, [f.key]: v } }));
              setErrors((e) => (e[`templates.${f.key}`] ? { ...e, [`templates.${f.key}`]: '' } : e));
            }}
          />
        ))}
      </FormSection>
      <FormSection title="Bağlantıyı sına" description="Kayıtlı ayarlarla, personel numarasına “Yeni talep” şablonuyla örnek bir mesaj gönderilir.">
        <TestRow dirty={dirty} testing={testing} onTest={() => void test()} label="Test mesajı gönder" />
      </FormSection>
    </Screen>
  );
}

// ───────────────────────── Hazır WhatsApp mesajları (site ayarı) ─────────────────────────

/** SettingsEditor içinde kullanılır (anahtar: whatsappTemplates) */
export function WhatsappTemplatesForm() {
  const { d, set, err } = useSettingField('whatsappTemplates');
  return (
    <FormSection
      title="Hazır WhatsApp mesajları"
      description={`Randevu ekranındaki “WhatsApp’tan yaz” düğmesi bu metinleri kullanır; ek bir hesap gerekmez. Değişkenler: ${WHATSAPP_PLACEHOLDERS.join(' ')}`}
    >
      {(Object.keys(WHATSAPP_TEMPLATE_LABEL) as WhatsappTemplateKey[]).map((k) => (
        <TextField key={k} label={WHATSAPP_TEMPLATE_LABEL[k]} rows={4} maxLength={1000} value={d[k]} error={err(k)} help={charCount(d[k], 1000)} onChange={(v) => set(k, v)} />
      ))}
    </FormSection>
  );
}
