// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/** "PDF olarak paylaş": sunucunun A4 yazdırma sayfasını cihazda PDF'e çevirip paylaşım sayfasını açar */
import { useCallback, useState } from 'react';
import { useToast } from '@/components/ui';
import { errorMessage, portalApi } from '@/lib/api';

export function usePlanPdf() {
  const toast = useToast();
  const [busyId, setBusyId] = useState<string | null>(null);
  const share = useCallback(
    async (id: string, name: string) => {
      setBusyId(id);
      try {
        await portalApi.printPdf(`/plans/${id}/print`, name || 'Beslenme listesi');
      } catch (e) {
        toast(errorMessage(e), 'error');
      } finally {
        setBusyId(null);
      }
    },
    [toast],
  );
  return { share, busyId };
}
