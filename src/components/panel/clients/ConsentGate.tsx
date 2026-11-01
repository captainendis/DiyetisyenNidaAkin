// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

import { useState } from 'react';
import { ShieldAlert } from 'lucide-react';
import { Button, Card } from '@/components/panel/ui';
import { usePanelAuth } from '@/components/panel/PanelAuth';
import { ConsentDialog } from './ConsentPanel';
import type { Client } from './types';

/** Açık rıza yoksa sağlık verisi girişini kapatan açıklayıcı alan */
export function ConsentGate({ client, onChanged, what }: { client: Client; onChanged: (c: Client) => void; what: string }) {
  const { can } = usePanelAuth();
  const [open, setOpen] = useState(false);
  return (
    <Card className="flex flex-col items-start gap-4 p-6 sm:flex-row sm:items-center sm:p-8">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-warning/15 text-[#93682a]"><ShieldAlert className="h-5 w-5" /></span>
      <div className="flex-1">
        <p className="font-display text-[1.4rem] leading-tight text-espresso">Açık rıza kaydı olmadan {what} tutulamaz</p>
        <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-panel-muted">
          Bu bilgiler sağlık verisi niteliğinde olabilir ve KVKK kapsamında özel nitelikli kişisel veri sayılır. Danışandan aydınlatma metnine
          dayalı açık rıza alındıktan sonra bu bölümü etkinleştirebilirsiniz.
          {client.healthConsentWithdrawnAt && ' Danışan daha önce verdiği rızayı geri çekmiştir.'}
        </p>
      </div>
      {can('clinical:write') && <Button onClick={() => setOpen(true)}>Açık rıza alındı olarak işaretle</Button>}
      <ConsentDialog client={client} open={open} mode="grant" onClose={() => setOpen(false)} onChanged={onChanged} />
    </Card>
  );
}
