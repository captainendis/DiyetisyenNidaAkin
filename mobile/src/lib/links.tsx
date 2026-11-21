// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/**
 * E-postadaki tek kullanımlık bağlantılar → uygulama ekranları.
 *  - https://nidaakin.com/hesabim/etkinlestir?token=…   (danışan daveti)      → /baglanti?token=…
 *  - https://nidaakin.com/hesabim/sifre-sifirla?token=… (danışan şifre sıf.)  → /baglanti?token=…
 *  - https://nidaakin.com/panel/sifre-sifirla?token=…   (personel şifre sıf.) → /sifre-yenile?token=…
 *  - nidaakin://baglanti?token=… · nidaakin://sifre-yenile?token=… (özel şema; olduğu gibi)
 * Yol dönüşümü src/app/+native-intent.tsx'te yapılır. Bu ekranlar yalnızca oturum kapalıyken açılabilir
 * (_layout.tsx → Stack.Protected); oturum açıkken bağlantıya dokunulursa <AppLinkGate/> oturumu kapatıp
 * devam etmeyi önerir.
 */
import { router } from 'expo-router';
import { useEffect, useRef, useSyncExternalStore } from 'react';
import { confirm } from '@/components/ui';
import { useAuth } from './auth';

export type AppLink = { kind: 'client' | 'staff'; href: string };

const CLIENT_PATH = /^\/(?:hesabim\/(?:etkinlestir|sifre-sifirla)|baglanti)\/?(?:[?#]|$)/;
const STAFF_PATH = /^\/(?:panel\/sifre-sifirla|sifre-yenile)\/?(?:[?#]|$)/;
const TOKEN = /[?&]token=([A-Za-z0-9_-]{20,200})(?:[&#]|$)/;

/** Sistemden gelen yol/URL bir şifre bağlantısıysa hedef ekranı döndürür; değilse null */
export function parseAppLink(input: string): AppLink | null {
  let path = input.trim();
  const m = path.match(/^([a-z][a-z0-9+.-]*):\/\/([^/?#]*)(.*)$/i);
  if (m) {
    const [, scheme, host, rest] = m;
    // https://alanadi/yol → /yol · nidaakin://baglanti?… → /baglanti?…
    path = /^https?$/i.test(scheme!) ? rest! || '/' : `/${host}${rest}`;
  } else if (!path.startsWith('/')) path = `/${path}`;
  const kind = CLIENT_PATH.test(path) ? 'client' : STAFF_PATH.test(path) ? 'staff' : null;
  if (!kind) return null;
  const token = path.match(TOKEN)?.[1];
  const screen = kind === 'client' ? '/baglanti' : '/sifre-yenile';
  return { kind, href: token ? `${screen}?token=${token}` : screen };
}

// ── Oturum açıkken gelen bağlantı ──
type Pending = AppLink & { resume?: boolean };
let pending: Pending | null = null;
const listeners = new Set<() => void>();
const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => void listeners.delete(fn);
};
const getPending = () => pending;
function setPending(p: Pending | null) {
  pending = p;
  listeners.forEach((fn) => fn());
}

/** +native-intent: gelen bağlantıyı not eder (oturum açıksa ekran korumalıdır; AppLinkGate devralır) */
export function notePendingLink(link: AppLink) {
  setPending(link);
}

/**
 * Oturum açıkken şifre bağlantısına dokunulduysa: "Oturumu kapat ve devam et" sorulur.
 * Onaylanırsa oturum kapanır ve bağlantının ekranı açılır; vazgeçilirse bağlantı yok sayılır.
 */
export function AppLinkGate() {
  const { state, logout } = useAuth();
  const link = useSyncExternalStore(subscribe, getPending);
  const asking = useRef(false);

  useEffect(() => {
    if (!link || state.status === 'loading') return;
    if (state.status === 'signedOut') {
      // Oturum kapalıyken yönlendirmeyi zaten Expo Router yaptı; yalnızca "kapat ve devam et" sonrası yönlendir
      setPending(null);
      if (link.resume) setTimeout(() => router.replace(link.href), 0);
      return;
    }
    if (asking.current || link.resume) return;
    asking.current = true;
    const name = state.status === 'staff' ? state.user.firstName : state.me.firstName;
    const what = link.kind === 'staff' ? 'bir panel hesabının şifresini yenilemek' : 'bir danışan hesabını etkinleştirmek ya da şifresini yenilemek';
    void confirm({
      title: 'Oturumu kapatıp devam edilsin mi?',
      message: `Bu bağlantı ${what} içindir. Bu cihazda şu an ${name} olarak oturum açık; devam etmek için oturum kapatılacak.`,
      confirmText: 'Oturumu kapat',
      destructive: true,
    }).then(async (ok) => {
      asking.current = false;
      if (!ok) return setPending(null);
      setPending({ ...link, resume: true });
      await logout();
    });
  }, [link, state, logout]);

  return null;
}
