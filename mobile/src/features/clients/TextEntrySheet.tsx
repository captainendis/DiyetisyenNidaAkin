// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/** Not / mesaj düzenleme sayfası (isteğe bağlı görüşme seçimiyle) */
import { useEffect, useState } from 'react';
import { Button, SelectField, Sheet, TextField, type Option } from '@/components/ui';

export function TextEntrySheet({
  visible,
  title,
  initial,
  initialAppt = '',
  apptOptions,
  pending,
  maxLength,
  onClose,
  onSave,
}: {
  visible: boolean;
  title: string;
  initial: string;
  initialAppt?: string;
  apptOptions?: Option<string>[];
  pending: boolean;
  maxLength: number;
  onClose: () => void;
  onSave: (content: string, appointmentId: string) => void;
}) {
  const [content, setContent] = useState(initial);
  const [appt, setAppt] = useState(initialAppt);
  useEffect(() => {
    if (visible) {
      setContent(initial);
      setAppt(initialAppt);
    }
  }, [visible, initial, initialAppt]);
  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={title}
      footer={
        <>
          <Button title="Vazgeç" variant="secondary" onPress={onClose} style={{ flex: 1 }} />
          <Button title="Kaydet" loading={pending} disabled={!content.trim()} onPress={() => onSave(content, appt)} style={{ flex: 1 }} />
        </>
      }
    >
      <TextField label={title} rows={8} value={content} onChange={setContent} maxLength={maxLength} />
      {apptOptions ? <SelectField label="Görüşme" value={appt} options={apptOptions} onChange={setAppt} /> : null}
    </Sheet>
  );
}
