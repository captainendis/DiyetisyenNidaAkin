// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/** Danışan seçici (arama ile). Kişiye özel tarif varyasyonları için. */
import { useState } from 'react';
import { api } from '@/lib/api';
import { useApi, useDebounced } from '@/hooks/useApi';
import { Button, Input } from '@/components/panel/ui';

export interface ClientRef { id: string; firstName: string; lastName: string }

export function ClientPicker({ value, onChange, label = 'Danışan', hint, error, disabled }: {
  value: ClientRef | null;
  onChange: (c: ClientRef | null) => void;
  label?: string;
  hint?: string;
  error?: string;
  disabled?: boolean;
}) {
  const [q, setQ] = useState('');
  const dq = useDebounced(q, 250);
  const hits = useApi(
    () => (!value && dq.length >= 2 ? api.get<{ items: (ClientRef & { phone: string })[] }>('/clients', { q: dq, pageSize: 6 }) : Promise.resolve({ items: [] })),
    [dq, value],
  );
  if (value) {
    return (
      <div className="flex flex-col gap-1.5">
        <p className="text-[0.8rem] font-semibold text-cocoa">{label}</p>
        <div className="flex items-center justify-between rounded-lg border border-panel-line bg-panel-bg/40 px-3 py-2">
          <span className="text-sm font-semibold text-espresso">{value.firstName} {value.lastName}</span>
          {!disabled && <Button variant="ghost" size="sm" onClick={() => { setQ(''); onChange(null); }}>Kaldır</Button>}
        </div>
        {hint && <p className="text-[0.78rem] text-panel-muted">{hint}</p>}
      </div>
    );
  }
  return (
    <div>
      <Input label={label} placeholder="Ad, soyad veya telefon ile arayın" value={q} disabled={disabled} onChange={(e) => setQ(e.target.value)} hint={hint} error={error} />
      {!!hits.data?.items.length && (
        <ul className="mt-1.5 overflow-hidden rounded-lg border border-panel-line">
          {hits.data.items.map((c) => (
            <li key={c.id}>
              <button type="button" onClick={() => onChange(c)} className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-panel-bg">
                <span className="font-medium text-espresso">{c.firstName} {c.lastName}</span>
                <span className="tabular text-[0.78rem] text-panel-muted">{c.phone}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
