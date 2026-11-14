// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/** İşletme bilgileri, randevu ayarları ve KVKK ayarları (website_settings anahtarları) */
import { Link } from '@/lib/router';
import { Input, Switch, Textarea } from '@/components/panel/ui';
import { CharCount, FormCard, FormSection, Notice, SaveBar } from '@/components/panel/content/FormBits';
import { useSettingForm } from '@/components/panel/content/settingsStore';

const n = (v: string) => (v.trim() === '' ? null : v);
const int = (v: string) => (v === '' ? NaN : Number(v));

export function BusinessSection() {
  const f = useSettingForm('business', { successMessage: 'İşletme bilgileri kaydedildi' });
  if (!f.draft) return null;
  const d = f.draft;
  return (
    <FormCard>
      <FormSection title="Marka" description="Web sitesinin başlığında, logoda ve paylaşımlarda kullanılır.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Marka adı" required value={d.brandName} maxLength={60} error={f.errors.brandName} onChange={(e) => f.set('brandName', e.target.value)} />
          <Input label="Unvan" required value={d.title} maxLength={60} error={f.errors.title} onChange={(e) => f.set('title', e.target.value)} />
        </div>
      </FormSection>
      <FormSection title="Veri sorumlusu" description="KVKK aydınlatma metninde veri sorumlusu olarak gösterilir. Doğrulanmamış bilgi girmeyin.">
        <Input label="Resmî ad / ticari unvan" placeholder="Ör. şahıs adı veya şirket unvanı" value={d.legalName ?? ''} maxLength={160} error={f.errors.legalName} onChange={(e) => f.set('legalName', n(e.target.value))} />
        <Input label="KVKK başvuru e-postası" type="email" hint="İlgili kişilerin veri talepleri için iletişim adresi." value={d.kvkkContactEmail ?? ''} error={f.errors.kvkkContactEmail} onChange={(e) => f.set('kvkkContactEmail', n(e.target.value))} />
      </FormSection>
      <SaveBar dirty={f.dirty} saving={f.saving} onSave={() => void f.save()} onReset={f.reset} />
    </FormCard>
  );
}

export function AppointmentSection() {
  const f = useSettingForm('appointment', { successMessage: 'Randevu ayarları kaydedildi' });
  if (!f.draft) return null;
  const d = f.draft;
  return (
    <FormCard>
      <FormSection
        title="Web sitesinden talep"
        description={
          <>
            Danışanların web sitesinden hangi zaman aralığında talep oluşturabileceği. Çalışma gün ve saatleri{' '}
            <Link to="/panel/ayarlar/takvim" className="font-semibold text-cocoa underline underline-offset-2">Çalışma Takvimi</Link>’nden yönetilir.
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="En erken talep (saat sonra)"
            type="number"
            min={0}
            max={168}
            hint="Ör. 12 → şu andan itibaren 12 saat içindeki saatler seçilemez."
            value={Number.isFinite(d.leadTimeHours) ? d.leadTimeHours : ''}
            error={f.errors.leadTimeHours}
            onChange={(e) => f.set('leadTimeHours', int(e.target.value))}
          />
          <Input
            label="En ileri talep (gün)"
            type="number"
            min={1}
            max={180}
            hint="Takvimde bugünden itibaren kaç gün gösterilsin."
            value={Number.isFinite(d.maxDaysAhead) ? d.maxDaysAhead : ''}
            error={f.errors.maxDaysAhead}
            onChange={(e) => f.set('maxDaysAhead', int(e.target.value))}
          />
        </div>
      </FormSection>
      <FormSection title="Görüşme türleri" description="Formda danışana sunulan seçenekler. En az biri açık olmalı.">
        <div className="space-y-3 rounded-lg border border-panel-line p-4">
          <Switch checked={d.inPersonEnabled} onChange={(v) => f.set('inPersonEnabled', v)} label="Yüz yüze görüşme" />
          <Switch checked={d.onlineEnabled} onChange={(v) => f.set('onlineEnabled', v)} label="Online görüşme" />
        </div>
        {!d.inPersonEnabled && !d.onlineEnabled && <p className="text-[0.78rem] text-danger-ink">En az bir görüşme türünü açık bırakın.</p>}
        <Switch
          checked={d.allowRequestWithoutTime}
          onChange={(v) => f.set('allowRequestWithoutTime', v)}
          label="Saat seçmeden iletişim talebine izin ver"
          description="Uygun saat bulamayan danışan “beni arayın” talebi bırakabilir. Talep panelde “Yeni Talep” olarak görünür."
        />
      </FormSection>
      <FormSection title="Form notu" description="Randevu formunun altında gösterilen bilgilendirme. Talebin kesin randevu olmadığını belirtmesi önerilir.">
        <Textarea rows={3} aria-label="Form notu" value={d.formNote} maxLength={300} error={f.errors.formNote} hint={<CharCount value={d.formNote} max={300} />} onChange={(e) => f.set('formNote', e.target.value)} />
      </FormSection>
      <SaveBar
        dirty={f.dirty}
        saving={f.saving}
        onSave={() => {
          if (!d.inPersonEnabled && !d.onlineEnabled) return;
          void f.save();
        }}
        onReset={f.reset}
        viewHref="/randevu"
      />
    </FormCard>
  );
}

export function PrivacySection() {
  const f = useSettingForm('kvkk', { successMessage: 'KVKK ayarları kaydedildi' });
  if (!f.draft) return null;
  const d = f.draft;
  return (
    <FormCard>
      <div className="px-5 pt-5 sm:px-6">
        <Notice tone="warning">
          <p className="font-semibold">Bu yazılım KVKK uyumluluğunu kendiliğinden sağlamaz.</p>
          <p className="mt-1">
            Aydınlatma metni, açık rıza metni, veri işleme envanteri ve saklama süreleri gerçek kullanımdan önce bir hukuk uzmanı tarafından incelenmeli ve onaylanmalıdır.
            Sağlık verileri özel nitelikli kişisel veri kapsamında değerlendirilebilir.
          </p>
        </Notice>
      </div>
      <FormSection title="Hukuki inceleme" description="İnceleme tamamlanana kadar web sitesindeki yasal sayfalarda “taslak” uyarısı gösterilir.">
        <Switch
          checked={d.legalReviewCompleted}
          onChange={(v) => f.set('legalReviewCompleted', v)}
          label="Yasal metinler hukuk uzmanı tarafından incelendi"
          description="Yalnızca inceleme gerçekten tamamlandıysa işaretleyin."
        />
        <Input label="Aydınlatma metni sürümü" hint="Metni güncellediğinizde sürümü değiştirin; yeni talepler bu sürümle kaydedilir." value={d.noticeVersion} maxLength={40} error={f.errors.noticeVersion} onChange={(e) => f.set('noticeVersion', e.target.value)} />
      </FormSection>
      <FormSection title="Veri saklama süresi" description="Pasif veya arşivlenmiş danışanların verileri bu süre sonunda anonimleştirilir.">
        <Input
          label="Saklama süresi (ay)"
          type="number"
          min={6}
          max={240}
          value={Number.isFinite(d.retentionMonths) ? d.retentionMonths : ''}
          error={f.errors.retentionMonths}
          hint="Mevzuattaki zorunlu saklama sürelerini hukuk danışmanınızla belirleyin."
          onChange={(e) => f.set('retentionMonths', int(e.target.value))}
        />
        <Notice>
          <p>
            Anonimleştirmede klinik notlar, ölçümler ve dosyalar kalıcı olarak silinir; randevu kayıtları kimlik bilgisi olmadan istatistik için tutulur.
          </p>
        </Notice>
      </FormSection>
      <FormSection title="Veri güvenliği" description="Sistemde uygulanan teknik önlemler.">
        <ul className="space-y-2 text-[0.85rem] leading-relaxed text-cocoa/85">
          <li>• Görüşme notları, ölçümler ve danışan dosyaları veritabanında ve diskte <strong>AES-256-GCM</strong> ile şifreli saklanır.</li>
          <li>• Sağlık verilerine yalnızca diyetisyen ve yönetici rolleri erişebilir; asistan rolü erişemez.</li>
          <li>• Ölçüm kaydı için danışanın açık rızasının panelde işaretlenmiş olması gerekir.</li>
          <li>• Oturumlar HttpOnly çerezlerle yönetilir; tüm kritik işlemler denetim kaydına yazılır.</li>
        </ul>
        <Link to="/panel/ayarlar/denetim-kayitlari" className="inline-flex text-sm font-semibold text-cocoa underline underline-offset-2">
          Denetim kayıtlarını görüntüle
        </Link>
      </FormSection>
      <SaveBar dirty={f.dirty} saving={f.saving} onSave={() => void f.save()} onReset={f.reset} viewHref="/kvkk-aydinlatma-metni" />
    </FormCard>
  );
}
