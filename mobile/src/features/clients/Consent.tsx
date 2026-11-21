// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/** KVKK durumu: aydınlatma metni ve sağlık verisi açık rızası (web: ConsentPanel, ConsentGate) */
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Badge, Button, Card, Icon, Notice, Sheet, SwitchField, T, TextField, useToast } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { useStaff } from '@/lib/auth';
import { formatDateTime } from '@/lib/format';
import { colors, fonts, space } from '@/theme';
import { CardTitle } from './common';
import type { Client } from './types';

export function ConsentSheet({ client, visible, onClose, onChanged, mode }: { client: Client; visible: boolean; onClose: () => void; onChanged: (c: Client) => void; mode: 'grant' | 'withdraw' }) {
  const [note, setNote] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [pending, setPending] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const toast = useToast();
  const grant = mode === 'grant';

  useEffect(() => {
    if (visible) {
      setNote('');
      setConfirmed(false);
      setErr(null);
    }
  }, [visible]);

  async function submit() {
    setPending(true);
    setErr(null);
    try {
      const res = await api.post<{ client: Client }>(`/clients/${client.id}/health-consent`, { granted: grant, note: note || null });
      toast(grant ? 'Açık rıza kaydedildi' : 'Açık rızanın geri çekildiği kaydedildi');
      onChanged(res.client);
      onClose();
    } catch (e) {
      setErr(errorMessage(e));
    } finally {
      setPending(false);
    }
  }

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={grant ? 'Sağlık verisi açık rızasını kaydet' : 'Açık rızanın geri çekilmesi'}
      footer={
        <>
          <Button title="Vazgeç" variant="secondary" onPress={onClose} style={{ flex: 1 }} />
          <Button
            title={grant ? 'Açık rızayı kaydet' : 'Geri çekildi olarak kaydet'}
            variant={grant ? 'primary' : 'danger'}
            disabled={!confirmed}
            loading={pending}
            onPress={() => void submit()}
            style={{ flex: 1 }}
          />
        </>
      }
    >
      {grant ? (
        <T>
          Boy, kilo, ölçüm geçmişi ve sağlık belgeleri <T weight="bold">özel nitelikli kişisel veri</T> kapsamında değerlendirilebilir. Bu kayıtları tutmadan önce
          danışandan, aydınlatma metnine dayalı, özgür iradeyle verilmiş ve belirli konuya ilişkin <T weight="bold">açık rıza</T> alınmış olmalıdır.
        </T>
      ) : (
        <T>
          Rıza geri çekildiğinde yeni ölçüm ve dosya eklenemez. Mevcut kayıtların silinmesi veya saklanması gerekip gerekmediğini veri saklama politikanıza göre
          değerlendirin; gerekirse ilgili kayıtları ayrıca silin.
        </T>
      )}
      <TextField
        label="Not (isteğe bağlı)"
        rows={2}
        placeholder={grant ? 'Ör. Islak imzalı rıza formu dosyalandı' : 'Ör. Danışan e-posta ile bildirdi'}
        value={note}
        onChange={setNote}
      />
      <SwitchField
        label={grant ? 'Danışandan açık rızanın usulüne uygun şekilde alındığını onaylıyorum' : 'Danışanın açık rızasını geri çektiğini onaylıyorum'}
        value={confirmed}
        onChange={setConfirmed}
      />
      {err ? <Notice tone="danger" text={err} /> : null}
    </Sheet>
  );
}

export function ConsentPanel({ client, onChanged }: { client: Client; onChanged: (c: Client) => void }) {
  const { can } = useStaff();
  const [dialog, setDialog] = useState<'grant' | 'withdraw' | null>(null);
  const [pending, setPending] = useState(false);
  const toast = useToast();

  async function recordNotice() {
    setPending(true);
    try {
      const res = await api.post<{ client: Client }>(`/clients/${client.id}/kvkk-notice`);
      onChanged(res.client);
      toast('Aydınlatma metninin sunulduğu kaydedildi');
    } catch (e) {
      toast(errorMessage(e), 'error');
    } finally {
      setPending(false);
    }
  }

  return (
    <Card>
      <CardTitle title="KVKK durumu" text="Kayıtlar tarih damgasıyla saklanır ve denetim kaydına işlenir." />
      <View style={{ gap: space.lg }}>
        <View style={{ gap: space.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md }}>
            <T variant="subheading">Aydınlatma metni</T>
            {client.kvkkNoticeAt ? <Badge label="Kayıtlı" tone="success" /> : null}
          </View>
          <T variant="caption">{client.kvkkNoticeAt ? `Sunuldu · ${formatDateTime(client.kvkkNoticeAt)}` : 'Sunulduğuna dair kayıt yok'}</T>
          {!client.kvkkNoticeAt && can('clients:write') ? (
            <Button title="Sunuldu olarak kaydet" size="sm" variant="secondary" loading={pending} onPress={() => void recordNotice()} style={{ alignSelf: 'flex-start' }} />
          ) : null}
        </View>
        <View style={{ gap: space.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
            <Icon name={client.healthConsentAt ? 'shield' : 'alert-triangle'} size={16} color={client.healthConsentAt ? colors.successInk : colors.warningInk} />
            <T variant="subheading" style={{ flex: 1 }}>Sağlık verisi açık rızası</T>
            <Badge label={client.healthConsentAt ? 'Alındı' : 'Yok'} tone={client.healthConsentAt ? 'success' : 'warning'} />
          </View>
          <T variant="caption">
            {client.healthConsentAt
              ? `Alındı · ${formatDateTime(client.healthConsentAt)}${client.healthConsentNote ? ` · ${client.healthConsentNote}` : ''}`
              : client.healthConsentWithdrawnAt
                ? `Geri çekildi · ${formatDateTime(client.healthConsentWithdrawnAt)}`
                : 'Alınmadı, ölçüm ve dosya kaydı kapalı'}
          </T>
          {can('clinical:write') ? (
            client.healthConsentAt ? (
              <Button title="Rızanın geri çekildiğini kaydet" size="sm" variant="ghost" onPress={() => setDialog('withdraw')} style={{ alignSelf: 'flex-start', paddingHorizontal: 0 }} />
            ) : (
              <Button title="Açık rızayı kaydet" size="sm" variant="secondary" onPress={() => setDialog('grant')} style={{ alignSelf: 'flex-start' }} />
            )
          ) : null}
        </View>
      </View>
      <ConsentSheet client={client} visible={!!dialog} mode={dialog ?? 'grant'} onClose={() => setDialog(null)} onChanged={onChanged} />
    </Card>
  );
}

/** Açık rıza yoksa sağlık verisi girişini kapatan açıklayıcı alan */
export function ConsentGate({ client, onChanged, what }: { client: Client; onChanged: (c: Client) => void; what: string }) {
  const { can } = useStaff();
  const [open, setOpen] = useState(false);
  return (
    <Card style={{ marginBottom: space.lg, gap: space.md }}>
      <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.warningBg, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name="shield-off" size={20} color={colors.warningInk} />
      </View>
      <T style={{ fontFamily: fonts.display, fontSize: 22, lineHeight: 26, color: colors.text }}>Açık rıza kaydı olmadan {what} tutulamaz</T>
      <T variant="caption">
        Bu bilgiler sağlık verisi niteliğinde olabilir ve KVKK kapsamında özel nitelikli kişisel veri sayılır. Danışandan aydınlatma metnine dayalı açık rıza
        alındıktan sonra bu bölümü etkinleştirebilirsiniz.
        {client.healthConsentWithdrawnAt ? ' Danışan daha önce verdiği rızayı geri çekmiştir.' : ''}
      </T>
      {can('clinical:write') ? <Button title="Açık rıza alındı olarak işaretle" onPress={() => setOpen(true)} /> : null}
      <ConsentSheet client={client} visible={open} mode="grant" onClose={() => setOpen(false)} onChanged={onChanged} />
    </Card>
  );
}
