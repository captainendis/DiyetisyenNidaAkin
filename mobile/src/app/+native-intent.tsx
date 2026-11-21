// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/**
 * Sistemden gelen bağlantıları (iOS Universal Links, Android App Links, nidaakin:// şeması) uygulama
 * ekranlarına çevirir. E-postadaki /hesabim/etkinlestir, /hesabim/sifre-sifirla ve /panel/sifre-sifirla
 * bağlantıları oturum gerektiren hesabim/panel bölümlerine değil, (auth) içindeki şifre ekranlarına gider.
 * Diğer yollar olduğu gibi bırakılır. Ayrıntı: src/lib/links.tsx
 */
import { notePendingLink, parseAppLink } from '@/lib/links';

export function redirectSystemPath({ path }: { path: string; initial: boolean }) {
  try {
    const link = parseAppLink(path);
    if (!link) return path;
    notePendingLink(link);
    return link.href;
  } catch {
    return path;
  }
}
