// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/**
 * Sunucu erişimi olan yöneticinin bir kullanıcının şifresini sıfırlaması (SMTP yapılandırılmamışsa).
 *  npm run admin:reset-password
 */
import { prisma } from '../server/lib/db';
import { hashPassword } from '../server/lib/crypto';
import { emailSchema, passwordPolicy } from '../shared/schemas';
import { ask } from './prompt';

async function main() {
  const email = emailSchema.parse(process.env.ADMIN_EMAIL ?? (await ask('Kullanıcı e-postası: ')));
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new Error('Kullanıcı bulunamadı.');
  const password = process.env.ADMIN_PASSWORD ?? (await ask('Yeni şifre: ', { hidden: true }));
  const check = passwordPolicy.safeParse(password);
  if (!check.success) throw new Error(check.error.issues[0].message);
  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await hashPassword(password), passwordChangedAt: new Date(), failedLoginCount: 0, lockedUntil: null },
    }),
    prisma.session.deleteMany({ where: { userId: user.id } }),
    prisma.auditLog.create({ data: { action: 'auth.password_reset_via_cli', entityType: 'user', entityId: user.id } }),
  ]);
  console.log('✓ Şifre güncellendi; açık oturumlar kapatıldı.');
}

main()
  .catch((e) => {
    console.error('✖', e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
