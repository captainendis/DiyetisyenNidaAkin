// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/**
 * Panel kullanıcıları (users:manage — yönetici). Yeni kullanıcı panelden eklenir: sistem tek kullanımlık bir
 * şifre belirleme bağlantısı üretir, yönetici bunu iletir, kullanıcı şifresini kendisi koyar.
 */
import { useState, type FormEvent } from 'react';
import { Copy, Link2, UserPlus } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { useApi } from '@/hooks/useApi';
import { usePanelAuth } from '@/components/panel/PanelAuth';
import { Avatar, Badge, Button, ErrorState, Input, Select, SkeletonRows, Switch, useFeedback } from '@/components/panel/ui';
import { FormCard, FormSection } from '@/components/panel/content/FormBits';
import { formatDateTime } from '@/lib/format';

interface U { id: string; email: string; firstName: string; lastName: string; isActive: boolean; lastLoginAt: string | null; role: { key: string; name: string } }
interface LinkResult { link: string; expiresAt: string; emailed: boolean }

const ROLE_OPTIONS = [
  { value: 'ASSISTANT', label: 'Asistan: randevular ve danışan iletişim bilgileri' },
  { value: 'DIETITIAN', label: 'Diyetisyen: klinik kayıtlar dahil her şey (kullanıcı yönetimi hariç)' },
  { value: 'ADMIN', label: 'Yönetici: her şey, kullanıcı ve danışan hesabı yönetimi dahil' },
];

function LinkBox({ name, result, onClose }: { name: string; result: LinkResult; onClose: () => void }) {
  const fb = useFeedback();
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(result.link);
      fb.success('Bağlantı kopyalandı');
    } catch {
      fb.error('Kopyalanamadı', 'Bağlantıyı seçip elle kopyalayın.');
    }
  };
  return (
    <div className="rounded-lg border border-success/30 bg-success/[0.07] p-4">
      <p className="text-sm font-semibold text-success-ink">{name} için şifre belirleme bağlantısı</p>
      <p className="mt-1 text-[0.8rem] leading-relaxed text-cocoa">
        Tek kullanımlık; {formatDateTime(result.expiresAt)} tarihine kadar geçerli ve yalnızca şimdi gösteriliyor.
        {result.emailed ? ' Kişinin e-postasına da gönderildi.' : ' Bağlantıyı kişiye siz iletin.'}
      </p>
      <input readOnly value={result.link} onFocus={(e) => e.currentTarget.select()} aria-label="Bağlantı" className="mt-3 h-10 w-full rounded-lg border border-panel-line bg-white px-3 font-mono text-[0.75rem] text-espresso" />
      <div className="mt-3 flex gap-2">
        <Button size="sm" icon={<Copy className="h-4 w-4" />} onClick={() => void copy()}>Kopyala</Button>
        <Button size="sm" variant="ghost" onClick={onClose}>Kapat</Button>
      </div>
    </div>
  );
}

const EMPTY = { firstName: '', lastName: '', email: '', role: 'ASSISTANT' };

export function UsersSection() {
  const fb = useFeedback();
  const { user } = usePanelAuth();
  const res = useApi(() => api.get<{ users: U[] }>('/settings/users'), []);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState<string | null>(null);
  const [link, setLink] = useState<{ name: string; result: LinkResult } | null>(null);

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

  const create = async (e: FormEvent) => {
    e.preventDefault();
    setErrors({});
    setPending('create');
    try {
      const r = await api.post<{ user: U; link: LinkResult }>('/settings/users', form);
      setLink({ name: `${r.user.firstName} ${r.user.lastName}`, result: r.link });
      setForm(EMPTY);
      setAdding(false);
      fb.success('Kullanıcı eklendi');
      void res.reload();
    } catch (err) {
      if (err instanceof ApiError) setErrors(err.fields);
      fb.error('Kullanıcı eklenemedi', err instanceof ApiError ? err.message : undefined);
    } finally {
      setPending(null);
    }
  };

  const newLink = async (u: U) => {
    setPending(u.id);
    try {
      const r = await api.post<{ link: LinkResult }>(`/settings/users/${u.id}/link`);
      setLink({ name: `${u.firstName} ${u.lastName}`, result: r.link });
    } catch (err) {
      fb.error('Bağlantı üretilemedi', err instanceof ApiError ? err.message : undefined);
    } finally {
      setPending(null);
    }
  };

  return (
    <FormCard>
      <FormSection
        title="Panel kullanıcıları"
        description="Panele erişimi olan kişiler. Yeni kullanıcı şifresini kendisine ilettiğiniz bağlantıyla belirler."
      >
        {link && <LinkBox name={link.name} result={link.result} onClose={() => setLink(null)} />}

        {res.loading && !res.data ? (
          <SkeletonRows rows={2} />
        ) : res.error ? (
          <ErrorState message={res.error.message} onRetry={res.reload} />
        ) : (
          <ul className="divide-y divide-panel-line rounded-lg border border-panel-line">
            {res.data!.users.map((u) => (
              <li key={u.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
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
                {u.id !== user?.id && (
                  <div className="flex items-center gap-3">
                    {u.isActive && (
                      <Button size="sm" variant="secondary" icon={<Link2 className="h-4 w-4" />} loading={pending === u.id} onClick={() => void newLink(u)}>
                        Şifre bağlantısı
                      </Button>
                    )}
                    <Switch checked={u.isActive} onChange={() => void toggle(u)} label={<span className="sr-only">{u.firstName} etkin</span>} />
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}

        {adding ? (
          <form onSubmit={create} noValidate className="space-y-4 rounded-lg border border-panel-line p-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Input label="Ad" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} error={errors.firstName} required autoFocus />
              <Input label="Soyad" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} error={errors.lastName} required />
            </div>
            <Input label="E-posta" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} error={errors.email} hint="Kişi panele bu adresle giriş yapar." required />
            <Select label="Rol" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} options={ROLE_OPTIONS} error={errors.role} />
            <div className="flex gap-2">
              <Button type="submit" loading={pending === 'create'}>Ekle ve bağlantı üret</Button>
              <Button variant="ghost" onClick={() => { setAdding(false); setErrors({}); }}>Vazgeç</Button>
            </div>
          </form>
        ) : (
          <Button variant="secondary" icon={<UserPlus className="h-4 w-4" />} onClick={() => setAdding(true)}>Kullanıcı ekle</Button>
        )}
      </FormSection>
    </FormCard>
  );
}
