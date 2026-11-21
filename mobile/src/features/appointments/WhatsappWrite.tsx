// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/**
 * "WhatsApp'tan yaz": danışanın numarasıyla wa.me bağlantısını hazır metinle açar.
 * Metinler Ayarlar → E-posta & WhatsApp → Hazır mesajlar bölümünden düzenlenir.
 */
import { useEffect, useState } from 'react';
import { Linking, View } from 'react-native';
import {
  defaultWhatsappTemplates,
  fillTemplate,
  toWhatsappNumber,
  WHATSAPP_TEMPLATE_LABEL,
  type WhatsappTemplateKey,
  type WhatsappTemplates,
} from '@shared/whatsapp-templates';
import { Button, Card, SelectField, useToast } from '@/components/ui';
import { api } from '@/lib/api';
import { formatDayStr } from '@/lib/format';
import { useApiQuery } from '@/lib/query';
import { space } from '@/theme';
import type { AppointmentDTO } from './types';

function defaultKey(a: Pick<AppointmentDTO, 'status' | 'kind'>): WhatsappTemplateKey {
  if (a.status === 'NEW_REQUEST' || a.status === 'PENDING') return 'requestReceived';
  if (a.kind === 'PILATES') return 'pilatesInfo';
  return 'appointmentConfirmed';
}

const OPTIONS = (Object.keys(WHATSAPP_TEMPLATE_LABEL) as WhatsappTemplateKey[]).map((k) => ({ value: k, label: WHATSAPP_TEMPLATE_LABEL[k] }));

export function WhatsappWrite({ a, name }: { a: AppointmentDTO; name: string }) {
  const toast = useToast();
  const tq = useApiQuery(['settings', 'whatsapp-templates'], () => api.get<{ templates: WhatsappTemplates }>('/settings/whatsapp-templates'), { staleTime: 5 * 60_000 });
  const templates = tq.data?.templates ?? defaultWhatsappTemplates;
  const [key, setKey] = useState<WhatsappTemplateKey>(() => defaultKey(a));
  useEffect(() => setKey(defaultKey(a)), [a.id, a.status, a.kind]);

  const number = toWhatsappNumber(a.contactPhone);
  if (!number) return null;

  const open = async () => {
    const text = fillTemplate(templates[key], {
      ad: name.split(/\s+/)[0] || name,
      tarih: a.date ? formatDayStr(a.date, 'd MMMM yyyy') : 'belirlenecek tarih',
      saat: a.time ?? 'belirlenecek saat',
      referans: a.id.slice(-6).toUpperCase(),
    });
    try {
      await Linking.openURL(`https://wa.me/${number}?text=${encodeURIComponent(text)}`);
    } catch {
      toast('WhatsApp açılamadı', 'error');
    }
  };

  return (
    <Card style={{ gap: space.md }}>
      <SelectField label="WhatsApp mesajı" value={key} options={OPTIONS} onChange={setKey} />
      <View>
        <Button title="WhatsApp'tan yaz" icon="message-circle" variant="secondary" onPress={() => void open()} />
      </View>
    </Card>
  );
}
