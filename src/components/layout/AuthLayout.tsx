import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { Logo, LogoMark } from '@/components/icons/Logo';
import { VENUE } from '@/config/media';
import { Picture } from '@/components/sections/Picture';

/** Panel giriş/şifre ekranları için ayrık düzen: solda marka paneli, sağda form */
export function AuthLayout({ title, description, children }: { title: string; description?: ReactNode; children: ReactNode }) {
  return (
    <div className="panel-root grid min-h-dvh bg-panel-bg text-espresso lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <meta name="robots" content="noindex, nofollow" />
      <aside className="grain relative hidden overflow-hidden bg-espresso text-cream lg:flex lg:flex-col lg:justify-between lg:p-14 xl:p-16">
        <Picture {...VENUE.facade} sizes="45vw" className="absolute inset-0" imgClassName="h-full w-full object-cover opacity-40" />
        <div className="absolute inset-0 bg-gradient-to-t from-espresso via-espresso/70 to-espresso/40" aria-hidden />
        <Link to="/" className="relative z-[2]" aria-label="Web sitesine dön"><Logo /></Link>
        <div className="relative z-[2] max-w-md">
          <p className="font-display text-[3.2rem] leading-[1.02] font-medium text-ivory xl:text-[3.8rem]">
            Hoş geldiniz,<br /><em className="font-normal text-rose">bugün kimleri ağırlıyoruz?</em>
          </p>
          <p className="mt-6 text-[0.95rem] leading-relaxed text-mist">Randevularınızı, danışanlarınızı ve web sitenizi tek bir yerden yönetin.</p>
        </div>
        <p className="relative z-[2] text-[0.75rem] text-mist/70">Yalnızca yetkili kullanıcılar içindir. Tüm erişimler kayıt altına alınır.</p>
      </aside>
      <main className="flex min-h-dvh flex-col px-6 py-10 sm:px-12 lg:px-16 xl:px-24">
        <div className="flex items-center justify-between lg:hidden">
          <Link to="/" className="flex items-center gap-3 text-espresso" aria-label="Web sitesine dön">
            <LogoMark className="h-9 w-9 text-rose-deep" />
            <span className="font-display text-[1.4rem]">Nida Akın</span>
          </Link>
        </div>
        <div className="mx-auto flex w-full max-w-[420px] flex-1 flex-col justify-center py-12">
          <h1 className="font-display text-[2.6rem] leading-tight font-medium">{title}</h1>
          {description && <div className="mt-2 text-[0.95rem] text-panel-muted">{description}</div>}
          <div className="mt-10">{children}</div>
        </div>
        <p className="text-center text-[0.75rem] text-panel-muted lg:text-left">
          <Link to="/" className="hover:text-cocoa">← Web sitesine dön</Link>
        </p>
      </main>
    </div>
  );
}
