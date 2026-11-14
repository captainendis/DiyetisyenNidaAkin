// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/** Denetim kaydı (audit log). Hassas içerik (not metni, ölçüm değeri) ASLA metadata'ya yazılmaz. */
import { prisma, type Tx } from './db';
import { clientIp, userAgent, type Ctx } from './http';

export async function audit(
  c: Ctx | null,
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
        userId: c?.var.user?.id ?? null,
        action,
        entityType,
        entityId: entityId ?? null,
        metadata: (metadata ?? undefined) as never,
        ip: c ? clientIp(c) : null,
        userAgent: c ? userAgent(c) : null,
      },
    });
  } catch (e) {
    console.error('Audit log yazılamadı', e);
  }
}
