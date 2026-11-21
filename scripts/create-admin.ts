// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

/**
 * İlk yönetici hesabını güvenli şekilde oluşturur. Herkese açık kayıt yoktur.
 *
 *  Etkileşimli:   npm run admin:create
 *  Otomasyon:     ADMIN_EMAIL=... ADMIN_PASSWORD=... ADMIN_FIRST_NAME=Nida ADMIN_LAST_NAME=Akın npm run admin:create
 *                 (Şifreyi kabuk geçmişine yazmamak için etkileşimli kullanım önerilir.)
 *  Ek kullanıcı:  ... ADMIN_ROLE=ASSISTANT npm run admin:create
 */
import { prisma } from '../server/lib/db';
import { hashPassword } from '../server/lib/crypto';
import { emailSchema, passwordPolicy } from '../shared/schemas';
import { ask } from './prompt';

async function main() {
  const roleKey = (process.env.ADMIN_ROLE ?? 'ADMIN') as 'ADMIN' | 'DIETITIAN' | 'ASSISTANT' | 'REVIEWER';
  const role = await prisma.role.findUnique({ where: { key: roleKey } });
  if (!role) throw new Error('Roller bulunamadı. Önce `npm run db:seed` çalıştırın.');

  if (roleKey === 'ADMIN' && (await prisma.user.count({ where: { role: { key: 'ADMIN' } } })) > 0 && process.env.ALLOW_ADDITIONAL_ADMIN !== '1') {
    throw new Error('Zaten bir yönetici hesabı var. Ek yönetici için ALLOW_ADDITIONAL_ADMIN=1 ile çalıştırın.');
  }

  const email = emailSchema.parse(process.env.ADMIN_EMAIL ?? (await ask('E-posta: ')));
  if (await prisma.user.findUnique({ where: { email } })) throw new Error('Bu e-posta ile bir kullanıcı zaten var.');
  const firstName = process.env.ADMIN_FIRST_NAME ?? ((await ask('Ad (varsayılan: Nida): ')) || 'Nida');
  const lastName = process.env.ADMIN_LAST_NAME ?? ((await ask('Soyad (varsayılan: Akın): ')) || 'Akın');
  const salutation = process.env.ADMIN_SALUTATION ?? `${firstName} Hanım`;

  let password = process.env.ADMIN_PASSWORD;
  if (!password) {
    password = await ask('Şifre (en az 10 karakter, harf + rakam): ', { hidden: true });
    const again = await ask('Şifre (tekrar): ', { hidden: true });
    if (password !== again) throw new Error('Şifreler eşleşmiyor.');
  }
  const check = passwordPolicy.safeParse(password);
  if (!check.success) throw new Error(check.error.issues[0].message);

  const user = await prisma.user.create({
    data: {
      email, firstName, lastName, salutation,
      passwordHash: await hashPassword(password),
      roleId: role.id,
      passwordChangedAt: new Date(),
      notificationPrefs: { inApp: {}, email: {} },
    },
  });
  await prisma.auditLog.create({ data: { action: 'user.created_via_cli', entityType: 'user', entityId: user.id, metadata: { role: roleKey } } });
  console.log(`✓ ${role.name} hesabı oluşturuldu: ${email}\n  Giriş: /panel/giris`);
}

main()
  .catch((e) => {
    console.error('✖', e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
