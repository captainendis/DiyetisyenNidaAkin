// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/** İşletme bilgileri, randevu ayarları ve KVKK ayarları (site ayarı anahtarları; web: settings/BusinessSections.tsx) */
import { router } from 'expo-router';
import { View } from 'react-native';
import { Button, Notice, SwitchField, T, TextField } from '@/components/ui';
import { useStaff } from '@/lib/auth';
import { colors, space } from '@/theme';
import { charCount, FormSection, nullIfEmpty as n } from '../content/FormBits';
import { useSettingField } from '../content/settingsStore';

const int = (v: string) => (v === '' ? NaN : Number(v.replace(/\D/g, '')));
const numStr = (v: number) => (Number.isFinite(v) ? String(v) : '');

export function BusinessForm() {
  const { d, set, err } = useSettingField('business');
  return (
    <>
      <FormSection title="Marka" description="Web sitesinin başlığında, logoda ve paylaşımlarda kullanılır.">
        <TextField label="Marka adı" required value={d.brandName} maxLength={60} error={err('brandName')} onChange={(v) => set('brandName', v)} />
        <TextField label="Unvan" required value={d.title} maxLength={60} error={err('title')} onChange={(v) => set('title', v)} />
      </FormSection>
      <FormSection title="Veri sorumlusu" description="KVKK aydınlatma metninde veri sorumlusu olarak gösterilir. Doğrulanmamış bilgi girmeyin.">
        <TextField label="Resmî ad / ticari unvan" placeholder="Ör. şahıs adı veya şirket unvanı" value={d.legalName ?? ''} maxLength={160} error={err('legalName')} onChange={(v) => set('legalName', n(v))} />
        <TextField
          label="KVKK başvuru e-postası"
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          help="İlgili kişilerin veri talepleri için iletişim adresi."
          value={d.kvkkContactEmail ?? ''}
          error={err('kvkkContactEmail')}
          onChange={(v) => set('kvkkContactEmail', n(v))}
        />
      </FormSection>
    </>
  );
}

/** Randevu ayarları: en az bir görüşme türü açık olmalı (kaydetmeden önce SettingsEditor `validate`) */
export const validateAppointment = (s: { appointment: { inPersonEnabled: boolean; onlineEnabled: boolean } }) =>
  !s.appointment.inPersonEnabled && !s.appointment.onlineEnabled ? 'En az bir görüşme türünü açık bırakın.' : null;

export function AppointmentForm() {
  const { d, set, err } = useSettingField('appointment');
  const { can } = useStaff();
  return (
    <>
      <FormSection
        title="Web sitesinden talep"
        description={
          <T variant="caption">
            Danışanların web sitesinden hangi zaman aralığında talep oluşturabileceği. Çalışma gün ve saatleri{' '}
            {can('availability:write') ? (
              <T variant="caption" weight="semibold" color={colors.goldInk} style={{ textDecorationLine: 'underline' }} accessibilityRole="link" onPress={() => router.push('/panel/takvim')}>
                Çalışma Takvimi
              </T>
            ) : (
              'Çalışma Takvimi'
            )}
            ’nden yönetilir.
          </T>
        }
      >
        <TextField
          label="En erken talep (saat sonra)"
          keyboardType="number-pad"
          help="Ör. 12 → şu andan itibaren 12 saat içindeki saatler seçilemez. (0–168)"
          value={numStr(d.leadTimeHours)}
          error={err('leadTimeHours')}
          onChange={(v) => set('leadTimeHours', int(v))}
        />
        <TextField
          label="En ileri talep (gün)"
          keyboardType="number-pad"
          help="Takvimde bugünden itibaren kaç gün gösterilsin. (1–180)"
          value={numStr(d.maxDaysAhead)}
          error={err('maxDaysAhead')}
          onChange={(v) => set('maxDaysAhead', int(v))}
        />
      </FormSection>
      <FormSection title="Görüşme türleri" description="Formda danışana sunulan seçenekler. En az biri açık olmalı.">
        <SwitchField label="Yüz yüze görüşme" value={d.inPersonEnabled} onChange={(v) => set('inPersonEnabled', v)} />
        <SwitchField label="Online görüşme" value={d.onlineEnabled} onChange={(v) => set('onlineEnabled', v)} />
        {!d.inPersonEnabled && !d.onlineEnabled ? <T variant="caption" color={colors.dangerInk}>En az bir görüşme türünü açık bırakın.</T> : null}
        <SwitchField
          label="Saat seçmeden iletişim talebine izin ver"
          help="Uygun saat bulamayan danışan “beni arayın” talebi bırakabilir. Talep panelde “Yeni Talep” olarak görünür."
          value={d.allowRequestWithoutTime}
          onChange={(v) => set('allowRequestWithoutTime', v)}
        />
      </FormSection>
      <FormSection title="Form notu" description="Randevu formunun altında gösterilen bilgilendirme. Talebin kesin randevu olmadığını belirtmesi önerilir.">
        <TextField accessibilityLabel="Form notu" rows={3} value={d.formNote} maxLength={300} error={err('formNote')} help={charCount(d.formNote, 300)} onChange={(v) => set('formNote', v)} />
      </FormSection>
    </>
  );
}

export function PrivacyForm() {
  const { d, set, err } = useSettingField('kvkk');
  const { can } = useStaff();
  return (
    <>
      <View style={{ marginBottom: space.lg }}>
        <Notice
          tone="warning"
          title="Bu yazılım KVKK uyumluluğunu kendiliğinden sağlamaz."
          text="Aydınlatma metni, açık rıza metni, veri işleme envanteri ve saklama süreleri gerçek kullanımdan önce bir hukuk uzmanı tarafından incelenmeli ve onaylanmalıdır. Sağlık verileri özel nitelikli kişisel veri kapsamında değerlendirilebilir."
        />
      </View>
      <FormSection title="Hukuki inceleme" description="Panel kontrol listesinde takip edilir. Yasal metinleri gerçek kullanımdan önce bir hukuk uzmanına inceletin.">
        <SwitchField
          label="Yasal metinler hukuk uzmanı tarafından incelendi"
          help="Yalnızca inceleme gerçekten tamamlandıysa işaretleyin."
          value={d.legalReviewCompleted}
          onChange={(v) => set('legalReviewCompleted', v)}
        />
        <TextField
          label="Aydınlatma metni sürümü"
          help="Metni güncellediğinizde sürümü değiştirin; yeni talepler bu sürümle kaydedilir."
          value={d.noticeVersion}
          maxLength={40}
          error={err('noticeVersion')}
          onChange={(v) => set('noticeVersion', v)}
        />
      </FormSection>
      <FormSection title="Veri saklama süresi" description="Pasif veya arşivlenmiş danışanların verileri bu süre sonunda anonimleştirilir.">
        <TextField
          label="Saklama süresi (ay)"
          keyboardType="number-pad"
          value={numStr(d.retentionMonths)}
          error={err('retentionMonths')}
          help="6–240 ay. Mevzuattaki zorunlu saklama sürelerini hukuk danışmanınızla belirleyin."
          onChange={(v) => set('retentionMonths', int(v))}
        />
        <Notice text="Anonimleştirmede klinik notlar, ölçümler ve dosyalar kalıcı olarak silinir; randevu kayıtları kimlik bilgisi olmadan istatistik için tutulur." />
      </FormSection>
      <FormSection title="Veri güvenliği" description="Sistemde uygulanan teknik önlemler.">
        <View style={{ gap: 6 }}>
          <T variant="caption">• Görüşme notları, ölçümler ve danışan dosyaları veritabanında ve diskte AES-256-GCM ile şifreli saklanır.</T>
          <T variant="caption">• Sağlık verilerine yalnızca diyetisyen ve yönetici rolleri erişebilir; asistan rolü erişemez.</T>
          <T variant="caption">• Ölçüm kaydı için danışanın açık rızasının panelde işaretlenmiş olması gerekir.</T>
          <T variant="caption">• Oturumlar güvenli olarak yönetilir (web’de HttpOnly çerez, uygulamada cihazın güvenli deposu); tüm kritik işlemler denetim kaydına yazılır.</T>
        </View>
        {can('audit:read') ? (
          <Button title="Denetim kayıtlarını görüntüle" icon="shield" variant="secondary" size="sm" style={{ alignSelf: 'flex-start' }} onPress={() => router.push('/panel/denetim')} />
        ) : null}
      </FormSection>
    </>
  );
}
