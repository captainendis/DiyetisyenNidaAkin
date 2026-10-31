/** Yeni beslenme planı: danışan (isteğe bağlı) + kaynak (şablon / boş) */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { api, ApiError } from '@/lib/api';
import { useApi, useDebounced } from '@/hooks/useApi';
import { Button, Checkbox, Input, Modal, Select, useFeedback } from '@/components/panel/ui';
import type { PlanListItem } from './api';

interface ClientHit { id: string; firstName: string; lastName: string; phone: string }

export function NewPlanModal({
  open, onClose, clientId: fixedClientId, clientName, defaultTemplate = false,
}: { open: boolean; onClose: () => void; clientId?: string | null; clientName?: string; defaultTemplate?: boolean }) {
  const nav = useNavigate();
  const fb = useFeedback();
  const [q, setQ] = useState('');
  const dq = useDebounced(q, 250);
  const [client, setClient] = useState<ClientHit | null>(null);
  const [asTemplate, setAsTemplate] = useState(defaultTemplate);
  const [name, setName] = useState('');
  const [fromId, setFromId] = useState('');
  const [pending, setPending] = useState(false);
  const [err, setErr] = useState<Record<string, string>>({});

  const templates = useApi(() => (open ? api.get<{ items: PlanListItem[] }>('/plans', { templates: '1' }) : Promise.resolve({ items: [] })), [open]);
  const hits = useApi(
    () => (open && !fixedClientId && !asTemplate && dq.length >= 2 ? api.get<{ items: ClientHit[] }>('/clients', { q: dq, pageSize: 6 }) : Promise.resolve({ items: [] })),
    [open, dq, fixedClientId, asTemplate],
  );

  useEffect(() => {
    if (!open) return;
    setQ(''); setClient(null); setAsTemplate(defaultTemplate); setName(''); setErr({});
  }, [open, defaultTemplate]);
  useEffect(() => {
    // Varsayılan kaynak: ilk şablon
    if (templates.data?.items.length && !fromId) setFromId(templates.data.items[0]!.id);
  }, [templates.data, fromId]);

  const targetClientId = fixedClientId ?? client?.id ?? null;

  const create = async () => {
    setErr({});
    if (!name.trim()) return setErr({ name: 'Plan adı gerekli (ör. “1. ay, 1. liste”)' });
    if (!asTemplate && !targetClientId) return setErr({ client: 'Bir danışan seçin ya da şablon olarak kaydedin' });
    setPending(true);
    try {
      const res = await api.post<{ plan: PlanListItem }>('/plans', {
        clientId: asTemplate ? null : targetClientId,
        isTemplate: asTemplate,
        name: name.trim(),
        fromId: fromId || null,
      });
      onClose();
      nav(`/panel/planlar/${res.plan.id}`);
    } catch (e) {
      if (e instanceof ApiError && e.status === 422) setErr(e.fields);
      else fb.error('Plan oluşturulamadı', e instanceof ApiError ? e.message : undefined);
    } finally {
      setPending(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={fixedClientId ? `${clientName ?? 'Danışan'} için yeni plan` : 'Yeni beslenme planı'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Vazgeç</Button>
          <Button onClick={() => void create()} loading={pending} data-autofocus>Oluştur ve düzenle</Button>
        </>
      }
    >
      <div className="space-y-4">
        {!fixedClientId && (
          <Checkbox
            label="Şablon olarak oluştur"
            description="Danışana bağlı olmayan, yeni planlara temel olacak liste."
            checked={asTemplate}
            onChange={(e) => setAsTemplate(e.target.checked)}
          />
        )}
        {!fixedClientId && !asTemplate && (
          <div>
            {client ? (
              <div className="flex items-center justify-between rounded-lg border border-panel-line px-3 py-2.5">
                <span className="text-sm font-semibold text-espresso">{client.firstName} {client.lastName}</span>
                <Button variant="ghost" size="sm" onClick={() => setClient(null)}>Değiştir</Button>
              </div>
            ) : (
              <>
                <Input label="Danışan" required placeholder="Ad, soyad veya telefon ile arayın" value={q} onChange={(e) => setQ(e.target.value)} error={err.client} />
                {!!hits.data?.items.length && (
                  <ul className="mt-1.5 overflow-hidden rounded-lg border border-panel-line">
                    {hits.data.items.map((c) => (
                      <li key={c.id}>
                        <button type="button" onClick={() => setClient(c)} className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-panel-bg">
                          <span className="font-medium text-espresso">{c.firstName} {c.lastName}</span>
                          <span className="tabular text-[0.78rem] text-panel-muted">{c.phone}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </div>
        )}
        <Input label="Plan adı" required placeholder="1. ay, 1. liste" value={name} maxLength={80} error={err.name} onChange={(e) => setName(e.target.value)} hint="Yalnızca panelde listeleme için kullanılır." />
        <Select
          label="Başlangıç"
          value={fromId}
          onChange={(e) => setFromId(e.target.value)}
          options={[...(templates.data?.items ?? []).map((t) => ({ value: t.id, label: `Şablon: ${t.name}` })), { value: '', label: 'Boş plan' }]}
          hint="Şablonun içeriği kopyalanır; şablonun kendisi değişmez."
        />
      </div>
    </Modal>
  );
}
