/** KVKK durumu: aydınlatma metni ve sağlık verisi açık rızası */
import { useState } from 'react';
import { ShieldCheck, ShieldAlert } from 'lucide-react';
import { api } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { Badge, Button, Card, CardHeader, Checkbox, Modal, Textarea, useFeedback } from '@/components/panel/ui';
import { usePanelAuth } from '@/components/panel/PanelAuth';
import type { Client } from './types';

export function ConsentDialog({ client, open, onClose, onChanged, mode }: { client: Client; open: boolean; onClose: () => void; onChanged: (c: Client) => void; mode: 'grant' | 'withdraw' }) {
  const [note, setNote] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [pending, setPending] = useState(false);
  const { success, error } = useFeedback();
  const grant = mode === 'grant';

  async function submit() {
    setPending(true);
    try {
      const res = await api.post<{ client: Client }>(`/clients/${client.id}/health-consent`, { granted: grant, note: note || null });
      success(grant ? 'Açık rıza kaydedildi' : 'Açık rızanın geri çekildiği kaydedildi');
      onChanged(res.client);
      setNote('');
      setConfirmed(false);
      onClose();
    } catch (e) {
      error('Kaydedilemedi', (e as Error).message);
    } finally {
      setPending(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="md"
      title={grant ? 'Sağlık verisi açık rızasını kaydet' : 'Açık rızanın geri çekilmesi'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Vazgeç</Button>
          <Button variant={grant ? 'primary' : 'danger'} disabled={!confirmed} loading={pending} onClick={() => void submit()}>
            {grant ? 'Açık rızayı kaydet' : 'Geri çekildi olarak kaydet'}
          </Button>
        </>
      }
    >
      <div className="space-y-4 text-sm leading-relaxed text-cocoa/85">
        {grant ? (
          <p>
            Boy, kilo, ölçüm geçmişi ve sağlık belgeleri <strong>özel nitelikli kişisel veri</strong> kapsamında değerlendirilebilir. Bu kayıtları tutmadan
            önce danışandan, aydınlatma metnine dayalı, özgür iradeyle verilmiş ve belirli konuya ilişkin <strong>açık rıza</strong> alınmış olmalıdır.
          </p>
        ) : (
          <p>
            Rıza geri çekildiğinde yeni ölçüm ve dosya eklenemez. Mevcut kayıtların silinmesi veya saklanması gerekip gerekmediğini veri saklama
            politikanıza göre değerlendirin; gerekirse ilgili kayıtları ayrıca silin.
          </p>
        )}
        <Textarea label="Not (isteğe bağlı)" rows={2} placeholder={grant ? 'Ör. Islak imzalı rıza formu dosyalandı' : 'Ör. Danışan e-posta ile bildirdi'} value={note} onChange={(e) => setNote(e.target.value)} />
        <Checkbox
          checked={confirmed}
          onChange={(e) => setConfirmed(e.target.checked)}
          label={grant ? 'Danışandan açık rızanın usulüne uygun şekilde alındığını onaylıyorum' : 'Danışanın açık rızasını geri çektiğini onaylıyorum'}
        />
      </div>
    </Modal>
  );
}

export function ConsentPanel({ client, onChanged }: { client: Client; onChanged: (c: Client) => void }) {
  const { can } = usePanelAuth();
  const [dialog, setDialog] = useState<'grant' | 'withdraw' | null>(null);
  const [pending, setPending] = useState(false);
  const { success, error } = useFeedback();

  async function recordNotice() {
    setPending(true);
    try {
      const res = await api.post<{ client: Client }>(`/clients/${client.id}/kvkk-notice`);
      onChanged(res.client);
      success('Aydınlatma metninin sunulduğu kaydedildi');
    } catch (e) {
      error('Kaydedilemedi', (e as Error).message);
    } finally {
      setPending(false);
    }
  }

  return (
    <Card>
      <CardHeader title="KVKK durumu" description="Kayıtlar tarih damgasıyla saklanır ve denetim kaydına işlenir." />
      <dl className="divide-y divide-panel-line px-5 pt-2 pb-1 text-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 py-3.5">
          <div>
            <dt className="font-semibold text-espresso">Aydınlatma metni</dt>
            <dd className="mt-0.5 text-panel-muted">{client.kvkkNoticeAt ? `Sunuldu · ${formatDateTime(client.kvkkNoticeAt)}` : 'Sunulduğuna dair kayıt yok'}</dd>
          </div>
          {client.kvkkNoticeAt ? (
            <Badge tone="success">Kayıtlı</Badge>
          ) : (
            can('clients:write') && <Button size="sm" variant="secondary" loading={pending} onClick={() => void recordNotice()}>Sunuldu olarak kaydet</Button>
          )}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 py-3.5">
          <div className="flex items-start gap-2.5">
            {client.healthConsentAt ? <ShieldCheck className="mt-0.5 h-4 w-4 text-success" aria-hidden /> : <ShieldAlert className="mt-0.5 h-4 w-4 text-warning" aria-hidden />}
            <div>
              <dt className="font-semibold text-espresso">Sağlık verisi açık rızası</dt>
              <dd className="mt-0.5 text-panel-muted">
                {client.healthConsentAt
                  ? `Alındı · ${formatDateTime(client.healthConsentAt)}${client.healthConsentNote ? ` · ${client.healthConsentNote}` : ''}`
                  : client.healthConsentWithdrawnAt
                    ? `Geri çekildi · ${formatDateTime(client.healthConsentWithdrawnAt)}`
                    : 'Alınmadı — ölçüm ve dosya kaydı kapalı'}
              </dd>
            </div>
          </div>
          {can('clinical:write') &&
            (client.healthConsentAt ? (
              <Button size="sm" variant="ghost" onClick={() => setDialog('withdraw')}>Rızanın geri çekildiğini kaydet</Button>
            ) : (
              <Button size="sm" variant="secondary" onClick={() => setDialog('grant')}>Açık rızayı kaydet</Button>
            ))}
        </div>
      </dl>
      <ConsentDialog client={client} open={!!dialog} mode={dialog ?? 'grant'} onClose={() => setDialog(null)} onChanged={onChanged} />
    </Card>
  );
}
