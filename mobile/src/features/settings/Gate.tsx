// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/** İzin kapısı (web: RequirePermission) — izni olmayan kullanıcıya içerik yerine bilgi gösterir */
import type { ReactNode } from 'react';
import { Empty, Screen } from '@/components/ui';
import { useStaff, type Permission } from '@/lib/auth';

export function RequirePermission({ perm, children }: { perm: Permission | Permission[]; children: ReactNode }) {
  const { can } = useStaff();
  const ok = (Array.isArray(perm) ? perm : [perm]).every((p) => can(p));
  if (!ok) {
    return (
      <Screen>
        <Empty icon="lock" title="Bu sayfaya erişiminiz yok" text="Bu bölümü görüntülemek için gerekli yetkiniz bulunmuyor. Gerekirse yöneticinizle iletişime geçin." />
      </Screen>
    );
  }
  return <>{children}</>;
}
