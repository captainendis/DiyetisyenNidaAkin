// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/**
 * "WhatsApp'tan yaz": danışanın numarasıyla wa.me bağlantısını hazır metinle yeni sekmede açar.
 * Ek hesap gerekmez; metinler Ayarlar → E-posta & WhatsApp → Hazır mesajlar bölümünden düzenlenir.
 */
import { useEffect, useState } from 'react';
import { MessageCircle } from 'lucide-react';
import { api } from '@/lib/api';
import { formatDayStr } from '@/lib/format';
import {
  defaultWhatsappTemplates, fillTemplate, toWhatsappNumber, WHATSAPP_TEMPLATE_LABEL, type WhatsappTemplateKey, type WhatsappTemplates,
} from '@shared/whatsapp-templates';
import { Button, Select } from '../ui';
import type { AppointmentDTO } from './types';

function defaultKey(a: Pick<AppointmentDTO, 'status' | 'kind'>): WhatsappTemplateKey {
  if (a.status === 'NEW_REQUEST' || a.status === 'PENDING') return 'requestReceived';
  if (a.kind === 'PILATES') return 'pilatesInfo';
  return 'appointmentConfirmed';
}

const OPTIONS = (Object.keys(WHATSAPP_TEMPLATE_LABEL) as WhatsappTemplateKey[]).map((k) => ({ value: k, label: WHATSAPP_TEMPLATE_LABEL[k] }));

export function WhatsappWrite({ a, name }: { a: AppointmentDTO; name: string }) {
  const [templates, setTemplates] = useState<WhatsappTemplates>(defaultWhatsappTemplates);
  const [key, setKey] = useState<WhatsappTemplateKey>(() => defaultKey(a));
  useEffect(() => setKey(defaultKey(a)), [a.id, a.status, a.kind]);
  useEffect(() => {
    api.get<{ templates: WhatsappTemplates }>('/settings/whatsapp-templates').then((r) => setTemplates(r.templates)).catch(() => {});
  }, []);

  const number = toWhatsappNumber(a.contactPhone);
  if (!number) return null;

  const open = () => {
    const text = fillTemplate(templates[key], {
      ad: name.split(/\s+/)[0] || name,
      tarih: a.date ? formatDayStr(a.date, 'd MMMM yyyy') : 'belirlenecek tarih',
      saat: a.time ?? 'belirlenecek saat',
      referans: a.id.slice(-6).toUpperCase(),
    });
    window.open(`https://wa.me/${number}?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="flex flex-wrap items-end gap-2 rounded-xl border border-panel-line bg-panel-bg/60 p-3">
      <Select label="WhatsApp mesajı" wrapperClassName="min-w-[12rem]" value={key} onChange={(e) => setKey(e.target.value as WhatsappTemplateKey)} options={OPTIONS} />
      <Button variant="secondary" icon={<MessageCircle className="h-4 w-4" />} onClick={open}>WhatsApp&apos;tan yaz</Button>
    </div>
  );
}
