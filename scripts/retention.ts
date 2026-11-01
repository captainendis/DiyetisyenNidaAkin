// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/**
 * KVKK veri saklama politikası uygulayıcısı
 * ──────────────────────────────────────────
 *  npm run data:retention                 → uygular
 *  npm run data:retention -- --dry-run    → yalnızca sayıları gösterir, hiçbir şeyi değiştirmez
 *  npm run data:retention -- --purge-audit-logs   → 24 aydan eski denetim kayıtlarını da siler (varsayılan: kapalı)
 *
 * Kurallar:
 *  - Durumu PASİF veya ARŞİVLENDİ olan ve son etkinliği (son randevu ya da kayıt güncellemesi)
 *    "kvkk.retentionMonths" ay öncesinden eski danışanlar anonimleştirilir:
 *      · Klinik notlar, ölçümler ve dosyalar (diskteki şifreli dosyalar dahil) kalıcı olarak silinir
 *      · Randevu kayıtları istatistik için tutulur; kimlik/iletişim bilgisi ve mesajlar silinir
 *      · Danışana bağlı bildirimler silinir, danışan kaydı silinir
 *  - 12 aydan eski ve okunmuş panel bildirimleri silinir.
 *  - Süresi dolmuş oturum ve şifre sıfırlama kayıtları temizlenir.
 *
 * Önerilen kullanım: günlük cron (ör. 03:30) — README → "Veri saklama".
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { DateTime } from 'luxon';
import { prisma } from '../server/lib/db';
import { PRIVATE_UPLOADS } from '../server/lib/storage';
import { getSetting } from '../server/services/settings';

const dryRun = process.argv.includes('--dry-run');
const purgeAudit = process.argv.includes('--purge-audit-logs');
const ANON_NAME = 'Anonimleştirilmiş Danışan';

async function main() {
  const kvkk = await getSetting('kvkk');
  const cutoff = DateTime.now().minus({ months: kvkk.retentionMonths }).toJSDate();
  console.log(`Saklama süresi: ${kvkk.retentionMonths} ay → ${cutoff.toISOString().slice(0, 10)} öncesi etkinlik${dryRun ? ' (DENEME — değişiklik yapılmayacak)' : ''}`);

  const candidates = await prisma.client.findMany({
    where: { status: { in: ['PASSIVE', 'ARCHIVED'] }, updatedAt: { lt: cutoff } },
    select: {
      id: true,
      appointments: { select: { id: true, startsAt: true, createdAt: true }, orderBy: { createdAt: 'desc' }, take: 1 },
      files: { select: { storedName: true } },
      _count: { select: { consultationNotes: true, measurements: true, appointments: true } },
    },
  });
  // Son randevusu da pencere dışında kalanlar
  const due = candidates.filter((c) => {
    const last = c.appointments[0];
    const lastActivity = last ? (last.startsAt && last.startsAt > last.createdAt ? last.startsAt : last.createdAt) : null;
    return !lastActivity || lastActivity < cutoff;
  });

  const totals = due.reduce(
    (t, c) => ({
      notes: t.notes + c._count.consultationNotes,
      measurements: t.measurements + c._count.measurements,
      files: t.files + c.files.length,
      appointments: t.appointments + c._count.appointments,
    }),
    { notes: 0, measurements: 0, files: 0, appointments: 0 },
  );
  console.log(`Anonimleştirilecek danışan: ${due.length} (not: ${totals.notes}, ölçüm: ${totals.measurements}, dosya: ${totals.files}, randevu: ${totals.appointments})`);

  const notifCutoff = DateTime.now().minus({ months: 12 }).toJSDate();
  const oldNotifications = await prisma.notification.count({ where: { readAt: { not: null }, createdAt: { lt: notifCutoff } } });
  console.log(`Silinecek eski (okunmuş, 12 aydan eski) bildirim: ${oldNotifications}`);

  const auditCutoff = DateTime.now().minus({ months: 24 }).toJSDate();
  const oldAudit = purgeAudit ? await prisma.auditLog.count({ where: { createdAt: { lt: auditCutoff } } }) : 0;
  if (purgeAudit) console.log(`Silinecek 24 aydan eski denetim kaydı: ${oldAudit}`);

  if (dryRun) return;

  for (const c of due) {
    await prisma.$transaction(async (tx) => {
      const appts = await tx.appointment.findMany({ where: { clientId: c.id }, select: { id: true } });
      const apptIds = appts.map((a) => a.id);
      await tx.notification.deleteMany({ where: { OR: [{ clientId: c.id }, { appointmentId: { in: apptIds } }] } });
      await tx.appointmentStatusHistory.updateMany({ where: { appointmentId: { in: apptIds } }, data: { note: null } });
      await tx.appointment.updateMany({
        where: { id: { in: apptIds } },
        data: { clientId: null, contactName: ANON_NAME, contactPhone: '-', contactEmail: null, clientMessage: null, internalNote: null },
      });
      await tx.consultationNote.deleteMany({ where: { clientId: c.id } });
      await tx.measurement.deleteMany({ where: { clientId: c.id } });
      await tx.clientFile.deleteMany({ where: { clientId: c.id } });
      await tx.client.delete({ where: { id: c.id } });
      await tx.auditLog.create({
        data: { action: 'client.anonymized_retention', entityType: 'client', entityId: c.id, metadata: { appointments: apptIds.length } },
      });
    });
    for (const f of c.files) await fs.unlink(path.join(PRIVATE_UPLOADS, path.basename(f.storedName))).catch(() => {});
  }

  const n = await prisma.notification.deleteMany({ where: { readAt: { not: null }, createdAt: { lt: notifCutoff } } });
  if (purgeAudit) await prisma.auditLog.deleteMany({ where: { createdAt: { lt: auditCutoff } } });
  await prisma.session.deleteMany({ where: { expiresAt: { lt: new Date() } } });
  await prisma.passwordResetToken.deleteMany({ where: { expiresAt: { lt: new Date() } } });
  await prisma.auditLog.create({
    data: { action: 'retention.run', entityType: 'system', metadata: { clients: due.length, notifications: n.count, auditPurged: purgeAudit ? oldAudit : 0 } },
  });
  console.log('✓ Saklama politikası uygulandı.');
}

main()
  .catch((e) => {
    console.error('✖', e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
