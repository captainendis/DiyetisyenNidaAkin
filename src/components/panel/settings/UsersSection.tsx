// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

import { api, ApiError } from '@/lib/api';
import { useApi } from '@/hooks/useApi';
import { usePanelAuth } from '@/components/panel/PanelAuth';
import { Avatar, Badge, ErrorState, SkeletonRows, Switch, useFeedback } from '@/components/panel/ui';
import { FormCard, FormSection, Notice } from '@/components/panel/content/FormBits';
import { formatDateTime } from '@/lib/format';

interface U { id: string; email: string; firstName: string; lastName: string; isActive: boolean; lastLoginAt: string | null; role: { key: string; name: string } }

export function UsersSection() {
  const fb = useFeedback();
  const { user } = usePanelAuth();
  const res = useApi(() => api.get<{ users: U[] }>('/settings/users'), []);

  const toggle = async (u: U) => {
    if (u.isActive && !(await fb.confirm({ title: 'Kullanıcıyı devre dışı bırak', description: `${u.firstName} ${u.lastName} panele giriş yapamayacak ve açık oturumları kapatılacak.`, confirmLabel: 'Devre dışı bırak', tone: 'danger' }))) return;
    try {
      await api.patch(`/settings/users/${u.id}`, { isActive: !u.isActive });
      fb.success(u.isActive ? 'Kullanıcı devre dışı bırakıldı' : 'Kullanıcı etkinleştirildi');
      void res.reload();
    } catch (e) {
      fb.error('Güncellenemedi', e instanceof ApiError ? e.message : undefined);
    }
  };

  return (
    <FormCard>
      <FormSection title="Panel kullanıcıları" description="Panele erişimi olan kişiler. Herkese açık kayıt yoktur.">
        {res.loading && !res.data ? (
          <SkeletonRows rows={2} />
        ) : res.error ? (
          <ErrorState message={res.error.message} onRetry={res.reload} />
        ) : (
          <ul className="divide-y divide-panel-line rounded-lg border border-panel-line">
            {res.data!.users.map((u) => (
              <li key={u.id} className="flex items-center gap-3 px-4 py-3">
                <Avatar name={`${u.firstName} ${u.lastName}`} />
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-espresso">
                    {u.firstName} {u.lastName} <Badge tone={u.role.key === 'ASSISTANT' ? 'info' : 'dark'}>{u.role.name}</Badge>
                    {!u.isActive && <Badge tone="danger">Devre dışı</Badge>}
                  </p>
                  <p className="truncate text-[0.78rem] text-panel-muted">
                    {u.email} · {u.lastLoginAt ? `son giriş ${formatDateTime(u.lastLoginAt)}` : 'henüz giriş yapmadı'}
                  </p>
                </div>
                {u.id !== user?.id && <Switch checked={u.isActive} onChange={() => void toggle(u)} label={<span className="sr-only">{u.firstName} etkin</span>} />}
              </li>
            ))}
          </ul>
        )}
        <Notice>
          Yeni kullanıcı (ör. asistan) eklemek için sunucuda şu komutu çalıştırın:
          <code className="mt-1.5 block rounded bg-white px-2 py-1.5 font-mono text-[0.78rem]">ADMIN_ROLE=ASSISTANT npm run admin:create</code>
          Asistan rolü randevu ve danışan iletişim bilgilerini yönetebilir; görüşme notları, ölçümler ve dosyalara erişemez.
        </Notice>
      </FormSection>
    </FormCard>
  );
}
