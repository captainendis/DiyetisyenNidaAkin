/** Denetim kaydı (audit log). Hassas içerik (not metni, ölçüm değeri) ASLA metadata'ya yazılmaz. */
import type { Request } from 'express';
import { prisma, type Tx } from './db';

export async function audit(
  req: Request | null,
  action: string,
  entityType: string,
  entityId?: string | null,
  metadata?: Record<string, unknown>,
  tx?: Tx,
) {
  const db = tx ?? prisma;
  try {
    await db.auditLog.create({
      data: {
        userId: req?.user?.id ?? null,
        action,
        entityType,
        entityId: entityId ?? null,
        metadata: (metadata ?? undefined) as never,
        ip: req?.ip ?? null,
        userAgent: req?.get('user-agent')?.slice(0, 300) ?? null,
      },
    });
  } catch (e) {
    console.error('Audit log yazılamadı', e);
  }
}
