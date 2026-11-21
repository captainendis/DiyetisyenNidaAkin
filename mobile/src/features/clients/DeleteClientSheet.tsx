// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/** KVKK kapsamında kalıcı silme — yazılı onay ister (web: DeleteClientDialog) */
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Button, Notice, Sheet, T, TextField, useToast } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { queryClient } from '@/lib/query';
import { space } from '@/theme';
import type { Client } from './types';

export function DeleteClientSheet({ client, visible, onClose, onDeleted }: { client: Client; visible: boolean; onClose: () => void; onDeleted: () => void }) {
  const [typed, setTyped] = useState('');
  const [pending, setPending] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const toast = useToast();
  const expected = `${client.firstName} ${client.lastName}`;
  const match = typed.trim().toLocaleLowerCase('tr-TR') === expected.toLocaleLowerCase('tr-TR');

  useEffect(() => {
    if (visible) {
      setTyped('');
      setErr(null);
    }
  }, [visible]);

  async function run() {
    setPending(true);
    setErr(null);
    try {
      await api.del(`/clients/${client.id}`);
      toast('Danışan kaydı silindi · Randevu geçmişi anonimleştirildi.');
      queryClient.removeQueries({ queryKey: ['clients', client.id] });
      void queryClient.invalidateQueries({ queryKey: ['clients', 'list'] });
      onDeleted();
    } catch (e) {
      setErr(errorMessage(e));
    } finally {
      setPending(false);
    }
  }

  const bullet = (s: string) => (
    <View style={{ flexDirection: 'row', gap: space.sm }}>
      <T>•</T>
      <T style={{ flex: 1 }}>{s}</T>
    </View>
  );

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="Danışan verilerini kalıcı olarak sil"
      footer={
        <>
          <Button title="Vazgeç" variant="secondary" onPress={onClose} style={{ flex: 1 }} />
          <Button title="Kalıcı olarak sil" variant="danger" disabled={!match} loading={pending} onPress={() => void run()} style={{ flex: 1 }} />
        </>
      }
    >
      <T>Bu işlem geri alınamaz. Silinecekler:</T>
      <View style={{ gap: 4 }}>
        {bullet('Danışan kaydı ve iletişim bilgileri')}
        {bullet('Tüm görüşme notları, ölçümler ve yüklenen dosyalar')}
        {bullet('Randevu kayıtları istatistik için kalır ancak ad, telefon, e-posta ve mesajlar anonimleştirilir')}
      </View>
      <T>
        Yasal saklama yükümlülüğü bulunan kayıtlar varsa silmeden önce <T weight="bold">Veri dışa aktar</T> ile bir kopya alın.
      </T>
      <TextField label={`Onaylamak için "${expected}" yazın`} value={typed} onChange={setTyped} autoCorrect={false} autoComplete="off" />
      {err ? <Notice tone="danger" text={err} /> : null}
    </Sheet>
  );
}
