// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

import { useState } from 'react';
import { api } from '@/lib/api';
import { Button, Input, Modal, useFeedback } from '@/components/panel/ui';
import type { Client } from './types';

/** KVKK kapsamında kalıcı silme — yazılı onay ister */
export function DeleteClientDialog({ client, open, onClose, onDeleted }: { client: Client; open: boolean; onClose: () => void; onDeleted: () => void }) {
  const [typed, setTyped] = useState('');
  const [pending, setPending] = useState(false);
  const { success, error } = useFeedback();
  const expected = `${client.firstName} ${client.lastName}`;
  const match = typed.trim().toLocaleLowerCase('tr-TR') === expected.toLocaleLowerCase('tr-TR');

  async function run() {
    setPending(true);
    try {
      await api.del(`/clients/${client.id}`);
      success('Danışan kaydı silindi', 'Randevu geçmişi anonimleştirildi.');
      onDeleted();
    } catch (e) {
      error('Silinemedi', (e as Error).message);
    } finally {
      setPending(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="md"
      title="Danışan verilerini kalıcı olarak sil"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Vazgeç</Button>
          <Button variant="danger" disabled={!match} loading={pending} onClick={() => void run()}>Kalıcı olarak sil</Button>
        </>
      }
    >
      <div className="space-y-4 text-sm leading-relaxed text-cocoa/85">
        <p>Bu işlem geri alınamaz. Silinecekler:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Danışan kaydı ve iletişim bilgileri</li>
          <li>Tüm görüşme notları, ölçümler ve yüklenen dosyalar</li>
          <li>Randevu kayıtları istatistik için kalır ancak ad, telefon, e-posta ve mesajlar anonimleştirilir</li>
        </ul>
        <p>Yasal saklama yükümlülüğü bulunan kayıtlar varsa silmeden önce <strong>Veri dışa aktar</strong> ile bir kopya alın.</p>
        <Input label={<>Onaylamak için <strong>{expected}</strong> yazın</>} value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />
      </div>
    </Modal>
  );
}
