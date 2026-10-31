import { useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router';
import { api, ApiError } from '@/lib/api';
import { passwordPolicy } from '@shared/schemas';
import { AuthLayout } from '@/components/layout/AuthLayout';
import { Button, Input } from '@/components/panel/ui';

export default function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [fields, setFields] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const p = passwordPolicy.safeParse(password);
    const f: Record<string, string> = {};
    if (!p.success) f.password = p.error.issues[0].message;
    if (password !== confirm) f.confirm = 'Şifreler eşleşmiyor';
    setFields(f);
    if (Object.keys(f).length) return;
    setPending(true);
    try {
      await api.post('/auth/reset-password', { token, password });
      setDone(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Şifre güncellenemedi.');
    } finally {
      setPending(false);
    }
  };

  if (!token) {
    return (
      <AuthLayout title="Bağlantı geçersiz" description="Şifre sıfırlama bağlantısı eksik veya hatalı.">
        <Link to="/panel/sifremi-unuttum" className="text-sm font-medium text-cocoa underline underline-offset-4">Yeni bağlantı isteyin</Link>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Yeni şifre belirleyin" description="En az 10 karakter; en az bir harf ve bir rakam içermeli.">
      {done ? (
        <div className="space-y-6">
          <div className="rounded-lg border border-success/30 bg-success/10 px-4 py-4 text-sm text-[#3e5f47]" role="status">
            Şifreniz güncellendi. Güvenliğiniz için tüm açık oturumlar kapatıldı.
          </div>
          <Link to="/panel/giris" className="inline-flex h-11 w-full items-center justify-center rounded-lg bg-cocoa text-sm font-semibold text-ivory hover:bg-espresso">Giriş yap</Link>
        </div>
      ) : (
        <form onSubmit={submit} noValidate className="space-y-5">
          {error && <div className="rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-[#8a4545]" role="alert">{error}</div>}
          <Input label="Yeni şifre" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} error={fields.password} required autoFocus />
          <Input label="Yeni şifre (tekrar)" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} error={fields.confirm} required />
          <Button type="submit" loading={pending} className="h-11 w-full">Şifreyi güncelle</Button>
        </form>
      )}
    </AuthLayout>
  );
}
